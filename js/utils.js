const Utils = {
  esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  },

  fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  fmtTime(d) {
    if (!d) return '';
    if (String(d).includes('T')) return String(d).slice(11, 16);
    return '';
  },

  todayStr() {
    return new Date().toISOString().slice(0, 10);
  },

  addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  },

  startOfWeek(date = new Date()) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  weekDates(date = new Date()) {
    const start = this.startOfWeek(date);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  },

  isOverdue(item) {
    if (item.type !== 'task' || item.completed || !item.dueDate) return false;
    return new Date(item.dueDate) < new Date(new Date().toDateString());
  },

  isThisWeek(dateStr) {
    if (!dateStr) return false;
    const weeks = this.weekDates();
    return weeks.includes(dateStr.slice(0, 10));
  },

  typeLabel(type) {
    return ITEM_TYPES[type]?.label || type;
  },

  typeIcon(type) {
    return ITEM_TYPES[type]?.icon || '•';
  },

  passwordStrength(pw) {
    if (!pw) return { score: 0, label: 'Empty' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const labels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'];
    return { score, label: labels[score] };
  },

  parseTags(str) {
    if (!str) return [];
    return str.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
  },

  suggestArea(text) {
    const t = text.toLowerCase();
    if (/reunião|siemens|bom|plc|cablagem|diagrama/.test(t)) return 'area-work';
    if (/cliente|site|dev|deploy|wordpress|react/.test(t)) return 'area-freelance';
    if (/concerto|namorada|família|jantar|viagem/.test(t)) return 'area-personal';
    if (/faculdade|exame|aula|trabalho escolar/.test(t)) return 'area-uni';
    return null;
  },

  detectDueDate(text) {
    const t = text.toLowerCase();
    const today = new Date();
    if (/amanhã/.test(t)) return this.addDays(this.todayStr(), 1);
    if (/hoje/.test(t)) return this.todayStr();
    if (/sexta/.test(t)) {
      const d = new Date(today);
      d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
      return d.toISOString().slice(0, 10);
    }
    return null;
  },

  exportICS(items) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//candeias.dev//Candeias//PT'];
    for (const item of items) {
      if (!item.startDate) continue;
      const uid = item.id + '@candeias.dev';
      const start = item.startDate.replace(/[-:]/g, '').replace('.000', '').slice(0, 15);
      const end = (item.endDate || item.startDate).replace(/[-:]/g, '').slice(0, 15);
      lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTART:${start}`, `DTEND:${end}`,
        `SUMMARY:${(item.title || '').replace(/,/g, '\\,')}`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'candeias-calendario.ics';
    a.click();
  },

  exportBackup(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `candeias-backup-${this.todayStr()}.json`;
    a.click();
  },

  previewAttachment(att) {
    if (!this.isImageAttachment(att)) return null;
    return this.attachmentDataUrl(att);
  },

  attachmentDataUrl(att) {
    if (!att?.data) return null;
    if (String(att.data).startsWith('data:')) return att.data;
    const type = att.type || 'application/octet-stream';
    return `data:${type};base64,${att.data}`;
  },

  isImageAttachment(att) {
    const type = att?.type || '';
    if (type.startsWith('image/')) return true;
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(att?.name || '');
  },

  isPdfAttachment(att) {
    const type = att?.type || '';
    if (type === 'application/pdf') return true;
    return /\.pdf$/i.test(att?.name || '');
  },

  canPreviewInline(att) {
    return this.isImageAttachment(att) || this.isPdfAttachment(att);
  },

  estimateAttachmentSize(att) {
    const raw = String(att?.data || '');
    const b64 = raw.includes(',') ? raw.split(',')[1] : raw;
    return Math.max(0, Math.floor(b64.length * 0.75));
  },

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },

  downloadAttachment(att) {
    const url = this.attachmentDataUrl(att);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name || 'attachment';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  openAttachmentExternal(att) {
    const url = this.attachmentDataUrl(att);
    if (!url) return;
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const opened = window.open(blobUrl, '_blank', 'noopener');
        if (!opened) this.downloadAttachment(att);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
      })
      .catch(() => this.downloadAttachment(att));
  },

  renderAttachmentChip(att, itemId, attIndex, meta = '') {
    if (!att?.data) {
      return `<span class="attachment-chip muted">📎 ${this.esc(att?.name || 'File')}</span>`;
    }
    const prev = this.previewAttachment(att);
    const metaHtml = meta ? `<span class="attachment-chip-meta muted">${this.esc(meta)}</span>` : '';
    return `<button type="button" class="attachment-chip attachment-chip--open" data-action="open-attachment" data-item-id="${itemId}" data-att-index="${attIndex}" aria-label="${this.esc(att.name)}">
      ${prev ? `<img src="${prev}" class="att-preview" alt="">` : '<span class="attachment-icon" aria-hidden="true">📎</span>'}
      <span class="attachment-chip-name">${this.esc(att.name)}</span>${metaHtml}
    </button>`;
  },
};
