function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const LEGACY_KANBAN_MAP = {
  'A fazer': 'To do', 'Hoje': 'Today', 'Em curso': 'In progress',
  'Bloqueado': 'Blocked', 'Feito': 'Done',
};
const LEGACY_WORK_MAP = {
  'Em curso': 'In progress', 'À espera': 'Waiting', 'Bloqueado': 'Blocked', 'Concluído': 'Completed',
};
const LEGACY_PIPELINE_MAP = {
  Orçamento: 'Quote', 'Em desenvolvimento': 'In development', 'Revisão cliente': 'Client review',
  Entregue: 'Delivered', Manutenção: 'Maintenance', 'Por faturar': 'To invoice',
  Faturado: 'Invoiced', Pago: 'Paid', Parcial: 'Partial', Proposta: 'Proposal', Testes: 'Testing',
};
const LEGACY_CLIENT_STATUS = { Ativo: 'Active', Inativo: 'Inactive', Manutenção: 'Maintenance' };
const LEGACY_PRIORITY = { baixa: 'low', alta: 'high', urgente: 'urgent' };

function migrateLegacyValue(val, map) {
  return val != null && map[val] != null ? map[val] : val;
}

function itemDefaults(data = {}) {
  return {
    id: data.id || uid(),
    type: data.type || 'note',
    areaId: data.areaId ?? null,
    projectId: data.projectId ?? null,
    subContextId: data.subContextId ?? null,
    title: data.title || 'Untitled',
    body: data.body || '',
    tags: data.tags || [],
    url: data.url || '',
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    duration: data.duration ?? null,
    dueDate: data.dueDate ?? null,
    completed: data.completed || false,
    priority: data.priority || 'normal',
    kanbanStatus: data.kanbanStatus || 'To do',
    workStatus: data.workStatus || 'In progress',
    location: data.location || '',
    linkedNoteId: data.linkedNoteId ?? null,
    attachments: data.attachments || [],
    checklistItems: data.checklistItems || [],
    contactInfo: data.contactInfo || { email: '', phone: '', company: '' },
    contactGroupId: data.contactGroupId ?? null,
    linkCategoryId: data.linkCategoryId ?? null,
    equipmentRef: data.equipmentRef || '',
    partNumbers: data.partNumbers || '',
    projectStage: data.projectStage || '',
    hoursLogged: data.hoursLogged ?? 0,
    pinned: data.pinned || false,
    archived: data.archived || false,
    snoozedUntil: data.snoozedUntil ?? null,
    recurrence: data.recurrence ?? null,
    inbox: data.inbox ?? (!data.areaId && !data.projectId),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

function projectDefaults(data = {}) {
  return {
    id: data.id || uid(),
    areaId: data.areaId,
    name: data.name,
    description: data.description || '',
    status: data.status || 'active',
    pipeline: data.pipeline ?? null,
    paymentStatus: data.paymentStatus ?? null,
    stack: data.stack || '',
    url: data.url || '',
    client: data.client || '',
    clientId: data.clientId ?? null,
    clientEmail: data.clientEmail || '',
    clientPhone: data.clientPhone || '',
    color: data.color || '#00d26a',
    estimatedHours: data.estimatedHours ?? 0,
    loggedHours: data.loggedHours ?? 0,
    versions: data.versions || [],
    wishlist: (data.wishlist || []).map((w) => ({
      id: w.id || uid(),
      text: w.text || '',
      done: !!w.done,
      createdAt: w.createdAt || new Date().toISOString(),
    })),
    stages: data.stages?.length ? data.stages : null,
    archived: data.archived || false,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
  };
}

function clientDefaults(data = {}) {
  return {
    id: data.id || uid(),
    name: data.name || '',
    company: data.company || '',
    email: data.email || '',
    phone: data.phone || '',
    website: data.website || '',
    nif: data.nif || '',
    address: data.address || '',
    status: data.status || 'Active',
    notes: data.notes || '',
    tags: data.tags || [],
    contacts: data.contacts || [],
    archived: data.archived || false,
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

function migrateItem(raw) {
  const item = itemDefaults(raw);
  item.kanbanStatus = migrateLegacyValue(item.kanbanStatus, LEGACY_KANBAN_MAP);
  item.workStatus = migrateLegacyValue(item.workStatus, LEGACY_WORK_MAP);
  item.priority = migrateLegacyValue(item.priority, LEGACY_PRIORITY);
  return item;
}

function migrateClient(raw) {
  const c = clientDefaults(raw);
  c.status = migrateLegacyValue(c.status, LEGACY_CLIENT_STATUS);
  return c;
}

function migrateProject(raw) {
  const p = projectDefaults(raw);
  p.pipeline = migrateLegacyValue(p.pipeline, LEGACY_PIPELINE_MAP);
  p.paymentStatus = migrateLegacyValue(p.paymentStatus, LEGACY_PIPELINE_MAP);
  if (!p.clientId && p.client && p.areaId === 'area-freelance') {
    p.clientId = null;
  }
  if (!p.updatedAt) p.updatedAt = p.createdAt;
  return p;
}

function isElevadorProject(project) {
  return /elevador/i.test(project?.name || '');
}

function inferDisplaySensorStage(item) {
  if (item.type !== 'task' && item.type !== 'checklist') return '';
  const text = `${item.title || ''} ${item.body || ''}`.toLowerCase();
  if (/display|ecr[aã]|piso\s*display|bot[aã]o\/?led|led\s*\d|urg[eê]ncia.*display|\dº\s*piso\s*display/i.test(text)) {
    return 'Displays';
  }
  if (/sensor|soldagem sensores|soldar.*sensor|shant|shunt/i.test(text)) {
    return 'Sensores';
  }
  return '';
}

function migrateElevadorDisplaySensorStages(state) {
  const focus = ['Displays', 'Sensores'];
  const migrated = !!state.settings?.elevadorDisplaySensorStagesV1;

  for (const project of state.projects) {
    if (!isElevadorProject(project)) continue;

    const existing = project.stages?.length ? [...project.stages] : [];
    const merged = [...focus];
    for (const s of existing) {
      if (!merged.includes(s)) merged.push(s);
    }
    project.stages = merged;

    for (const item of state.items) {
      if (item.projectId !== project.id) continue;
      const inferred = inferDisplaySensorStage(item);
      if (!inferred) continue;
      if (!migrated || !item.projectStage) {
        item.projectStage = inferred;
      }
    }
  }

  if (!migrated) {
    state.settings.elevadorDisplaySensorStagesV1 = true;
  }
}

function migrateState(raw) {
  if (!raw) return defaultState();
  if (!raw.version || raw.version < 3) {
    return defaultState();
  }
  const state = { ...defaultState(), ...raw, version: 3 };
  state.cloudUpdatedAt = raw.cloudUpdatedAt || null;
  state.areas = raw.areas?.length ? raw.areas : DEFAULT_AREAS;
  state.clients = (raw.clients || []).map(migrateClient);
  state.projects = (raw.projects || []).map(migrateProject);
  state.items = (raw.items || []).map(migrateItem);
  state.subscriptions = raw.subscriptions || [];
  state.vaultEntries = raw.vaultEntries || [];
  state.settings = {
    ...defaultState().settings,
    ...(raw.settings || {}),
    accessibility: { ...DEFAULT_ACCESSIBILITY, ...(raw.settings?.accessibility || {}) },
    schoolSchedule: raw.settings?.schoolSchedule || SchoolSchedule.defaultSchedule(),
    contactGroups: raw.settings?.contactGroups?.length ? raw.settings.contactGroups : defaultContactGroups(),
    vaultFolders: raw.settings?.vaultFolders?.length ? raw.settings.vaultFolders : defaultVaultFolders(),
    quickTags: raw.settings?.quickTags?.length ? raw.settings.quickTags : [...QUICK_TAGS],
    kanbanColumns: raw.settings?.kanbanColumns?.length ? raw.settings.kanbanColumns : defaultKanbanColumns(),
    projectStages: raw.settings?.projectStages?.length ? raw.settings.projectStages : defaultProjectStages(),
    pipelineStages: raw.settings?.pipelineStages?.length ? raw.settings.pipelineStages : defaultPipelineStages(),
    workStatuses: raw.settings?.workStatuses?.length ? raw.settings.workStatuses : defaultWorkStatuses(),
    clientStatuses: raw.settings?.clientStatuses?.length ? raw.settings.clientStatuses : defaultClientStatuses(),
    priorities: raw.settings?.priorities?.length ? raw.settings.priorities : defaultPriorities(),
    paymentStatuses: raw.settings?.paymentStatuses?.length ? raw.settings.paymentStatuses : defaultPaymentStatuses(),
    workspaces: raw.settings?.workspaces || defaultWorkspaces(),
    linkCategories: raw.settings?.linkCategories?.length ? raw.settings.linkCategories : defaultLinkCategories(),
    subscriptionCategories: raw.settings?.subscriptionCategories?.length ? raw.settings.subscriptionCategories : defaultSubscriptionCategories(),
    emailAccounts: raw.settings?.emailAccounts?.length ? raw.settings.emailAccounts : defaultEmailAccounts(),
    disciplines: raw.settings?.disciplines?.length ? raw.settings.disciplines : defaultDisciplines(),
    customTemplates: raw.settings?.customTemplates || [],
    dashboardWidgets: raw.settings?.dashboardWidgets?.length ? raw.settings.dashboardWidgets : defaultState().settings.dashboardWidgets,
    areaFiltersCollapsed: raw.settings?.areaFiltersCollapsed ?? false,
    fullDemoLoaded: !!raw.settings?.fullDemoLoaded,
  };
  state.vaultUnlocked = false;
  state.grades = raw.grades || [];
  migrateElevadorDisplaySensorStages(state);
  return state;
}

const Store = {
  state: null,

  init() {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of ['candeias_app_v2', 'candeias_app_v1']) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    if (raw) {
      try {
        this.state = migrateState(JSON.parse(raw));
        this.save();
      } catch {
        this.state = defaultState();
        this.save();
      }
    } else {
      this.state = defaultState();
      this.save();
    }
  },

  save(opts = {}) {
    if (!opts.skipCloud) {
      this.state.cloudUpdatedAt = new Date().toISOString();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    if (!opts.skipCloud && typeof CloudSync !== 'undefined' && CloudSync.dataScore(this.state) > 0) {
      CloudSync.emergencyBackup();
    }
    if (!opts.skipCloud && typeof CloudSync !== 'undefined') {
      CloudSync.scheduleUpload();
    }
  },

  reset() {
    this.state = defaultState();
    this.save();
  },

  loadDemo() {
    this.state = demoState();
    this.save();
  },

  clearAllData() {
    this.reset();
  },

  importBackup(data) {
    if (!data || typeof data !== 'object') return false;
    try {
      this.state = migrateState(data);
      this.state.vaultUnlocked = false;
      this.state.cloudUpdatedAt = new Date().toISOString();
      this.save({ skipCloud: true });
      if (typeof CloudSync !== 'undefined') {
        CloudSync.emergencyBackup();
        if (CloudSync.isSignedIn()) {
          CloudSync.pushToCloud({ force: true }).catch((e) => console.warn('Post-import cloud push failed', e));
        }
      }
      return true;
    } catch {
      return false;
    }
  },

  trackRecent(id) {
    const recent = this.state.settings.recentItems.filter((r) => r !== id);
    recent.unshift(id);
    this.state.settings.recentItems = recent.slice(0, 15);
    this.save();
  },

  getArea(id) { return this.state.areas.find((a) => a.id === id); },
  getProject(id) { return this.state.projects.find((p) => p.id === id); },
  getItem(id) { return this.state.items.find((i) => i.id === id); },
  getClient(id) { return this.state.clients?.find((c) => c.id === id); },

  getClients(filter = {}) {
    let clients = (this.state.clients || []).filter((c) => !c.archived);
    if (filter.archived) clients = (this.state.clients || []).filter((c) => c.archived);
    if (filter.status) clients = clients.filter((c) => c.status === filter.status);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      clients = clients.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.contacts.some((p) => p.name.toLowerCase().includes(q))
      );
    }
    return clients.sort((a, b) => a.name.localeCompare(b.name));
  },

  getProjectsByClientId(clientId) {
    return this.state.projects.filter((p) => p.clientId === clientId && !p.archived);
  },

  getItemsByClientId(clientId) {
    const pids = this.getProjectsByClientId(clientId).map((p) => p.id);
    return this.state.items.filter((i) => pids.includes(i.projectId) && !i.archived);
  },

  getVaultByClientId(clientId) {
    const client = this.getClient(clientId);
    if (!client) return [];
    return this.state.vaultEntries.filter((e) =>
      e.clientId === clientId || e.folder === 'Clientes' && (e.service || '').toLowerCase().includes(client.name.toLowerCase())
    );
  },

  addClient(data) {
    const client = clientDefaults(data);
    if (!this.state.clients) this.state.clients = [];
    this.state.clients.push(client);
    this.save();
    return client;
  },

  updateClient(id, updates) {
    const client = this.getClient(id);
    if (!client) return null;
    Object.assign(client, updates);
    if (updates.name) {
      this.state.projects.filter((p) => p.clientId === id).forEach((p) => {
        p.client = updates.name;
        if (updates.email) p.clientEmail = updates.email;
        if (updates.phone) p.clientPhone = updates.phone;
      });
    }
    this.save();
    return client;
  },

  deleteClient(id) {
    this.state.clients = this.state.clients.filter((c) => c.id !== id);
    this.state.projects.forEach((p) => { if (p.clientId === id) p.clientId = null; });
    this.save();
  },

  archiveClient(id) {
    return this.updateClient(id, { archived: true });
  },

  addClientContact(clientId, contact) {
    const client = this.getClient(clientId);
    if (!client) return null;
    const c = { id: uid(), isPrimary: false, ...contact };
    client.contacts.push(c);
    this.save();
    return c;
  },

  updateClientContact(clientId, contactId, updates) {
    const client = this.getClient(clientId);
    const contact = client?.contacts.find((c) => c.id === contactId);
    if (!contact) return null;
    Object.assign(contact, updates);
    this.save();
    return contact;
  },

  deleteClientContact(clientId, contactId) {
    const client = this.getClient(clientId);
    if (!client) return;
    client.contacts = client.contacts.filter((c) => c.id !== contactId);
    this.save();
  },

  getProjectsByArea(areaId, includeArchived = false) {
    return this.state.projects.filter((p) => p.areaId === areaId && (includeArchived || !p.archived));
  },

  getActiveProjects() {
    return this.state.projects.filter((p) => !p.archived);
  },

  getArchivedProjects() {
    return this.state.projects.filter((p) => p.archived);
  },

  getAllTags() {
    const tags = new Set();
    this.state.items.forEach((i) => i.tags.forEach((t) => tags.add(t)));
    return [...tags].sort();
  },

  getItems(filter = {}) {
    let items = this.state.items.filter((i) => !i.archived);

    if (filter.inbox) items = items.filter((i) => i.inbox);
    if (filter.archived) items = this.state.items.filter((i) => i.archived);
    if (filter.pinned) items = items.filter((i) => i.pinned);
    if (filter.areaId) items = items.filter((i) => i.areaId === filter.areaId);
    if (filter.projectId) items = items.filter((i) => i.projectId === filter.projectId);
    if (filter.subContextId) items = items.filter((i) => i.subContextId === filter.subContextId);
    if (filter.type) items = items.filter((i) => i.type === filter.type);
    if (filter.types) items = items.filter((i) => filter.types.includes(i.type));
    if (filter.tag) items = items.filter((i) => i.tags.includes(filter.tag));
    if (filter.contactGroupId) items = items.filter((i) => i.contactGroupId === filter.contactGroupId);
    if (filter.completed !== undefined) items = items.filter((i) => i.completed === filter.completed);
    if (filter.overdue) items = items.filter((i) => Utils.isOverdue(i));
    if (filter.blocked) {
      items = items.filter((i) => /block/i.test(i.kanbanStatus || '') || /block/i.test(i.workStatus || ''));
    }
    if (filter.urgent) items = items.filter((i) => i.priority === 'urgent' || i.priority === 'high');
    if (filter.clientId) {
      const pids = this.state.projects.filter((p) => p.clientId === filter.clientId).map((p) => p.id);
      items = items.filter((i) => pids.includes(i.projectId));
    }
    if (filter.client) {
      const pids = this.state.projects.filter((p) => p.client === filter.client).map((p) => p.id);
      items = items.filter((i) => pids.includes(i.projectId));
    }
    if (filter.focusProject) {
      items = items.filter((i) => i.projectId === this.state.settings.focusProjectId);
    }
    if (filter.snoozed === false) {
      const today = Utils.todayStr();
      items = items.filter((i) => !i.snoozedUntil || i.snoozedUntil <= today);
    }

    if (filter.pipeline) {
      const projectIds = this.state.projects.filter((p) => p.pipeline === filter.pipeline).map((p) => p.id);
      items = items.filter((i) => projectIds.includes(i.projectId));
    }

    if (filter.search) {
      const q = filter.search.toLowerCase();
      items = items.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.body.toLowerCase().includes(q) ||
        i.url?.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q)) ||
        i.contactInfo?.email?.toLowerCase().includes(q) ||
        i.equipmentRef?.toLowerCase().includes(q) ||
        i.projectStage?.toLowerCase().includes(q)
      );
    }

    if (filter.period) {
      const now = new Date();
      items = items.filter((i) => {
        const d = i.dueDate || i.startDate?.slice(0, 10) || i.createdAt.slice(0, 10);
        if (!d) return filter.period === 'all';
        const date = new Date(d);
        if (filter.period === 'day') return date.toDateString() === now.toDateString();
        if (filter.period === 'week') return Utils.isThisWeek(d);
        if (filter.period === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        if (filter.period === 'year') return date.getFullYear() === now.getFullYear();
        return true;
      });
    }

    if (filter.date) {
      items = items.filter((i) => {
        const start = i.startDate?.slice(0, 10);
        const due = i.dueDate;
        const snooze = i.snoozedUntil;
        return start === filter.date || due === filter.date || snooze === filter.date;
      });
    }

    return items.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  },

  addItem(data) {
    const item = itemDefaults(data);
    if (!data.dueDate && data.body) {
      const detected = Utils.detectDueDate(data.title + ' ' + data.body);
      if (detected) item.dueDate = detected;
    }
    if (!data.areaId && (data.title || data.body)) {
      const suggested = Utils.suggestArea((data.title || '') + ' ' + (data.body || ''));
      if (suggested && !data.inbox) item.areaId = suggested;
    }
    this.state.items.unshift(item);
    this.save();
    return item;
  },

  updateItem(id, updates) {
    const item = this.getItem(id);
    if (!item) return null;
    Object.assign(item, updates, { updatedAt: new Date().toISOString() });
    if (updates.areaId !== undefined || updates.projectId !== undefined) {
      item.inbox = !item.areaId && !item.projectId;
    }
    this.save();
    return item;
  },

  deleteItem(id) {
    this.state.items = this.state.items.filter((i) => i.id !== id);
    this.save();
  },

  toggleTask(id) {
    const item = this.getItem(id);
    if (item && (item.type === 'task' || item.type === 'checklist')) {
      if (item.type === 'checklist') return item;
      item.completed = !item.completed;
      if (item.completed) {
        const cols = this.getKanbanColumns();
        item.kanbanStatus = cols.find((c) => /done|feit|complete/i.test(c)) || cols[cols.length - 1];
      }
      item.updatedAt = new Date().toISOString();
      this.save();
    }
    return item;
  },

  toggleChecklistItem(itemId, idx) {
    const item = this.getItem(itemId);
    if (!item?.checklistItems?.[idx]) return;
    item.checklistItems[idx].done = !item.checklistItems[idx].done;
    item.updatedAt = new Date().toISOString();
    this.save();
  },

  togglePin(id) {
    const item = this.getItem(id);
    if (item) { item.pinned = !item.pinned; this.save(); }
    return item;
  },

  archiveItem(id) {
    return this.updateItem(id, { archived: true });
  },

  snoozeItem(id, days = 1) {
    return this.updateItem(id, { snoozedUntil: Utils.addDays(Utils.todayStr(), days), inbox: false });
  },

  addProject(data) {
    const project = projectDefaults(data);
    if (data.clientId) {
      const client = this.getClient(data.clientId);
      if (client) {
        project.client = client.name;
        project.clientEmail = project.clientEmail || client.email;
        project.clientPhone = project.clientPhone || client.phone;
      }
    }
    this.state.projects.push(project);
    this.save();
    return project;
  },

  updateProject(id, updates) {
    const project = this.getProject(id);
    if (!project) return null;
    Object.assign(project, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return project;
  },

  duplicateProject(id) {
    const src = this.getProject(id);
    if (!src) return null;
    const copy = projectDefaults({
      ...src, id: uid(), name: src.name + ' (cópia)', archived: false,
      versions: [], loggedHours: 0,
      wishlist: (src.wishlist || []).map((w) => ({ ...w, id: uid(), done: false })),
      createdAt: new Date().toISOString(),
    });
    this.state.projects.push(copy);
    this.save();
    return copy;
  },

  archiveProject(id) {
    return this.updateProject(id, { archived: true });
  },

  unarchiveProject(id) {
    return this.updateProject(id, { archived: false });
  },

  deleteProject(id) {
    this.state.items = this.state.items.filter((i) => i.projectId !== id);
    this.state.projects = this.state.projects.filter((p) => p.id !== id);
    if (this.state.settings.focusProjectId === id) {
      this.state.settings.focusProjectId = null;
    }
    this.save();
  },

  unarchiveItem(id) {
    return this.updateItem(id, { archived: false });
  },

  addProjectVersion(id, version, notes) {
    const p = this.getProject(id);
    if (!p) return;
    p.versions.push({ version, date: Utils.todayStr(), notes });
    this.save();
  },

  addProjectWishlistItem(projectId, text) {
    const p = this.getProject(projectId);
    const trimmed = text?.trim();
    if (!p || !trimmed) return null;
    if (!p.wishlist) p.wishlist = [];
    const item = { id: uid(), text: trimmed, done: false, createdAt: new Date().toISOString() };
    p.wishlist.push(item);
    p.updatedAt = new Date().toISOString();
    this.save();
    return item;
  },

  toggleProjectWishlistItem(projectId, itemId) {
    const p = this.getProject(projectId);
    const item = p?.wishlist?.find((w) => w.id === itemId);
    if (!item) return;
    item.done = !item.done;
    p.updatedAt = new Date().toISOString();
    this.save();
  },

  removeProjectWishlistItem(projectId, itemId) {
    const p = this.getProject(projectId);
    if (!p?.wishlist) return;
    p.wishlist = p.wishlist.filter((w) => w.id !== itemId);
    p.updatedAt = new Date().toISOString();
    this.save();
  },

  logHours(projectId, hours) {
    const project = this.getProject(projectId);
    if (project) {
      project.loggedHours = (project.loggedHours || 0) + hours;
      this.save();
    }
  },

  addArea(data) {
    const area = { id: uid(), name: data.name, icon: data.icon || '📁', color: data.color || '#00d26a', subContexts: data.subContexts || [] };
    this.state.areas.push(area);
    this.save();
    return area;
  },

  updateArea(id, updates) {
    const area = this.getArea(id);
    if (!area) return null;
    Object.assign(area, updates);
    this.save();
    return area;
  },

  addSubContext(areaId, name, icon = '•') {
    const area = this.getArea(areaId);
    if (!area) return null;
    const ctx = { id: uid(), name, icon };
    area.subContexts.push(ctx);
    this.save();
    return ctx;
  },

  addVaultEntry(entry) {
    const e = {
      id: uid(), favorite: false, folder: entry.folder || 'Geral', clientId: entry.clientId || null,
      expiryDate: entry.expiryDate || null, twoFA: entry.twoFA || '',
      apiKey: entry.apiKey || '', passwordChanged: entry.passwordChanged || null,
      createdAt: new Date().toISOString(), ...entry,
    };
    this.state.vaultEntries.push(e);
    this.save();
    return e;
  },

  updateVaultEntry(id, updates) {
    const entry = this.state.vaultEntries.find((e) => e.id === id);
    if (!entry) return null;
    Object.assign(entry, updates);
    this.save();
    return entry;
  },

  deleteVaultEntry(id) {
    this.state.vaultEntries = this.state.vaultEntries.filter((e) => e.id !== id);
    this.save();
  },

  addSubscription(data) {
    const sub = { id: uid(), ...data };
    this.state.subscriptions.push(sub);
    this.save();
    return sub;
  },

  deleteSubscription(id) {
    this.state.subscriptions = this.state.subscriptions.filter((s) => s.id !== id);
    this.save();
  },

  addSavedSearch(name, filter) {
    this.state.settings.savedSearches.push({ id: uid(), name, filter });
    this.save();
  },

  getStats() {
    const tasks = this.state.items.filter((i) => i.type === 'task' && !i.archived);
    const weekTasks = Store.getItems({ type: 'task', period: 'week' });
    return {
      inbox: this.state.items.filter((i) => i.inbox && !i.archived).length,
      tasksOpen: tasks.filter((t) => !t.completed).length,
      tasksDone: tasks.filter((t) => t.completed).length,
      tasksWeekDone: weekTasks.filter((t) => t.completed).length,
      eventsToday: this.getItems({ period: 'day', types: ['event', 'reminder'] }).length,
      projects: this.getActiveProjects().length,
      overdue: tasks.filter((t) => Utils.isOverdue(t)).length,
      blocked: this.getItems({ blocked: true }).length,
      pinned: this.getItems({ pinned: true }).length,
      contacts: this.getItems({ type: 'contact' }).length,
      links: this.getItems({ type: 'link' }).length,
      hoursLogged: this.state.projects.reduce((s, p) => s + (p.loggedHours || 0), 0),
      subscriptions: this.state.subscriptions.length,
      clients: this.getClients().length,
      clientsActive: this.getClients({ status: 'Active' }).length,
      leads: this.getClients({ status: 'Lead' }).length,
    };
  },

  getWeeklyReview() {
    const weekItems = this.getItems({ period: 'week' });
    const overdue = this.getItems({ overdue: true });
    const inbox = this.getItems({ inbox: true });
    const blocked = this.getItems({ blocked: true });
    const done = weekItems.filter((i) => i.completed);
    return { weekItems, overdue, inbox, blocked, done, open: weekItems.filter((i) => !i.completed && i.type === 'task') };
  },

  extractTasksFromNote(noteId) {
    const note = this.getItem(noteId);
    if (!note || !['note', 'decision'].includes(note.type)) return [];
    const created = [];
    for (const line of note.body.split('\n')) {
      const match = line.match(/^-\s*\[\s*\]\s*(.+)/);
      if (match) {
        created.push(this.addItem({
          type: 'task', areaId: note.areaId, projectId: note.projectId,
          subContextId: note.subContextId, title: match[1].trim(), linkedNoteId: noteId,
        }));
      }
    }
    return created;
  },

  getContactGroups() {
    return this.state.settings.contactGroups || defaultContactGroups();
  },

  getContactGroup(id) {
    return this.getContactGroups().find((g) => g.id === id);
  },

  addContactGroup(data) {
    const g = { id: uid(), name: data.name, icon: data.icon || '👤', color: data.color || '#00d26a' };
    if (!this.state.settings.contactGroups) this.state.settings.contactGroups = defaultContactGroups();
    this.state.settings.contactGroups.push(g);
    this.save();
    return g;
  },

  updateContactGroup(id, updates) {
    const groups = this.getContactGroups();
    const g = groups.find((x) => x.id === id);
    if (!g) return null;
    Object.assign(g, updates);
    this.state.settings.contactGroups = groups;
    this.save();
    return g;
  },

  deleteContactGroup(id) {
    this.state.settings.contactGroups = this.getContactGroups().filter((g) => g.id !== id);
    this.state.items.forEach((i) => {
      if (i.contactGroupId === id) i.contactGroupId = null;
    });
    this.save();
  },

  getEmailAccounts() {
    return this.state.settings.emailAccounts || defaultEmailAccounts();
  },

  getEmailAccount(id) {
    return this.getEmailAccounts().find((a) => a.id === id);
  },

  addEmailAccount(data) {
    const a = {
      id: uid(),
      name: data.name,
      email: data.email,
      icon: data.icon || '✉',
      color: data.color || '#00d26a',
      provider: data.provider || 'gmail',
      gmailAuthIndex: data.gmailAuthIndex != null && data.gmailAuthIndex !== '' ? parseInt(data.gmailAuthIndex, 10) : null,
    };
    if (!this.state.settings.emailAccounts) this.state.settings.emailAccounts = defaultEmailAccounts();
    this.state.settings.emailAccounts.push(a);
    this.save();
    return a;
  },

  updateEmailAccount(id, updates) {
    const accounts = this.getEmailAccounts();
    const a = accounts.find((x) => x.id === id);
    if (!a) return null;
    if (updates.gmailAuthIndex != null && updates.gmailAuthIndex !== '') {
      updates.gmailAuthIndex = parseInt(updates.gmailAuthIndex, 10);
    } else if (updates.gmailAuthIndex === '') {
      updates.gmailAuthIndex = null;
    }
    Object.assign(a, updates);
    this.state.settings.emailAccounts = accounts;
    this.save();
    return a;
  },

  deleteEmailAccount(id) {
    this.state.settings.emailAccounts = this.getEmailAccounts().filter((a) => a.id !== id);
    this.save();
  },

  setEmailGmailToken(id, token, expiresInSeconds = 3600) {
    const a = this.getEmailAccount(id);
    if (!a) return;
    a.gmailAccessToken = token;
    a.gmailTokenExpiry = Date.now() + (expiresInSeconds * 1000);
    this.save();
  },

  clearEmailGmailToken(id) {
    const a = this.getEmailAccount(id);
    if (!a) return;
    delete a.gmailAccessToken;
    delete a.gmailTokenExpiry;
    delete a.gmailPreview;
    delete a.unreadCount;
    delete a.lastFetch;
    this.save();
  },

  setEmailPreview(id, messages, unreadCount) {
    const a = this.getEmailAccount(id);
    if (!a) return;
    a.gmailPreview = messages;
    a.unreadCount = unreadCount;
    a.lastFetch = new Date().toISOString();
    this.save();
  },

  getVaultFolders() {
    return this.state.settings.vaultFolders || defaultVaultFolders();
  },

  getVaultFolder(id) {
    return this.getVaultFolders().find((f) => f.id === id);
  },

  getVaultFolderByName(name) {
    return this.getVaultFolders().find((f) => f.name === name);
  },

  addVaultFolder(data) {
    const f = { id: uid(), name: data.name, icon: data.icon || '🔐', color: data.color || '#00d26a' };
    if (!this.state.settings.vaultFolders) this.state.settings.vaultFolders = defaultVaultFolders();
    this.state.settings.vaultFolders.push(f);
    this.save();
    return f;
  },

  updateVaultFolder(id, updates) {
    const folders = this.getVaultFolders();
    const f = folders.find((x) => x.id === id);
    if (!f) return null;
    const oldName = f.name;
    Object.assign(f, updates);
    if (updates.name && updates.name !== oldName) {
      this.state.vaultEntries.forEach((e) => {
        if (e.folder === oldName) e.folder = updates.name;
      });
    }
    this.state.settings.vaultFolders = folders;
    this.save();
    return f;
  },

  deleteVaultFolder(id) {
    const f = this.getVaultFolder(id);
    if (!f) return;
    this.state.settings.vaultFolders = this.getVaultFolders().filter((x) => x.id !== id);
    this.state.vaultEntries.forEach((e) => {
      if (e.folder === f.name) e.folder = '';
    });
    this.save();
  },

  getQuickTags() {
    return this.state.settings.quickTags || QUICK_TAGS;
  },

  addQuickTag(tag) {
    const t = tag.trim().replace(/^#/, '');
    if (!t) return;
    if (!this.state.settings.quickTags) this.state.settings.quickTags = [...QUICK_TAGS];
    if (!this.state.settings.quickTags.includes(t)) {
      this.state.settings.quickTags.push(t);
      this.save();
    }
  },

  deleteQuickTag(tag) {
    this.state.settings.quickTags = this.getQuickTags().filter((t) => t !== tag);
    this.save();
  },

  _configListDefaults() {
    return {
      kanbanColumns: defaultKanbanColumns,
      projectStages: defaultProjectStages,
      pipelineStages: defaultPipelineStages,
      workStatuses: defaultWorkStatuses,
      clientStatuses: defaultClientStatuses,
      priorities: defaultPriorities,
      paymentStatuses: defaultPaymentStatuses,
      subscriptionCategories: defaultSubscriptionCategories,
    };
  },

  _getConfigList(key) {
    const fn = this._configListDefaults()[key];
    if (!fn) return [];
    const arr = this.state.settings[key];
    return arr?.length ? [...arr] : fn();
  },

  _setConfigList(key, arr) {
    this.state.settings[key] = arr;
    this.save();
  },

  _remapConfigValue(key, oldVal, newVal) {
    const fallback = newVal || this._getConfigList(key)[0];
    switch (key) {
      case 'kanbanColumns':
        this.state.items.forEach((i) => { if (i.kanbanStatus === oldVal) i.kanbanStatus = fallback; });
        break;
      case 'projectStages':
        this.state.items.forEach((i) => { if (i.projectStage === oldVal) i.projectStage = fallback; });
        this.state.projects.forEach((p) => {
          if (p.stages?.length) p.stages = p.stages.map((s) => (s === oldVal ? fallback : s));
        });
        break;
      case 'workStatuses':
        this.state.items.forEach((i) => { if (i.workStatus === oldVal) i.workStatus = fallback; });
        break;
      case 'pipelineStages':
        this.state.projects.forEach((p) => { if (p.pipeline === oldVal) p.pipeline = fallback; });
        break;
      case 'clientStatuses':
        this.state.clients.forEach((c) => { if (c.status === oldVal) c.status = fallback; });
        break;
      case 'paymentStatuses':
        this.state.projects.forEach((p) => { if (p.paymentStatus === oldVal) p.paymentStatus = fallback; });
        break;
      case 'priorities':
        this.state.items.forEach((i) => { if (i.priority === oldVal) i.priority = fallback; });
        break;
      case 'subscriptionCategories':
        this.state.subscriptions.forEach((s) => { if (s.category === oldVal) s.category = fallback; });
        break;
      default:
        break;
    }
  },

  getKanbanColumns() { return this._getConfigList('kanbanColumns'); },
  getProjectStages() { return this._getConfigList('projectStages'); },

  getProjectStagesForProject(projectId) {
    const project = projectId ? this.getProject(projectId) : null;
    if (project?.stages?.length) return [...project.stages];
    return this.getProjectStages();
  },

  getPipelineStages() { return this._getConfigList('pipelineStages'); },
  getWorkStatuses() { return this._getConfigList('workStatuses'); },
  getClientStatuses() { return this._getConfigList('clientStatuses'); },
  getPriorities() { return this._getConfigList('priorities'); },
  getPaymentStatuses() { return this._getConfigList('paymentStatuses'); },
  getSubscriptionCategories() { return this._getConfigList('subscriptionCategories'); },

  addConfigListItem(key, value) {
    const list = this._getConfigList(key);
    const v = value.trim();
    if (!v || list.includes(v)) return false;
    list.push(v);
    this._setConfigList(key, list);
    return true;
  },

  removeConfigListItem(key, value) {
    const list = this._getConfigList(key);
    if (list.length <= 1) return false;
    const filtered = list.filter((x) => x !== value);
    this._remapConfigValue(key, value, filtered[0]);
    this._setConfigList(key, filtered);
    return true;
  },

  renameConfigListItem(key, oldVal, newVal) {
    const list = this._getConfigList(key);
    const v = newVal.trim();
    if (!v || (v !== oldVal && list.includes(v))) return false;
    const idx = list.indexOf(oldVal);
    if (idx === -1) return false;
    list[idx] = v;
    this._remapConfigValue(key, oldVal, v);
    this._setConfigList(key, list);
    return true;
  },

  moveConfigListItem(key, index, delta) {
    const list = this._getConfigList(key);
    const ni = index + delta;
    if (ni < 0 || ni >= list.length) return;
    [list[index], list[ni]] = [list[ni], list[index]];
    this._setConfigList(key, list);
  },

  getWorkspaces() {
    return this.state.settings.workspaces || defaultWorkspaces();
  },

  updateWorkspace(id, updates) {
    const ws = { ...this.getWorkspaces() };
    if (!ws[id]) return null;
    Object.assign(ws[id], updates);
    this.state.settings.workspaces = ws;
    this.save();
    return ws[id];
  },

  toggleWorkspaceArea(wsId, areaId) {
    const ws = this.getWorkspaces()[wsId];
    if (!ws) return;
    const ids = [...(ws.areaIds || [])];
    const idx = ids.indexOf(areaId);
    if (idx >= 0) ids.splice(idx, 1);
    else ids.push(areaId);
    this.updateWorkspace(wsId, { areaIds: ids });
  },

  getLinkCategories() {
    return this.state.settings.linkCategories || defaultLinkCategories();
  },

  getLinkCategory(id) {
    return this.getLinkCategories().find((c) => c.id === id);
  },

  addLinkCategory(data) {
    const c = { id: uid(), name: data.name, icon: data.icon || '🔗', color: data.color || '#00d26a' };
    if (!this.state.settings.linkCategories) this.state.settings.linkCategories = defaultLinkCategories();
    this.state.settings.linkCategories.push(c);
    this.save();
    return c;
  },

  updateLinkCategory(id, updates) {
    const cats = this.getLinkCategories();
    const c = cats.find((x) => x.id === id);
    if (!c) return null;
    Object.assign(c, updates);
    this.state.settings.linkCategories = cats;
    this.save();
    return c;
  },

  deleteLinkCategory(id) {
    this.state.settings.linkCategories = this.getLinkCategories().filter((c) => c.id !== id);
    this.state.items.forEach((i) => {
      if (i.linkCategoryId === id) i.linkCategoryId = null;
    });
    this.save();
  },

  getDisciplines() {
    return this.state.settings.disciplines || defaultDisciplines();
  },

  getDiscipline(id) {
    return this.getDisciplines().find((d) => d.id === id);
  },

  addDiscipline(data) {
    const d = { id: uid(), name: data.name, defaultWeight: parseFloat(data.defaultWeight) || 30 };
    if (!this.state.settings.disciplines) this.state.settings.disciplines = defaultDisciplines();
    this.state.settings.disciplines.push(d);
    this.save();
    return d;
  },

  updateDiscipline(id, updates) {
    const list = this.getDisciplines();
    const d = list.find((x) => x.id === id);
    if (!d) return null;
    if (updates.defaultWeight != null) updates.defaultWeight = parseFloat(updates.defaultWeight) || d.defaultWeight;
    Object.assign(d, updates);
    this.state.settings.disciplines = list;
    this.save();
    return d;
  },

  deleteDiscipline(id) {
    this.state.settings.disciplines = this.getDisciplines().filter((d) => d.id !== id);
    this.save();
  },

  getCustomTemplates() {
    return this.state.settings.customTemplates || [];
  },

  addCustomTemplate(data) {
    const t = {
      id: uid(),
      name: data.name,
      icon: data.icon || '📝',
      type: data.type || 'note',
      title: data.title || data.name,
      body: data.body || '',
      tags: data.tags || [],
      areaId: data.areaId || null,
      checklistItems: data.checklistItems || [],
    };
    if (!this.state.settings.customTemplates) this.state.settings.customTemplates = [];
    this.state.settings.customTemplates.push(t);
    this.save();
    return t;
  },

  deleteCustomTemplate(id) {
    this.state.settings.customTemplates = this.getCustomTemplates().filter((t) => t.id !== id);
    this.save();
  },

  getDashboardWidgets() {
    const defaults = ['banners', 'stats', 'pinned', 'recent', 'dev', 'overdue', 'review'];
    return this.state.settings.dashboardWidgets?.length ? [...this.state.settings.dashboardWidgets] : defaults;
  },

  toggleDashboardWidget(key) {
    const widgets = this.getDashboardWidgets();
    const idx = widgets.indexOf(key);
    if (idx >= 0) {
      if (widgets.length <= 1) return;
      widgets.splice(idx, 1);
    } else {
      widgets.push(key);
    }
    this.state.settings.dashboardWidgets = widgets;
    this.save();
  },

  exportPersonalizationConfig() {
    return {
      contactGroups: this.getContactGroups(),
      vaultFolders: this.getVaultFolders(),
      quickTags: this.getQuickTags(),
      kanbanColumns: this.getKanbanColumns(),
      projectStages: this.getProjectStages(),
      pipelineStages: this.getPipelineStages(),
      workStatuses: this.getWorkStatuses(),
      clientStatuses: this.getClientStatuses(),
      priorities: this.getPriorities(),
      paymentStatuses: this.getPaymentStatuses(),
      workspaces: this.getWorkspaces(),
      linkCategories: this.getLinkCategories(),
      subscriptionCategories: this.getSubscriptionCategories(),
      emailAccounts: this.getEmailAccounts(),
      disciplines: this.getDisciplines(),
      customTemplates: this.getCustomTemplates(),
      dashboardWidgets: this.getDashboardWidgets(),
    };
  },

  importPersonalizationConfig(data) {
    if (!data || typeof data !== 'object') return false;
    const s = this.state.settings;
    if (data.contactGroups?.length) s.contactGroups = data.contactGroups;
    if (data.vaultFolders?.length) s.vaultFolders = data.vaultFolders;
    if (data.quickTags?.length) s.quickTags = data.quickTags;
    if (data.kanbanColumns?.length) s.kanbanColumns = data.kanbanColumns;
    if (data.projectStages?.length) s.projectStages = data.projectStages;
    if (data.pipelineStages?.length) s.pipelineStages = data.pipelineStages;
    if (data.workStatuses?.length) s.workStatuses = data.workStatuses;
    if (data.clientStatuses?.length) s.clientStatuses = data.clientStatuses;
    if (data.priorities?.length) s.priorities = data.priorities;
    if (data.paymentStatuses?.length) s.paymentStatuses = data.paymentStatuses;
    if (data.workspaces) s.workspaces = data.workspaces;
    if (data.linkCategories?.length) s.linkCategories = data.linkCategories;
    if (data.subscriptionCategories?.length) s.subscriptionCategories = data.subscriptionCategories;
    if (data.emailAccounts?.length) s.emailAccounts = data.emailAccounts;
    if (data.disciplines?.length) s.disciplines = data.disciplines;
    if (data.customTemplates) s.customTemplates = data.customTemplates;
    if (data.dashboardWidgets?.length) s.dashboardWidgets = data.dashboardWidgets;
    this.save();
    return true;
  },

  clearInboxStreak() {
    if (this.getItems({ inbox: true }).length === 0) {
      this.state.settings.inboxStreak = (this.state.settings.inboxStreak || 0) + 1;
      this.save();
    }
  },

  addGrade(data) {
    const g = { id: uid(), subject: data.subject, weight: parseFloat(data.weight) || 1, grade: parseFloat(data.grade), semester: data.semester || '' };
    if (!this.state.grades) this.state.grades = [];
    this.state.grades.push(g);
    this.save();
    return g;
  },

  deleteGrade(id) {
    this.state.grades = (this.state.grades || []).filter((g) => g.id !== id);
    this.save();
  },

  startTimer(itemId) {
    const item = this.getItem(itemId);
    this.state.settings.activeTimer = { itemId, startedAt: Date.now(), projectId: item?.projectId || null };
    this.save();
  },

  stopTimer() {
    const t = this.state.settings.activeTimer;
    if (!t) return 0;
    const startedAt = Number(t.startedAt);
    const hours = (Date.now() - startedAt) / 3600000;
    const item = this.getItem(t.itemId);
    if (item) this.updateItem(item.id, { hoursLogged: (item.hoursLogged || 0) + hours });
    if (t.projectId) this.logHours(t.projectId, hours);
    this.state.settings.activeTimer = null;
    this.save();
    return hours;
  },

  cancelTimer() {
    if (!this.state.settings.activeTimer) return false;
    this.state.settings.activeTimer = null;
    this.save();
    return true;
  },

  getTimerElapsed() {
    const t = this.state.settings.activeTimer;
    if (!t) return 0;
    return (Date.now() - Number(t.startedAt)) / 1000;
  },

  getActiveTimerItem() {
    const t = this.state.settings.activeTimer;
    return t ? this.getItem(t.itemId) : null;
  },
};

Store.init();
