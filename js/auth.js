const Auth = {
  SESSION_KEY: 'candeias_auth_session',
  REMEMBER_KEY: 'candeias_auth_remember',
  WEBAUTHN_KEY: 'candeias_webauthn_cred',
  USER_HASH: '49faaade493be8b6b6164ee67f7e4d101812a5dda970d6ca693dda8b8cf82e4b',
  PASS_HASH: '9589262630f775d921bef5b9b2d36fa40f91afebeab887deefc721ff3c787b2c',

  getRpId() {
    const host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'localhost';
    return host;
  },

  supportsWebAuthn() {
    return !!(window.PublicKeyCredential && navigator.credentials?.create);
  },

  hasFaceId() {
    return !!localStorage.getItem(this.WEBAUTHN_KEY);
  },

  isAuthenticated() {
    return sessionStorage.getItem(this.SESSION_KEY) === '1'
      || localStorage.getItem(this.REMEMBER_KEY) === '1';
  },

  setSession(remember = false) {
    sessionStorage.setItem(this.SESSION_KEY, '1');
    if (remember) localStorage.setItem(this.REMEMBER_KEY, '1');
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.REMEMBER_KEY);
    location.reload();
  },

  async sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  async verifyPassword(user, pass) {
    const uh = await this.sha256(user.trim().toLowerCase());
    const ph = await this.sha256(pass);
    return uh === this.USER_HASH && ph === this.PASS_HASH;
  },

  bufToB64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  },

  b64ToBuf(b64) {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i);
    return buf;
  },

  async registerFaceId() {
    if (!this.supportsWebAuthn()) throw new Error('Biometrics not supported on this device/browser.');
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Candeias Control', id: this.getRpId() },
        user: {
          id: new TextEncoder().encode('santiago'),
          name: 'santiago',
          displayName: 'Santiago',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    });
    if (!cred?.rawId) throw new Error('Could not register Face ID.');
    localStorage.setItem(this.WEBAUTHN_KEY, this.bufToB64(cred.rawId));
    return true;
  },

  async loginWithFaceId() {
    if (!this.hasFaceId()) throw new Error('Face ID not set up yet. Log in with password first.');
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: this.getRpId(),
        allowCredentials: [{
          id: this.b64ToBuf(localStorage.getItem(this.WEBAUTHN_KEY)),
          type: 'public-key',
        }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    if (!cred) throw new Error('Face ID cancelled.');
    this.setSession(!!localStorage.getItem(this.REMEMBER_KEY));
    return true;
  },

  showApp() {
    document.getElementById('login-gate')?.classList.add('hidden');
    document.getElementById('app-shell')?.classList.remove('hidden');
  },

  renderLogin(onSuccess) {
    const gate = document.getElementById('login-gate');
    if (!gate) return;
    const faceAvailable = this.supportsWebAuthn();
    const faceRegistered = this.hasFaceId();
    gate.innerHTML = `
      <div class="login-card">
        <div class="brand-icon lg login-logo">C</div>
        <h1 class="login-title">Candeias</h1>
        <p class="login-sub muted">Sign in to continue</p>
        <form id="login-form" class="login-form">
          <div class="form-group">
            <label>User</label>
            <input class="form-control" name="user" autocomplete="username" required placeholder="Username">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input class="form-control" type="password" name="pass" autocomplete="current-password" required placeholder="Password">
          </div>
          <label class="checkbox-row login-remember">
            <input type="checkbox" name="remember"> Keep me signed in
          </label>
          <p class="login-error hidden" id="login-error"></p>
          <button type="submit" class="btn btn-primary w100 login-submit">Sign in</button>
        </form>
        ${faceAvailable ? `
          <div class="login-divider"><span>or</span></div>
          <button type="button" class="btn w100 login-face-btn" id="login-face-btn">
            ${faceRegistered ? '🔐 Sign in with Face ID / Touch ID' : '👤 Set up Face ID after password login'}
          </button>
          <p class="muted sm login-face-hint">${faceRegistered ? 'Uses your device biometrics (HTTPS required).' : 'Log in once, then tap here to register Face ID.'}</p>
        ` : '<p class="muted sm login-face-hint">Biometrics unavailable — use password.</p>'}
      </div>`;

    const errEl = document.getElementById('login-error');
    const showErr = (msg) => {
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
    };

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      errEl.classList.add('hidden');
      const fd = new FormData(e.target);
      const ok = await this.verifyPassword(fd.get('user'), fd.get('pass'));
      if (!ok) {
        showErr('Invalid user or password.');
        return;
      }
      this.setSession(!!fd.get('remember'));
      this.showApp();
      onSuccess?.();
    });

    document.getElementById('login-face-btn')?.addEventListener('click', async () => {
      errEl.classList.add('hidden');
      try {
        if (faceRegistered) {
          await this.loginWithFaceId();
          this.showApp();
          onSuccess?.();
        } else if (await this.verifyPassword(
          document.querySelector('[name=user]')?.value || '',
          document.querySelector('[name=pass]')?.value || '',
        )) {
          await this.registerFaceId();
          this.setSession(!!document.querySelector('[name=remember]')?.checked);
          alert('Face ID / Touch ID enabled on this device.');
          this.showApp();
          onSuccess?.();
        } else {
          showErr('Enter correct password first, then set up Face ID.');
        }
      } catch (ex) {
        showErr(ex.message || 'Biometric login failed.');
      }
    });

    if (faceRegistered && faceAvailable) {
      setTimeout(async () => {
        try {
          await this.loginWithFaceId();
          this.showApp();
          onSuccess?.();
        } catch {
          /* user cancelled or failed — show form */
        }
      }, 400);
    }
  },

  init(onSuccess) {
    return new Promise((resolve) => {
      if (this.isAuthenticated()) {
        this.showApp();
        onSuccess?.();
        resolve(true);
        return;
      }
      this.renderLogin(() => {
        onSuccess?.();
        resolve(true);
      });
    });
  },
};
