const AppUpdate = {
  localVersion: APP_VERSION,
  remoteVersion: null,
  updateReady: false,
  _registration: null,

  async init() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const base = new URL('.', location.href).href;
      this._registration = await navigator.serviceWorker.register(`${base}sw.js?v=${APP_VERSION}`);
      this._registration.addEventListener('updatefound', () => {
        const nw = this._registration.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            this.updateReady = true;
            this.showBanner();
          }
        });
      });
    } catch {
      /* SW optional on file:// or blocked */
    }
    await this.checkVersion();
  },

  async checkVersion() {
    try {
      const base = new URL('.', location.href).href;
      const res = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      this.remoteVersion = data.version;
      if (this.isNewer(data.version, APP_VERSION)) {
        this.updateReady = true;
        this.showBanner();
      }
    } catch {
      /* offline */
    }
  },

  isNewer(remote, local) {
    const rp = remote.split('.').map(Number);
    const lp = local.split('.').map(Number);
    for (let i = 0; i < 3; i += 1) {
      if ((rp[i] || 0) > (lp[i] || 0)) return true;
      if ((rp[i] || 0) < (lp[i] || 0)) return false;
    }
    return false;
  },

  showBanner() {
    let el = document.getElementById('update-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'update-banner';
      el.className = 'update-banner hidden';
      el.innerHTML = `<span>New version available</span>
        <button type="button" class="btn btn-sm btn-primary" id="btn-app-update">↻ Update app</button>
        <button type="button" class="btn btn-sm btn-ghost" id="btn-app-update-dismiss">Later</button>`;
      document.querySelector('.main')?.prepend(el);
      document.getElementById('btn-app-update')?.addEventListener('click', () => this.applyUpdate());
      document.getElementById('btn-app-update-dismiss')?.addEventListener('click', () => el.classList.add('hidden'));
    }
    el.classList.remove('hidden');
  },

  async applyUpdate() {
    if (this._registration?.waiting) {
      this._registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if (this._registration) {
      await this._registration.unregister();
    }
    location.reload();
  },

  statusLabel() {
    if (this.updateReady) return `Update available (v${this.remoteVersion || 'new'})`;
    return `Up to date (v${APP_VERSION})`;
  },
};
