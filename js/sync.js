const CloudSync = {
  _auth: null,
  _db: null,
  _uploadTimer: null,
  _loaded: false,

  getConfig() {
    return Store.state.settings.firebaseConfig || null;
  },

  isConfigured() {
    const c = this.getConfig();
    return !!(c?.apiKey && c?.projectId);
  },

  isSignedIn() {
    return !!this._auth?.currentUser;
  },

  userEmail() {
    return this._auth?.currentUser?.email || '';
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
    if (!this.isConfigured()) return;
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
    if (this._auth) await this._auth.signOut();
    Store.state.settings.cloudEmail = '';
    Store.save();
  },

  async ensureReady() {
    if (!this.isConfigured()) throw new Error('Configure Firebase in Settings first.');
    await this.init();
    if (!this._auth) throw new Error('Firebase failed to initialize.');
  },

  docRef() {
    const uid = this._auth.currentUser.uid;
    return this._db.collection('users').doc(uid);
  },

  async pushToCloud() {
    if (!this.isSignedIn()) return;
    const updatedAt = new Date().toISOString();
    const payload = {
      state: Store.state,
      updatedAt,
      version: APP_VERSION,
    };
    await this.docRef().set(payload);
    Store.state.cloudUpdatedAt = updatedAt;
    Store.save({ skipCloud: true });
    Store.state.settings.lastCloudSync = updatedAt;
  },

  async pullFromCloud() {
    if (!this.isSignedIn()) return false;
    const snap = await this.docRef().get();
    if (!snap.exists) {
      await this.pushToCloud();
      return true;
    }
    const remote = snap.data();
    const remoteAt = remote.updatedAt || '';
    const localAt = Store.state.cloudUpdatedAt || '';
    if (!localAt || remoteAt > localAt) {
      const migrated = migrateState(remote.state);
      migrated.cloudUpdatedAt = remoteAt;
      Store.state = migrated;
      Store.save({ skipCloud: true });
      if (typeof App !== 'undefined') {
        App.renderWorkspaceBar?.();
        App.renderAreaFilters?.();
        App.refresh?.();
      }
    }
    Store.state.settings.lastCloudSync = remoteAt;
    Store.save({ skipCloud: true });
    return true;
  },

  scheduleUpload() {
    if (!this.isSignedIn()) return;
    clearTimeout(this._uploadTimer);
    this._uploadTimer = setTimeout(() => {
      this.pushToCloud().catch((e) => console.warn('Cloud upload failed', e));
    }, 2000);
  },

  statusText() {
    if (!this.isConfigured()) return 'Not configured — add Firebase in Settings';
    if (!this.isSignedIn()) return 'Configured — sign in to sync';
    const t = Store.state.settings.lastCloudSync;
    return t ? `Synced · ${new Date(t).toLocaleString()}` : 'Signed in — syncing…';
  },
};
