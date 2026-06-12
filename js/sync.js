const CloudSync = {
  _auth: null,
  _db: null,
  _uploadTimer: null,
  _loaded: false,
  _mode: null,
  _renderReady: null,
  TOKEN_KEY: 'candeias_render_token',
  REMEMBER_TOKEN_KEY: 'candeias_render_token_persist',
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
    if (this.isRenderMode()) return !!sessionStorage.getItem(this.TOKEN_KEY);
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
        if (user) this.pullFromCloud().catch(() => {});
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
    await this.pullFromCloud();
    return true;
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
    Store.save();
    await this.pushToCloud();
    return cred.user;
  },

  async signIn(email, password) {
    await this.ensureReady();
    const cred = await this._auth.signInWithEmailAndPassword(email.trim(), password);
    Store.state.settings.cloudEmail = cred.user.email;
    Store.save();
    await this.pullFromCloud();
    return cred.user;
  },

  async signOut() {
    if (this.isRenderMode()) {
      this.renderSignOut();
      return;
    }
    if (this._auth) await this._auth.signOut();
    Store.state.settings.cloudEmail = '';
    Store.save();
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

  async pushToCloud() {
    if (!this.isSignedIn()) return;

    const updatedAt = new Date().toISOString();

    if (this.isRenderMode()) {
      const r = await fetch('/api/cloud/state', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Token': this.getToken(),
        },
        body: JSON.stringify({
          state: Store.state,
          updatedAt,
          version: APP_VERSION,
        }),
      });
      if (!r.ok) throw new Error('Cloud upload failed.');
      Store.state.cloudUpdatedAt = updatedAt;
      Store.save({ skipCloud: true });
      Store.state.settings.lastCloudSync = updatedAt;
      return;
    }

    const payload = { state: Store.state, updatedAt, version: APP_VERSION };
    await this.docRef().set(payload);
    Store.state.cloudUpdatedAt = updatedAt;
    Store.save({ skipCloud: true });
    Store.state.settings.lastCloudSync = updatedAt;
  },

  async pullFromCloud() {
    if (!this.isSignedIn()) return false;

    if (this.isRenderMode()) {
      const r = await fetch('/api/cloud/state', {
        headers: { 'X-Sync-Token': this.getToken() },
      });
      if (!r.ok) throw new Error('Cloud download failed.');
      const remote = await r.json();
      if (!remote?.state) {
        await this.pushToCloud();
        return true;
      }
      const remoteAt = remote.updatedAt || '';
      const localAt = Store.state.cloudUpdatedAt || '';
      if (!localAt || remoteAt > localAt) {
        this._applyRemoteState(remote.state, remoteAt);
      }
      Store.state.settings.lastCloudSync = remoteAt;
      Store.save({ skipCloud: true });
      return true;
    }

    const snap = await this.docRef().get();
    if (!snap.exists) {
      await this.pushToCloud();
      return true;
    }
    const remote = snap.data();
    const remoteAt = remote.updatedAt || '';
    const localAt = Store.state.cloudUpdatedAt || '';
    if (!localAt || remoteAt > localAt) {
      this._applyRemoteState(remote.state, remoteAt);
    }
    Store.state.settings.lastCloudSync = remoteAt;
    Store.save({ skipCloud: true });
    return true;
  },

  async syncNow() {
    if (!this.isSignedIn()) return { changed: false };

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
      if (!r.ok) throw new Error('Sync failed.');
      const res = await r.json();
      if (res.changed && res.direction === 'pull' && res.state) {
        this._applyRemoteState(res.state, res.updatedAt || '');
      } else if (res.changed && res.direction === 'push') {
        Store.state.cloudUpdatedAt = res.updatedAt || Store.state.cloudUpdatedAt;
        Store.save({ skipCloud: true });
        Store.state.settings.lastCloudSync = res.updatedAt;
      }
      return res;
    }

    await this.pullFromCloud();
    return { changed: true };
  },

  scheduleUpload() {
    if (!this.isSignedIn()) return;
    clearTimeout(this._uploadTimer);
    this._uploadTimer = setTimeout(() => {
      this.pushToCloud().catch((e) => console.warn('Cloud upload failed', e));
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
    if (this.isRenderMode()) {
      if (!this.isSignedIn()) return 'Render — sign in with password';
      const t = Store.state.settings.lastCloudSync;
      return t ? `Render synced · ${new Date(t).toLocaleString()}` : 'Render — syncing…';
    }
    if (!this.isConfigured()) return 'Not configured — add Firebase in Settings';
    if (!this.isSignedIn()) return 'Configured — sign in to sync';
    const t = Store.state.settings.lastCloudSync;
    return t ? `Synced · ${new Date(t).toLocaleString()}` : 'Signed in — syncing…';
  },
};
