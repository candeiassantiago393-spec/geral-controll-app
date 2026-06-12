const Gmail = {
  SCOPE: 'https://www.googleapis.com/auth/gmail.readonly',

  inboxUrl(account) {
    const email = encodeURIComponent(account.email || '');
    if (account.gmailAuthIndex != null && account.gmailAuthIndex !== '') {
      return `https://mail.google.com/mail/u/${account.gmailAuthIndex}/#inbox`;
    }
    return `https://mail.google.com/mail/?authuser=${email}#inbox`;
  },

  composeUrl(account, to = '') {
    const base = this.inboxUrl(account).replace('#inbox', '');
    const params = new URLSearchParams({ view: 'cm', fs: '1' });
    if (to) params.set('to', to);
    return `${base.split('?')[0]}?${params}`;
  },

  loadGsi() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
      document.head.appendChild(script);
    });
  },

  connect(clientId, loginHint) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.loadGsi();
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: this.SCOPE,
          hint: loginHint || undefined,
          callback: (resp) => {
            if (resp.error) reject(new Error(resp.error_description || resp.error));
            else resolve(resp);
          },
        });
        client.requestAccessToken({ prompt: 'consent' });
      } catch (e) {
        reject(e);
      }
    });
  },

  isTokenValid(account) {
    return account.gmailAccessToken && account.gmailTokenExpiry && Date.now() < account.gmailTokenExpiry - 60000;
  },

  async fetchInboxPreview(accessToken, maxResults = 8) {
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!listRes.ok) {
      const err = await listRes.text();
      throw new Error(err || `Gmail API error ${listRes.status}`);
    }
    const listData = await listRes.json();
    const ids = (listData.messages || []).map((m) => m.id);
    if (!ids.length) return { unreadCount: listData.resultSizeEstimate || 0, messages: [] };

    const messages = await Promise.all(ids.map(async (id) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return null;
      const data = await res.json();
      const headers = Object.fromEntries((data.payload?.headers || []).map((h) => [h.name, h.value]));
      return {
        id: data.id,
        threadId: data.threadId,
        from: headers.From || '',
        subject: headers.Subject || '(No subject)',
        date: headers.Date || '',
        snippet: data.snippet || '',
        unread: (data.labelIds || []).includes('UNREAD'),
      };
    }));

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    let unreadCount = 0;
    if (profileRes.ok) {
      const profile = await profileRes.json();
      unreadCount = profile.messagesUnread ?? 0;
    }

    return {
      unreadCount,
      messages: messages.filter(Boolean),
    };
  },

  openMessage(account, messageId) {
    const base = this.inboxUrl(account).replace('#inbox', '');
    window.open(`${base.split('#')[0]}#inbox/${messageId}`, '_blank', 'noopener');
  },
};
