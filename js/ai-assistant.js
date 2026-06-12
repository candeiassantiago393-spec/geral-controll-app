const AiAssistant = {
  EXAMPLES: [
    'Adiciona uma task chamada rever cablagem',
    'Conclui a task validar BOM',
    'Concluí validar BOM quadro Y',
    'Progresso em site Silva: header feito, falta footer',
    'Tarefa urgente amanhã: rever cablagem quadro 12',
    'Reunião Siemens sexta às 10h',
  ],

  findItem(query) {
    const q = this.normalizeItemQuery(query);
    if (!q) return null;
    const items = Store.state.items.filter((i) => !i.archived);
    return items.find((i) => i.title.toLowerCase() === q)
      || items.find((i) => i.title.toLowerCase().includes(q))
      || items.find((i) => q.includes(i.title.toLowerCase()))
      || items.sort((a, b) => {
        const sa = this.similarity(q, a.title.toLowerCase());
        const sb = this.similarity(q, b.title.toLowerCase());
        return sb - sa;
      })[0];
  },

  normalizeItemQuery(query) {
    return query
      .replace(/^[«"'"]|[«"'"]$/g, '')
      .replace(/^(?:a|o|as|os)\s+(?:tarefa|task|item)\s+/i, '')
      .replace(/^(?:tarefa|task|item)\s+/i, '')
      .toLowerCase()
      .trim();
  },

  doneKanbanStatus() {
    const cols = Store.getKanbanColumns();
    return cols.find((c) => /feit|done|conclu|complete/i.test(c)) || cols[cols.length - 1] || 'Feito';
  },

  doneWorkStatus() {
    const sts = Store.getWorkStatuses();
    return sts.find((s) => /conclu|feit|done|complete/i.test(s)) || sts[sts.length - 1] || 'Concluído';
  },

  markComplete(item) {
    Store.updateItem(item.id, {
      completed: true,
      kanbanStatus: this.doneKanbanStatus(),
      workStatus: this.doneWorkStatus(),
    });
  },

  extractTitle(text) {
    const named = text.match(/(?:chamad[oa]|com(?:\s+o)?\s+nome|nomead[oa]|titulad[oa]|named)\s+[«"']?([^«"']+?)[«"']?\s*$/i);
    if (named) return named[1].trim();

    return text
      .replace(/^(?:adiciona|adicionar|cria|criar|add|create|nova|novo)\s+(?:uma?\s+)?(?:tarefa|task|nota|evento|ideia|item|lembrete|reunião|reuniao)?\s*/i, '')
      .replace(/^(?:criar|adicionar|nova|novo|tarefa|task|nota|ideia|evento|reunião|reuniao)\s+/i, '')
      .replace(/\b(urgente|amanhã|amanha|hoje|sexta|segunda|terça|quarta|quinta|domingo|sábado|sabado)\b/gi, '')
      .replace(/(?:às|as|@)\s*\d{1,2}[:h]?\d{0,2}/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  similarity(a, b) {
    if (!a || !b) return 0;
    if (b.includes(a) || a.includes(b)) return 0.9;
    const words = a.split(/\s+/).filter((w) => w.length > 3);
    return words.filter((w) => b.includes(w)).length / Math.max(words.length, 1);
  },

  parseTime(text) {
    const m = text.match(/(?:às|as|@)\s*(\d{1,2})[:h](\d{2})?/i) || text.match(/\b(\d{1,2})[:h](\d{2})\b/);
    if (!m) return null;
    const h = String(m[1]).padStart(2, '0');
    const min = String(m[2] || '00').padStart(2, '0');
    return `${h}:${min}`;
  },

  parseType(text) {
    const t = text.toLowerCase();
    if (/reunião|reuniao|evento|aula|consulta/.test(t)) return 'event';
    if (/ideia|idea/.test(t)) return 'idea';
    if (/nota|lembr/.test(t)) return 'note';
    if (/link|url|http/.test(t)) return 'link';
    if (/checklist|lista de verificação/.test(t)) return 'checklist';
    return 'task';
  },

  parsePriority(text) {
    const t = text.toLowerCase();
    if (/urgente|urgentíssim|urgent|critico|crítico|critical/.test(t)) return 'urgent';
    if (/alta prioridade|importante|alta|high priority|high/.test(t)) return 'high';
    if (/baixa|low/.test(t)) return 'low';
    return 'normal';
  },

  parseArea(text) {
    if (App.workspace && Store.getWorkspaces()[App.workspace]) {
      return Store.getWorkspaces()[App.workspace].areaIds[0];
    }
    return Utils.suggestArea(text);
  },

  buildItemFromText(text, overrides = {}) {
    const type = overrides.type || this.parseType(text);
    const priority = this.parsePriority(text);
    const dueDate = Utils.detectDueDate(text);
    const time = this.parseTime(text);
    const areaId = overrides.areaId || this.parseArea(text);
    let title = overrides.title || this.extractTitle(text);
    if (title.length > 80) title = title.slice(0, 77) + '…';
    const item = {
      type,
      title: title || text.slice(0, 80),
      body: overrides.body || '',
      priority,
      areaId,
      inbox: !areaId,
      tags: [],
    };
    if (/urgente/.test(text.toLowerCase())) item.tags.push('urgente');
    if (dueDate) item.dueDate = dueDate;
    if (type === 'event' || type === 'reminder') {
      const date = dueDate || Utils.todayStr();
      item.startDate = `${date}T${time || '09:00'}`;
      if (time) {
        const [hh, mm] = time.split(':').map(Number);
        const endH = String(Math.min(23, hh + 1)).padStart(2, '0');
        item.endDate = `${date}T${endH}:${String(mm).padStart(2, '0')}`;
      }
    }
    return item;
  },

  processLocal(text) {
    const raw = text.trim();
    if (!raw) return { ok: false, message: 'Type something for me to process.' };

    const completeRe = /^(?:conclu[ií]|concluir|complete|completar|feito|fiz|terminei|completei|done|marca(?:r)? como feit[oa])\s+(?:(?:a|o|as|os)\s+)?(?:(?:tarefa|task|item)\s+)?(?:(?:chamad[oa]|de nome)\s+)?[«"']?(.+?)[«"']?\s*$/i;
    const cm = raw.match(completeRe);
    if (cm) {
      const item = this.findItem(cm[1]);
      if (!item) return { ok: false, message: `Could not find anything like «${cm[1].trim()}».` };
      this.markComplete(item);
      return { ok: true, message: `✓ «${item.title}» marked as completed.` };
    }

    const addRe = /^(?:adiciona|adicionar|cria|criar|add|create|nova|novo)\s+(?:uma?\s+)?(?:(?:tarefa|task|nota|evento|ideia|item|lembrete|reunião|reuniao)\s+)?(?:(?:chamad[oa]|com(?:\s+o)?\s+nome|nomead[oa]|titulad[oa]|named)\s+)?[«"']?(.+?)[«"']?\s*$/i;
    const am = raw.match(addRe);
    if (am) {
      const title = am[1].trim();
      const item = this.buildItemFromText(raw, {
        type: /(?:^|\s)(?:tarefa|task)(?:\s|$)/i.test(raw) ? 'task' : this.parseType(raw),
        title,
      });
      Store.addItem(item);
      const where = item.inbox ? 'Inbox' : (Store.getArea(item.areaId)?.name || 'app');
      return {
        ok: true,
        message: `✓ ${Utils.typeLabel(item.type)} created${item.inbox ? '' : ` in ${where}`}: «${item.title}».`,
      };
    }

    const progressRe = /^(progresso|avancei|atualiza(?:ção|r)?|update|registo)\s+(?:em|na|no|de)\s+(.+?)\s*[:\-–]\s*(.+)/is;
    const pm = raw.match(progressRe);
    if (pm) {
      const item = this.findItem(pm[2]);
      const note = `[${new Date().toLocaleString('pt-PT')}] ${pm[3].trim()}`;
      if (item) {
        Store.updateItem(item.id, { body: (item.body ? item.body + '\n' : '') + note, workStatus: 'Em curso' });
        return { ok: true, message: `📝 Progress logged on «${item.title}».` };
      }
      Store.addItem(this.buildItemFromText(pm[2], { body: note, type: 'task' }));
      return { ok: true, message: `📝 New task created with progress: «${pm[2]}».` };
    }

    const hoursRe = /^(registei|gastei|trabalhei)\s+(\d+(?:[.,]\d+)?)\s*h(?:oras)?\s+(?:em|no|na)\s+(.+)/i;
    const hm = raw.match(hoursRe);
    if (hm) {
      const hours = parseFloat(hm[2].replace(',', '.'));
      const item = this.findItem(hm[3]);
      if (item?.projectId) Store.logHours(item.projectId, hours);
      if (item) Store.updateItem(item.id, { hoursLogged: (item.hoursLogged || 0) + hours });
      return { ok: true, message: `⏱ ${hours}h logged${item ? ` on «${item.title}»` : ''}.` };
    }

    if (/^(inbox|captura rápida)\s*[:\-–]?\s*(.+)/i.test(raw)) {
      const body = raw.replace(/^(inbox|captura rápida)\s*[:\-–]?\s*/i, '');
      Store.addItem({ type: 'idea', title: body.slice(0, 80), body, inbox: true });
      return { ok: true, message: '📥 Added to Inbox.' };
    }

    const item = this.buildItemFromText(raw);
    item.type = item.type || 'task';
    Store.addItem(item);
    const where = item.inbox ? 'Inbox' : (Store.getArea(item.areaId)?.name || 'app');
    return {
      ok: true,
      message: `✓ ${Utils.typeLabel(item.type)} created${item.inbox ? '' : ` in ${where}`}: «${item.title}»${item.dueDate ? ` · ${Utils.fmtDate(item.dueDate)}` : ''}.`,
    };
  },

  async processWithOpenAI(text, apiKey) {
    const model = Store.state.settings.openaiModel || 'gpt-4o-mini';
    const system = `És o assistente da app Candeias (produtividade eletrotécnica). Analisa o pedido do utilizador e responde APENAS JSON válido:
{"action":"create"|"complete"|"progress"|"log_hours","type":"task"|"note"|"event"|"idea"|"reminder","title":"...","body":"...","priority":"low"|"normal"|"high"|"urgent","areaHint":"work"|"freelance"|"personal"|"school"|"inbox","dueDate":"YYYY-MM-DD or null","startTime":"HH:MM or null","matchTitle":"for complete/progress — task name only","hours":number|null}
Regras: português; inferir datas (amanhã/hoje/sexta); "adiciona uma task chamada X"=create title X; "conclui a task Y"=complete matchTitle Y; progresso em X:=progress; gastei N horas=log_hours.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: text }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return this.executeParsed(parsed, text);
  },

  areaFromHint(hint) {
    const map = { work: 'area-work', freelance: 'area-freelance', personal: 'area-personal', school: 'area-uni' };
    return map[hint] || this.parseArea('');
  },

  executeParsed(p, originalText) {
    if (p.action === 'complete' && p.matchTitle) {
      const item = this.findItem(p.matchTitle);
      if (!item) return { ok: false, message: `Could not find «${p.matchTitle}».` };
      this.markComplete(item);
      return { ok: true, message: `✓ «${item.title}» completed (AI).` };
    }
    if (p.action === 'progress') {
      const item = p.matchTitle ? this.findItem(p.matchTitle) : null;
      const note = `[IA ${new Date().toLocaleString('pt-PT')}] ${p.body || originalText}`;
      if (item) {
        Store.updateItem(item.id, { body: (item.body ? item.body + '\n' : '') + note });
        return { ok: true, message: `📝 Progress on «${item.title}» (AI).` };
      }
    }
    if (p.action === 'log_hours' && p.hours) {
      const item = p.matchTitle ? this.findItem(p.matchTitle) : null;
      if (item?.projectId) Store.logHours(item.projectId, p.hours);
      if (item) Store.updateItem(item.id, { hoursLogged: (item.hoursLogged || 0) + p.hours });
      return { ok: true, message: `⏱ ${p.hours}h logged (AI).` };
    }
    const areaId = p.areaHint === 'inbox' ? null : this.areaFromHint(p.areaHint);
    const item = {
      type: p.type || 'task',
      title: p.title || originalText.slice(0, 80),
      body: p.body || '',
      priority: p.priority || 'normal',
      areaId,
      inbox: p.areaHint === 'inbox' || !areaId,
      dueDate: p.dueDate || null,
    };
    if (p.startTime && (item.type === 'event' || item.type === 'reminder')) {
      const d = p.dueDate || Utils.todayStr();
      item.startDate = `${d}T${p.startTime}`;
    }
    Store.addItem(item);
    return { ok: true, message: `✓ Created via AI: «${item.title}».` };
  },

  async process(text) {
    const key = Store.state.settings.openaiApiKey?.trim();
    if (key && Store.state.settings.useAiParser !== false) {
      try {
        return await this.processWithOpenAI(text, key);
      } catch (e) {
        const local = this.processLocal(text);
        local.message += ' (AI unavailable — used local parser)';
        return local;
      }
    }
    return this.processLocal(text);
  },
};
