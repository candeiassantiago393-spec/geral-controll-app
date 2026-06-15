const CloudSync = {
  _auth: null,
  _db: null,
  _uploadTimer: null,
  _loaded: false,
  _mode: null,
  _renderReady: null,
  _autoSyncTimer: null,
  TOKEN_KEY: 'candeias_render_token',
  REMEMBER_TOKEN_KEY: 'candeias_render_token_persist',
  EMERGENCY_KEY: 'candeias_emergency_backup',
  AUTO_SYNC_MS: 30000,

  getConfig() {
    return Store.state.settings.firebaseConfig || null;
  },

  isRenderMode() {
    return this._mode === 'render';
  },

  isFirebaseMode() {
    return this._mode === 'firebase';
  },

  isConfigured() {
    if (this.isRenderMode()) return true;
    const c = this.getConfig();
    return !!(c?.apiKey && c?.projectId);
  },

  isSignedIn() {
    if (this.isRenderMode()) return !!this.getToken();
    return !!this._auth?.currentUser;
  },

  getToken() {
    return sessionStorage.getItem(this.TOKEN_KEY)
      || localStorage.getItem(this.REMEMBER_TOKEN_KEY)
      || '';
  },

  restorePersistedToken() {
    const t = localStorage.getItem(this.REMEMBER_TOKEN_KEY);
    if (t) sessionStorage.setItem(this.TOKEN_KEY, t);
  },

  userEmail() {
    if (this.isRenderMode()) return 'Render cloud';
    return this._auth?.currentUser?.email || '';
  },

  dataScore(state) {
    if (!state || typeof state !== 'object') return 0;
    return (state.items?.length || 0)
      + (state.projects?.length || 0)
      + (state.clients?.length || 0)
      + (state.vaultEntries?.length || 0)
      + (state.grades?.length || 0)
      + (state.subscriptions?.length || 0);
  },

  emergencyBackup() {
    if (!Store?.state || this.dataScore(Store.state) === 0) return;
    try {
      localStorage.setItem(this.EMERGENCY_KEY, JSON.stringify({
        state: Store.state,
        savedAt: new Date().toISOString(),
        score: this.dataScore(Store.state),
      }));
    } catch {
      /* storage full */
    }
  },

  hasEmergencyBackup() {
    try {
      const raw = localStorage.getItem(this.EMERGENCY_KEY);
      if (!raw) return false;
      return this.dataScore(JSON.parse(raw)?.state) > 0;
    } catch {
      return false;
    }
  },

  restoreEmergencyBackup() {
    try {
      const raw = localStorage.getItem(this.EMERGENCY_KEY);
      if (!raw) return { ok: false, source: 'local', score: 0 };
      const { state } = JSON.parse(raw);
      const score = this.dataScore(state);
      if (score === 0) return { ok: false, source: 'local', score: 0 };
      Store.state = migrateState(state);
      Store.save({ skipCloud: true });
      return { ok: true, source: 'local emergency backup', score };
    } catch {
      return { ok: false, source: 'local', score: 0 };
    }
  },

  async restoreCloudBackupLatest() {
    if (!this.isRenderMode() || !this.isSignedIn()) {
      return { ok: false, source: 'cloud backup', score: 0 };
    }
    try {
      const r = await fetch('/api/cloud/backups/latest', {
        headers: { 'X-Sync-Token': this.getToken() },
      });
      if (!r.ok) return { ok: false, source: 'cloud backup', score: 0 };
      const data = await r.json();
      const score = this.dataScore(data?.state);
      if (score === 0) return { ok: false, source: 'cloud backup', score: 0 };
      this.emergencyBackup();
      this._applyRemoteState(data.state, data.updatedAt || new Date().toISOString());
      return { ok: true, source: 'cloud backup', score };
    } catch {
      return { ok: false, source: 'cloud backup', score: 0 };
    }
  },

  async restoreFromBestAvailable() {
    const before = this.dataScore(Store.state);
    if (before > 0) {
      return { ok: true, source: 'current data', score: before, message: 'App already has data.' };
    }

    let result = this.restoreEmergencyBackup();
    if (result.ok) {
      await this.pushToCloud({ force: true }).catch(() => {});
      return { ...result, message: `Restored ${result.score} records from ${result.source}.` };
    }

    result = await this.restoreCloudBackupLatest();
    if (result.ok) {
      await this.pushToCloud({ force: true }).catch(() => {});
      return { ...result, message: `Restored ${result.score} records from ${result.source}.` };
    }

    if (this.isSignedIn()) {
      await this.syncNow();
      const after = this.dataScore(Store.state);
      if (after > 0) {
        return {
          ok: true,
          source: 'cloud sync',
          score: after,
          message: `Restored ${after} records from cloud.`,
        };
      }
    }

    return {
      ok: false,
      score: 0,
      source: 'none',
      message: 'No previous copy found. Use Import backup if you have a .json file.',
    };
  },

  _setSyncMeta(direction, message) {
    if (!Store.state.settings) Store.state.settings = {};
    Store.state.settings.lastSyncDirection = direction || 'none';
    Store.state.settings.lastSyncMessage = message || '';
  },

  _mergeEntityLists(localList, remoteList) {
    const map = new Map();
    for (const entry of [...(remoteList || []), ...(localList || [])]) {
      if (!entry?.id) continue;
      const prev = map.get(entry.id);
      if (!prev) {
        map.set(entry.id, entry);
        continue;
      }
      const prevAt = prev.updatedAt || prev.createdAt || '';
      const nextAt = entry.updatedAt || entry.createdAt || '';
      map.set(entry.id, nextAt >= prevAt ? entry : prev);
    }
    return Array.from(map.values());
  },

  _mergeStates(localState, remoteState) {
    if (!remoteState) return localState;
    if (!localState) return remoteState;
    return {
      ...localState,
      projects: this._mergeEntityLists(localState.projects, remoteState.projects),
      items: this._mergeEntityLists(localState.items, remoteState.items),
      clients: this._mergeEntityLists(localState.clients, remoteState.clients),
      vaultEntries: this._mergeEntityLists(localState.vaultEntries, remoteState.vaultEntries),
      subscriptions: this._mergeEntityLists(localState.subscriptions, remoteState.subscriptions),
      grades: this._mergeEntityLists(localState.grades, remoteState.grades),
      areas: (localState.areas?.length ? localState.areas : remoteState.areas) || [],
      settings: { ...(remoteState.settings || {}), ...(localState.settings || {}) },
      version: localState.version || remoteState.version || 3,
    };
  },

  _decideSync(localState, localAt, remoteState, remoteAt) {
    const localScore = this.dataScore(localState);
    const remoteScore = this.dataScore(remoteState);
    const now = new Date().toISOString();

    if (remoteScore === 0 && localScore === 0) {
      return { action: 'none', direction: 'none', message: 'No data on device or cloud.' };
    }
    if (remoteScore > 0 && localScore === 0) {
      return {
        action: 'pull',
        state: remoteState,
        updatedAt: remoteAt || now,
        direction: 'pull',
        message: `Downloaded from cloud (${remoteScore} records).`,
      };
    }
    if (localScore > 0 && remoteScore === 0) {
      return {
        action: 'push',
        state: localState,
        updatedAt: localAt || now,
        direction: 'push',
        message: `Uploaded to cloud (${localScore} records).`,
      };
    }

    // More records wins — never discard a richer local copy because cloud has a newer timestamp.
    if (localScore > remoteScore) {
      return {
        action: 'push',
        state: localState,
        updatedAt: localAt || now,
        direction: 'push',
        message: `This device has more data (${localScore} vs ${remoteScore}) — uploaded.`,
      };
    }
    if (remoteScore > localScore) {
      return {
        action: 'pull',
        state: remoteState,
        updatedAt: remoteAt || now,
        direction: 'pull',
        message: `Cloud has more data (${remoteScore} vs ${localScore}) — downloaded.`,
      };
    }

    if (localScore === remoteScore && localScore > 0) {
      const merged = this._mergeStates(localState, remoteState);
      return {
        action: 'push',
        state: merged,
        updatedAt: now,
        direction: 'push',
        message: 'Merged both copies — uploaded.',
      };
    }

    if (!localAt || (remoteAt && remoteAt > localAt)) {
      return {
        action: 'pull',
        state: remoteState,
        updatedAt: remoteAt,
        direction: 'pull',
        message: 'Cloud copy is newer — downloaded.',
      };
    }
    if (localAt && (!remoteAt || localAt > remoteAt)) {
      return {
        action: 'push',
        state: localState,
        updatedAt: localAt,
        direction: 'push',
        message: 'This device is newer — uploaded.',
      };
    }
    return { action: 'none', direction: 'none', message: 'Already in sync.' };
  },

  async detectRenderBackend() {
    if (this._renderReady !== null) return this._renderReady;
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      if (!r.ok) {
        this._renderReady = false;
        return false;
      }
      const data = await r.json();
      this._renderReady = data?.backend === 'render';
      return this._renderReady;
    } catch {
      this._renderReady = false;
      return false;
    }
  },

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  },

  async loadFirebase() {
    if (this._loaded) return;
    const v = '10.14.0';
    await this.loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
    await this.loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-auth-compat.js`);
    await this.loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore-compat.js`);
    this._loaded = true;
  },

  async init() {
    if (await this.detectRenderBackend()) {
      this._mode = 'render';
      this.restorePersistedToken();
      return;
    }
    if (!this.getConfig()?.apiKey) {
      this._mode = null;
      return;
    }
    this._mode = 'firebase';
    try {
      await this.loadFirebase();
      if (!firebase.apps.length) {
        firebase.initializeApp(this.getConfig());
      }
      this._auth = firebase.auth();
      this._db = firebase.firestore();
      this._auth.onAuthStateChanged((user) => {
        if (user) this.syncNow().catch(() => {});
      });
    } catch (e) {
      console.warn('CloudSync init failed', e);
    }
  },

  saveConfig(config) {
    Store.state.settings.firebaseConfig = config;
    Store.save();
  },

  async renderLogin(password, remember = false) {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail || 'Invalid password.');
    }
    const data = await r.json();
    sessionStorage.setItem(this.TOKEN_KEY, data.token);
    if (remember) localStorage.setItem(this.REMEMBER_TOKEN_KEY, data.token);
    else localStorage.removeItem(this.REMEMBER_TOKEN_KEY);
    return this.syncNow();
  },

  renderSignOut() {
    sessionStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REMEMBER_TOKEN_KEY);
  },

  async register(email, password) {
    await this.ensureReady();
    const cred = await this._auth.createUserWithEmailAndPassword(email.trim(), password);
    Store.state.settings.cloudEmail = cred.user.email;
    Store.state.cloudUpdatedAt = new Date().toISOString();
    Store.save({ skipCloud: true });
    await this.pushToCloud({ force: true });
    return cred.user;
  },

  async signIn(email, password) {
    await this.ensureReady();
    const cred = await this._auth.signInWithEmailAndPassword(email.trim(), password);
    Store.state.settings.cloudEmail = cred.user.email;
    Store.save({ skipCloud: true });
    await this.syncNow();
    return cred.user;
  },

  async signOut() {
    if (this.isRenderMode()) {
      this.renderSignOut();
      return;
    }
    if (this._auth) await this._auth.signOut();
    Store.state.settings.cloudEmail = '';
    Store.save({ skipCloud: true });
  },

  async ensureReady() {
    if (this.isRenderMode()) return;
    if (!this.getConfig()) throw new Error('Configure Firebase in Settings first.');
    await this.init();
    if (!this._auth) throw new Error('Firebase failed to initialize.');
  },

  docRef() {
    const uid = this._auth.currentUser.uid;
    return this._db.collection('users').doc(uid);
  },

  _applyRemoteState(remoteState, remoteAt) {
    const localScore = this.dataScore(Store.state);
    const remoteScore = this.dataScore(remoteState);
    if (localScore > remoteScore) {
      console.warn(`CloudSync: blocked pull (${localScore} local vs ${remoteScore} cloud records)`);
      this.pushToCloud({ force: true }).catch(() => {});
      return;
    }
    this.emergencyBackup();
    const migrated = migrateState(remoteState);
    migrated.cloudUpdatedAt = remoteAt;
    Store.state = migrated;
    Store.save({ skipCloud: true });
    Store.state.settings.lastCloudSync = remoteAt;
    if (typeof App !== 'undefined') {
      App.renderWorkspaceBar?.();
      App.renderAreaFilters?.();
      App.refresh?.();
    }
  },

  async _fetchRemoteRender() {
    const r = await fetch('/api/cloud/state', {
      headers: { 'X-Sync-Token': this.getToken() },
    });
    if (!r.ok) throw new Error('Cloud download failed.');
    return r.json();
  },

  async _pushRenderState(state, updatedAt) {
    const r = await fetch('/api/cloud/state', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Token': this.getToken(),
      },
      body: JSON.stringify({ state, updatedAt, version: APP_VERSION }),
    });
    if (r.status === 409) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail || 'Cloud rejected empty upload.');
    }
    if (!r.ok) throw new Error('Cloud upload failed.');
    return r.json();
  },

  async pushToCloud(opts = {}) {
    if (!this.isSignedIn()) return;
    const localScore = this.dataScore(Store.state);
    if (!opts.force && localScore === 0) {
      console.warn('CloudSync: blocked push of empty state');
      return;
    }

    if (this.isRenderMode()) {
      if (!opts.force && localScore === 0) return;
      const remote = await this._fetchRemoteRender();
      const remoteScore = this.dataScore(remote?.state);
      if (!opts.force && remoteScore > 0 && localScore === 0) return;

      const at = new Date().toISOString();
      await this._pushRenderState(Store.state, at);
      Store.state.cloudUpdatedAt = at;
      Store.save({ skipCloud: true });
      Store.state.settings.lastCloudSync = at;
      this._setSyncMeta('push', 'Uploaded to cloud.');
      return;
    }

    const payload = { state: Store.state, updatedAt: new Date().toISOString(), version: APP_VERSION };
    await this.docRef().set(payload);
    Store.state.cloudUpdatedAt = payload.updatedAt;
    Store.save({ skipCloud: true });
    Store.state.settings.lastCloudSync = payload.updatedAt;
    this._setSyncMeta('push', 'Uploaded to cloud.');
  },

  async pullFromCloud() {
    return this.syncNow();
  },

  async syncNow() {
    if (!this.isSignedIn()) return { changed: false, direction: 'none' };

    if (this.isRenderMode()) {
      const r = await fetch('/api/sync/now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Token': this.getToken(),
        },
        body: JSON.stringify({
          state: Store.state,
          updatedAt: Store.state.cloudUpdatedAt || '',
          version: APP_VERSION,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || 'Sync failed.');
      }
      const res = await r.json();
      if (res.changed && res.direction === 'pull' && res.state) {
        this._applyRemoteState(res.state, res.updatedAt || '');
      } else if (res.changed && res.direction === 'push') {
        if (res.state) {
          Store.state = migrateState(res.state);
        }
        Store.state.cloudUpdatedAt = res.updatedAt || Store.state.cloudUpdatedAt;
        Store.save({ skipCloud: true });
        Store.state.settings.lastCloudSync = res.updatedAt;
        if (typeof App !== 'undefined') App.refresh?.();
      }
      this._setSyncMeta(res.direction || 'none', res.message || '');
      return res;
    }

    const snap = await this.docRef().get();
    const remote = snap.exists ? snap.data() : null;
    const remoteState = remote?.state || null;
    const remoteAt = remote?.updatedAt || '';
    const localAt = Store.state.cloudUpdatedAt || '';
    const decision = this._decideSync(Store.state, localAt, remoteState, remoteAt);

    if (decision.action === 'pull') {
      this._applyRemoteState(decision.state, decision.updatedAt);
      this._setSyncMeta('pull', decision.message);
      return { changed: true, direction: 'pull', message: decision.message };
    }
    if (decision.action === 'push') {
      if (decision.state) {
        Store.state = migrateState(decision.state);
        Store.state.cloudUpdatedAt = decision.updatedAt || new Date().toISOString();
        Store.save({ skipCloud: true });
      }
      await this.pushToCloud({ force: true });
      this._setSyncMeta('push', decision.message);
      if (typeof App !== 'undefined') App.refresh?.();
      return { changed: true, direction: 'push', message: decision.message };
    }
    this._setSyncMeta('none', decision.message);
    return { changed: false, direction: 'none', message: decision.message };
  },

  scheduleUpload() {
    if (!this.isSignedIn()) return;
    clearTimeout(this._uploadTimer);
    this._uploadTimer = setTimeout(() => {
      this.syncNow().catch((e) => console.warn('Cloud sync failed', e));
    }, 2000);
  },

  startAutoSync() {
    if (this._autoSyncTimer) clearInterval(this._autoSyncTimer);
    if (!this.isRenderMode() || !this.isSignedIn()) return;
    this._autoSyncTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      this.syncNow().catch(() => {});
    }, this.AUTO_SYNC_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isSignedIn()) {
        this.syncNow().catch(() => {});
      }
    });
  },

  statusText() {
    const score = this.dataScore(Store.state);
    const msg = Store.state.settings?.lastSyncMessage;
    if (this.isRenderMode()) {
      if (!this.isSignedIn()) return 'Render — sign in with password';
      const t = Store.state.settings.lastCloudSync;
      const base = t ? `Render synced · ${new Date(t).toLocaleString()}` : 'Render — syncing…';
      return `${base} · ${score} records${msg ? ` — ${msg}` : ''}`;
    }
    if (!this.isConfigured()) return 'Not configured — add Firebase in Settings';
    if (!this.isSignedIn()) return 'Configured — sign in to sync';
    const t = Store.state.settings.lastCloudSync;
    const base = t ? `Synced · ${new Date(t).toLocaleString()}` : 'Signed in — syncing…';
    return `${base} · ${score} records`;
  },
};
