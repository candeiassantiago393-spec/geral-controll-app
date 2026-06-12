const Auth = {
  SESSION_KEY: 'candeias_auth_session',
  REMEMBER_KEY: 'candeias_auth_remember',
  WEBAUTHN_KEY: 'candeias_webauthn_cred',
  USER_HASH_KEY: 'candeias_auth_user_hash',
  PASS_HASH_KEY: 'candeias_auth_pass_hash',
  USERNAME_KEY: 'candeias_auth_username',

  getRpId() {
    const host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'localhost';
    return host;
  },

  supportsWebAuthn() {
    return !!(window.PublicKeyCredential && navigator.credentials?.create);
  },

  hasCredentials() {
    return !!(localStorage.getItem(this.USER_HASH_KEY) && localStorage.getItem(this.PASS_HASH_KEY));
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
    if (typeof CloudSync !== 'undefined' && CloudSync.isSignedIn()) {
      CloudSync.signOut().finally(() => location.reload());
      return;
    }
    location.reload();
  },

  async sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  async saveCredentials(user, pass) {
    const username = user.trim().toLowerCase();
    if (!username || pass.length < 4) {
      throw new Error('User required and password must be at least 4 characters.');
    }
    localStorage.setItem(this.USER_HASH_KEY, await this.sha256(username));
    localStorage.setItem(this.PASS_HASH_KEY, await this.sha256(pass));
    localStorage.setItem(this.USERNAME_KEY, username);
  },

  async verifyPassword(user, pass) {
    if (!this.hasCredentials()) return false;
    const uh = await this.sha256(user.trim().toLowerCase());
    const ph = await this.sha256(pass);
    return uh === localStorage.getItem(this.USER_HASH_KEY)
      && ph === localStorage.getItem(this.PASS_HASH_KEY);
  },

  getStoredUsername() {
    return localStorage.getItem(this.USERNAME_KEY) || 'user';
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
    const username = this.getStoredUsername();
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Candeias Control', id: this.getRpId() },
        user: {
          id: new TextEncoder().encode(username),
          name: username,
          displayName: username,
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

  renderSetup(onSuccess) {
    const gate = document.getElementById('login-gate');
    if (!gate) return;
    gate.innerHTML = `
      <div class="login-card">
        <div class="brand-icon lg login-logo">C</div>
        <h1 class="login-title">Candeias</h1>
        <p class="login-sub muted">First time on this device — create your login.<br>Stored only here, not on GitHub.</p>
        <form id="setup-form" class="login-form">
          <div class="form-group">
            <label>User</label>
            <input class="form-control" name="user" autocomplete="username" required placeholder="Choose a username">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input class="form-control" type="password" name="pass" autocomplete="new-password" required minlength="4" placeholder="At least 4 characters">
          </div>
          <div class="form-group">
            <label>Confirm password</label>
            <input class="form-control" type="password" name="pass2" autocomplete="new-password" required minlength="4">
          </div>
          <p class="login-error hidden" id="login-error"></p>
          <button type="submit" class="btn btn-primary w100 login-submit">Create login</button>
        </form>
      </div>`;

    const errEl = document.getElementById('login-error');
    document.getElementById('setup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      errEl.classList.add('hidden');
      const fd = new FormData(e.target);
      if (fd.get('pass') !== fd.get('pass2')) {
        errEl.textContent = 'Passwords do not match.';
        errEl.classList.remove('hidden');
        return;
      }
      try {
        await this.saveCredentials(fd.get('user'), fd.get('pass'));
        this.setSession(true);
        this.showApp();
        onSuccess?.();
      } catch (ex) {
        errEl.textContent = ex.message;
        errEl.classList.remove('hidden');
      }
    });
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

  renderCloudLogin(onSuccess) {
    const gate = document.getElementById('login-gate');
    if (!gate) return;
    const faceAvailable = this.supportsWebAuthn();
    const faceRegistered = this.hasFaceId();
    gate.innerHTML = `
      <div class="login-card">
        <div class="brand-icon lg login-logo">C</div>
        <h1 class="login-title">Candeias</h1>
        <p class="login-sub muted">Cloud account — same data on PC and phone</p>
        <form id="cloud-login-form" class="login-form">
          <div class="form-group">
            <label>Email</label>
            <input class="form-control" type="email" name="email" autocomplete="username" required placeholder="your@email.com">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input class="form-control" type="password" name="pass" autocomplete="current-password" required minlength="6" placeholder="Password">
          </div>
          <label class="checkbox-row login-remember">
            <input type="checkbox" name="remember" checked> Keep me signed in
          </label>
          <p class="login-error hidden" id="login-error"></p>
          <button type="submit" class="btn btn-primary w100 login-submit">Sign in & sync</button>
          <button type="button" class="btn w100 mt" id="cloud-register-btn">Create account</button>
        </form>
        ${faceAvailable ? `
          <div class="login-divider"><span>or</span></div>
          <button type="button" class="btn w100 login-face-btn" id="login-face-btn">🔐 Face ID / Touch ID</button>
          <p class="muted sm login-face-hint">${faceRegistered ? 'Quick unlock on this device.' : 'Sign in first, then enable Face ID.'}</p>
        ` : ''}
      </div>`;

    const errEl = document.getElementById('login-error');
    const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };
    const form = document.getElementById('cloud-login-form');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errEl.classList.add('hidden');
      const fd = new FormData(form);
      try {
        await CloudSync.signIn(fd.get('email'), fd.get('pass'));
        this.setSession(!!fd.get('remember'));
        this.showApp();
        onSuccess?.();
      } catch (ex) {
        showErr(ex.message || 'Sign in failed.');
      }
    });

    document.getElementById('cloud-register-btn')?.addEventListener('click', async () => {
      errEl.classList.add('hidden');
      const fd = new FormData(form);
      try {
        await CloudSync.register(fd.get('email'), fd.get('pass'));
        this.setSession(true);
        alert('Account created! Your data will sync across devices.');
        this.showApp();
        onSuccess?.();
      } catch (ex) {
        showErr(ex.message || 'Registration failed.');
      }
    });

    document.getElementById('login-face-btn')?.addEventListener('click', async () => {
      errEl.classList.add('hidden');
      try {
        if (faceRegistered && CloudSync.isSignedIn()) {
          await this.loginWithFaceId();
          this.showApp();
          onSuccess?.();
        } else if (CloudSync.isSignedIn()) {
          await this.registerFaceId();
          alert('Face ID enabled.');
        } else {
          showErr('Sign in with email first.');
        }
      } catch (ex) {
        showErr(ex.message || 'Biometric failed.');
      }
    });
  },

  init(onSuccess) {
    return new Promise(async (resolve) => {
      if (typeof CloudSync !== 'undefined') {
        await CloudSync.init();
        if (CloudSync.isConfigured() && CloudSync.isSignedIn()) {
          await CloudSync.pullFromCloud().catch(() => {});
          this.setSession(true);
          this.showApp();
          onSuccess?.();
          resolve(true);
          return;
        }
      }

      if (this.isAuthenticated() && (!CloudSync.isConfigured() || !CloudSync.isSignedIn())) {
        this.showApp();
        onSuccess?.();
        resolve(true);
        return;
      }

      const done = () => { onSuccess?.(); resolve(true); };

      if (typeof CloudSync !== 'undefined' && CloudSync.isConfigured()) {
        this.renderCloudLogin(done);
        return;
      }

      if (!this.hasCredentials()) {
        this.renderSetup(done);
      } else {
        this.renderLogin(done);
      }
    });
  },
};
