const AppUpdate = {
  localVersion: APP_VERSION,
  remoteVersion: null,
  updateReady: false,
  _registration: null,
  _applying: false,

  async init() {
    this.stripReloadParam();
    if ('serviceWorker' in navigator) {
      try {
        const base = new URL('.', location.href).href;
        this._registration = await navigator.serviceWorker.register(`${base}sw.js?v=${APP_VERSION}`, {
          updateViaCache: 'none',
        });
        await this._registration.update();
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
    }
    await this.checkVersion();
  },

  stripReloadParam() {
    try {
      const url = new URL(location.href);
      if (!url.searchParams.has('appv')) return;
      url.searchParams.delete('appv');
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* ignore */
    }
  },

  async checkVersion() {
    try {
      const base = new URL('.', location.href).href;
      const res = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return false;
      const data = await res.json();
      this.remoteVersion = data.version;
      const newer = this.isNewer(data.version, APP_VERSION);
      this.updateReady = newer;
      if (newer) this.showBanner();
      return newer;
    } catch {
      return false;
    }
  },

  isNewer(remote, local) {
    const rp = String(remote || '').split('.').map(Number);
    const lp = String(local || '').split('.').map(Number);
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
      el.innerHTML = `<span>Nova versão disponível</span>
        <button type="button" class="btn btn-sm btn-primary" id="btn-app-update">↻ Atualizar app</button>
        <button type="button" class="btn btn-sm btn-ghost" id="btn-app-update-dismiss">Mais tarde</button>`;
      document.querySelector('.main')?.prepend(el);
      document.getElementById('btn-app-update')?.addEventListener('click', () => this.applyUpdate());
      document.getElementById('btn-app-update-dismiss')?.addEventListener('click', () => el.classList.add('hidden'));
    }
    el.classList.remove('hidden');
  },

  async applyUpdate() {
    if (this._applying) return false;
    this._applying = true;

    let bust = Date.now();
    try {
      const base = new URL('.', location.href).href;
      const res = await fetch(`${base}version.json?t=${bust}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        this.remoteVersion = data.version;
        bust = data.version || bust;
      }
    } catch {
      /* continue with timestamp bust */
    }

    try {
      if (this._registration?.waiting) {
        this._registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* still try hard reload */
    }

    const url = new URL(location.href);
    url.searchParams.set('appv', String(bust));
    location.replace(url.toString());
    return true;
  },

  statusLabel() {
    if (this.updateReady && this.remoteVersion) {
      return `Atualização disponível (v${this.remoteVersion})`;
    }
    if (this.remoteVersion && this.remoteVersion !== APP_VERSION) {
      return `Servidor: v${this.remoteVersion}`;
    }
    return `Atualizada (v${APP_VERSION}) · usa Recarregar se a interface parecer antiga`;
  },
};
