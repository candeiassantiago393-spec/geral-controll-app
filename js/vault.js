const Vault = {
  sessionKey: null,
  sessionPassword: null,

  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async encrypt(text, password) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(text)
    );
    return {
      salt: Array.from(salt),
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(cipher)),
    };
  },

  async decrypt(payload, password) {
    const dec = new TextDecoder();
    const salt = new Uint8Array(payload.salt);
    const iv = new Uint8Array(payload.iv);
    const data = new Uint8Array(payload.data);
    const key = await this.deriveKey(password, salt);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return dec.decode(plain);
  },

  isSetup() {
    return !!localStorage.getItem('candeias_vault_hash');
  },

  async setupMasterPassword(password) {
    const hash = await this.hashPassword(password);
    localStorage.setItem('candeias_vault_hash', hash);
    Store.state.vaultUnlocked = true;
    this.sessionPassword = password;
    Store.save();
    return true;
  },

  async hashPassword(password) {
    const enc = new TextEncoder();
    const data = enc.encode(password + 'candeias.dev');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  },

  async unlock(password) {
    const stored = localStorage.getItem('candeias_vault_hash');
    const hash = await this.hashPassword(password);
    if (hash === stored) {
      Store.state.vaultUnlocked = true;
      this.sessionPassword = password;
      Store.save();
      return true;
    }
    return false;
  },

  lock() {
    Store.state.vaultUnlocked = false;
    this.sessionPassword = null;
    Store.save();
  },

  async saveEntrySecrets(entry, password) {
    if (!entry.password && !entry.notes) return entry;
    const secrets = JSON.stringify({ password: entry.password || '', notes: entry.notes || '' });
    entry.encrypted = await this.encrypt(secrets, password);
    entry.password = '';
    entry.notes = '';
    return entry;
  },

  async loadEntrySecrets(entry, password) {
    if (!entry.encrypted) return { password: entry.password || '', notes: entry.notes || '' };
    try {
      const json = await this.decrypt(entry.encrypted, password);
      return JSON.parse(json);
    } catch {
      return { password: '••••••••', notes: 'Erro ao desencriptar' };
    }
  },

  generatePassword(length = 16) {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => chars[b % chars.length]).join('');
  },
};
