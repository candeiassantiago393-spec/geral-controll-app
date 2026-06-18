const Utils = {
  esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  },

  fmtDate(d) {
    if (!d) return '';
    const iso = String(d).slice(0, 10);
    if (!this.isValidDateStr(iso)) return '';
    const [y, mo, day] = iso.split('-').map(Number);
    const dt = new Date(y, mo - 1, day);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  fmtMinutes(min) {
    const m = parseInt(min, 10);
    if (!m || m <= 0) return '—';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  },

  fmtHours(hours) {
    const h = Number(hours);
    if (!h || h <= 0) return '0h';
    if (h < 0.1) return `${Math.round(h * 60)}m`;
    if (h < 10) return `${h.toFixed(1)}h`;
    return `${Math.round(h)}h`;
  },

  fmtTime(d) {
    if (!d) return '';
    if (String(d).includes('T')) return String(d).slice(11, 16);
    return '';
  },

  todayStr() {
    return new Date().toISOString().slice(0, 10);
  },

  isValidDateStr(dateStr) {
    const m = String(dateStr || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
  },

  addDays(dateStr, days) {
    const m = String(dateStr || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    const dt = new Date(y, mo - 1, d);
    if (Number.isNaN(dt.getTime())) return null;
    dt.setDate(dt.getDate() + days);
    const ny = dt.getFullYear();
    const nmo = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    return `${ny}-${nmo}-${nd}`;
  },

  daysBetween(from, to) {
    if (!this.isValidDateStr(from) || !this.isValidDateStr(to)) return 0;
    const [fy, fm, fd] = from.slice(0, 10).split('-').map(Number);
    const [ty, tm, td] = to.slice(0, 10).split('-').map(Number);
    const a = new Date(fy, fm - 1, fd);
    const b = new Date(ty, tm - 1, td);
    return Math.round((b - a) / 86400000);
  },

  expandDateRange(from, to, maxDays = 3660) {
    if (!this.isValidDateStr(from)) return [];
    if (!this.isValidDateStr(to)) return [from.slice(0, 10)];
    let start = from.slice(0, 10);
    let end = to.slice(0, 10);
    if (end < start) [start, end] = [end, start];
    const span = this.daysBetween(start, end) + 1;
    if (span <= 0 || span > maxDays) return [];
    const dates = [];
    let cur = start;
    for (let i = 0; i < span; i++) {
      dates.push(cur);
      const next = this.addDays(cur, 1);
      if (!next || next === cur) break;
      cur = next;
    }
    return dates;
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
    if (item.type !== 'task' || item.completed) return false;
    const dates = this.itemScheduleDates(item);
    const due = dates.length ? dates[dates.length - 1] : item.dueDate;
    if (!due) return false;
    return new Date(due) < new Date(new Date().toDateString());
  },

  isConsecutiveRange(dates) {
    if (!dates || dates.length < 2) return false;
    const sorted = [...dates].map((d) => d.slice(0, 10)).sort();
    for (let i = 1; i < sorted.length; i++) {
      if (this.addDays(sorted[i - 1], 1) !== sorted[i]) return false;
    }
    return true;
  },

  detectScheduleMode(dates) {
    if (!dates?.length) return 'single';
    if (dates.length === 1) return 'single';
    if (this.isConsecutiveRange(dates)) return 'range';
    return 'multiple';
  },

  itemScheduleDates(item) {
    if (Array.isArray(item?.scheduleDates) && item.scheduleDates.length) {
      return [...new Set(item.scheduleDates.map((d) => String(d).slice(0, 10)).filter(Boolean))].sort();
    }
    const dates = new Set();
    if (item?.dueDate) dates.add(String(item.dueDate).slice(0, 10));
    if (item?.startDate) dates.add(String(item.startDate).slice(0, 10));
    if (item?.endDate) {
      const endDay = String(item.endDate).slice(0, 10);
      const startDay = item.startDate?.slice(0, 10);
      if (startDay && endDay !== startDay) return this.expandDateRange(startDay, endDay);
      dates.add(endDay);
    }
    return [...dates].sort();
  },

  itemOccursOnDate(item, dateStr) {
    if (!dateStr) return false;
    const day = dateStr.slice(0, 10);
    return this.itemScheduleDates(item).includes(day);
  },

  fmtScheduleDates(dates) {
    if (!dates?.length) return '';
    const sorted = [...dates].map((d) => d.slice(0, 10)).sort();
    if (sorted.length === 1) return this.fmtDate(sorted[0]);
    if (this.isConsecutiveRange(sorted)) {
      return `${this.fmtDate(sorted[0])} – ${this.fmtDate(sorted[sorted.length - 1])}`;
    }
    if (sorted.length <= 4) return sorted.map((d) => this.fmtDate(d)).join(', ');
    return `${sorted.slice(0, 3).map((d) => this.fmtDate(d)).join(', ')} +${sorted.length - 3}`;
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
      const dates = Utils.itemScheduleDates(item);
      if (!dates.length && !item.startDate) continue;
      const days = dates.length ? dates : [item.startDate.slice(0, 10)];
      const time = item.startDate?.includes('T') ? item.startDate.slice(11, 16) : '09:00';
      const [hh, mm] = time.split(':').map(Number);
      const durMin = item.duration || 60;
      const endMin = hh * 60 + mm + durMin;
      const endH = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
      const endM = String(endMin % 60).padStart(2, '0');
      for (const day of days) {
        const uid = `${item.id}-${day}@candeias.dev`;
        const start = `${day}T${time}`.replace(/[-:]/g, '').slice(0, 15);
        const end = `${day}T${endH}:${endM}`.replace(/[-:]/g, '').slice(0, 15);
        lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTART:${start}`, `DTEND:${end}`,
          `SUMMARY:${(item.title || '').replace(/,/g, '\\,')}`, 'END:VEVENT');
      }
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
