const App = {
  currentView: 'dashboard',
  filters: { areaId: null, period: 'all', calMode: 'both', projectId: null, subContextId: null, tag: null },
  calendarDate: new Date(),
  selectedCalDay: null,
  calView: 'month',
  projectDetailId: null,
  projectTab: 'overview',
  projectFilter: 'active',
  projectItemFilter: 'all',
  projectItemTypeFilter: null,
  projectStageFilter: null,
  projectStageFilterNone: '__none__',
  projectItemSort: 'date-desc',
  currentHub: 'home',
  taskFilter: 'all',
  clientDetailId: null,
  clientTab: 'overview',
  clientFilter: 'all',
  clientSearch: '',
  searchQuery: '',
  searchType: '',
  vaultFolder: 'all',
  inboxFilters: {
    type: 'all',
    priority: 'all',
    tag: null,
    timeRange: 'all',
    pickDate: '',
    pickMonth: '',
    pickYear: '',
  },
  archiveFilters: {
    timeRange: 'all',
    pickDate: '',
    pickMonth: '',
    pickYear: '',
  },
  workspace: null,
  toolsTab: 'calc',
  contactFilter: 'all',
  contactSearch: '',
  emailFilter: 'all',
  personalizationTab: 'vault',
  areaFiltersCollapsed: false,
  timelineShowDone: false,
  timelineExpandedDays: {},
  _tickInterval: null,

  init() {
    this.applyTheme(Store.state.settings.theme || 'dark');
    this.applyAccessibility();
    Object.assign(this, AppViews, AppModals);
    this.bindGlobalEvents();
    AppUpdate.init();
    CloudSync.init();
    I18n.apply();
    AppShell.bindEvents();
    this.bindContentDelegation();
    this.bindFilterBarDelegation();
    this.offerClearDemoIfNeeded();
    this.renderWorkspaceBar();
    this.renderAreaFilters();
    this.bindAreaFiltersToggle();
    this.updateBadges();
    this.startTickers();
    this.navigate('dashboard', { skipTransition: true });
  },

  offerClearDemoIfNeeded() {
    if (!Store.state.settings?.fullDemoLoaded) return;
    if (sessionStorage.getItem('candeias_demo_prompt_done')) return;
    sessionStorage.setItem('candeias_demo_prompt_done', '1');
    setTimeout(() => {
      if (confirm('This app still has example data (Siemens tasks, demo clients, etc.).\n\nRemove ALL examples and start empty to personalize?')) {
        Store.clearAllData();
        this.renderWorkspaceBar();
        this.renderAreaFilters();
        this.refresh();
      }
    }, 600);
  },

  startTickers() {
    if (this._tickInterval) clearInterval(this._tickInterval);
    this._tickInterval = setInterval(() => {
      Pomodoro.tick();
      if (Store.state.settings.activeTimer || Pomodoro.state().running) {
        if (['tasks', 'today', 'tools', 'dashboard', 'overdue'].includes(this.currentView)) this.render();
        this.renderWorkspaceBar();
      }
    }, 1000);
  },

  getActiveAreaIds() {
    if (this.filters.areaId) return [this.filters.areaId];
    if (this.workspace) {
      const ws = Store.getWorkspaces()[this.workspace];
      if (ws?.areaIds?.length) return ws.areaIds;
    }
    return null;
  },

  itemMatchesScope(item, { includeInbox = false } = {}) {
    const ids = this.getActiveAreaIds();
    if (!ids) return true;
    if (item.inbox && !item.areaId && !item.projectId) {
      return includeInbox || this.currentView === 'inbox';
    }
    let areaId = item.areaId;
    if (!areaId && item.projectId) {
      areaId = Store.getProject(item.projectId)?.areaId || null;
    }
    return !!(areaId && ids.includes(areaId));
  },

  filterItems(items, opts = {}) {
    if (!this.getActiveAreaIds()) return items;
    return items.filter((i) => this.itemMatchesScope(i, opts));
  },

  filterProjects(projects) {
    const ids = this.getActiveAreaIds();
    if (!ids) return projects;
    return projects.filter((p) => ids.includes(p.areaId));
  },

  getFilteredItems(filter = {}, opts = {}) {
    return this.filterItems(Store.getItems(filter), opts);
  },

  getFilteredStats() {
    const items = this.filterItems(Store.state.items.filter((i) => !i.archived));
    const tasks = items.filter((i) => i.type === 'task');
    const weekTasks = this.filterItems(Store.getItems({ type: 'task', period: 'week' }));
    const projects = this.filterProjects(Store.getActiveProjects());
    return {
      inbox: items.filter((i) => i.inbox).length,
      tasksOpen: tasks.filter((t) => !t.completed).length,
      tasksDone: tasks.filter((t) => t.completed).length,
      tasksWeekDone: weekTasks.filter((t) => t.completed).length,
      eventsToday: this.filterItems(Store.getItems({ period: 'day', types: ['event', 'reminder'] })).length,
      projects: projects.length,
      overdue: tasks.filter((t) => Utils.isOverdue(t)).length,
      blocked: this.filterItems(Store.getItems({ blocked: true })).length,
      pinned: this.filterItems(Store.getItems({ pinned: true })).length,
      contacts: this.filterItems(Store.getItems({ type: 'contact' })).length,
      links: this.filterItems(Store.getItems({ type: 'link' })).length,
      hoursLogged: Utils.fmtHours(projects.reduce((s, p) => s + (p.loggedHours || 0), 0)),
      subscriptions: Store.state.subscriptions.length,
      clients: Store.getClients().length,
      clientsActive: Store.getClients({ status: 'Active' }).length,
      leads: Store.getClients({ status: 'Lead' }).length,
    };
  },

  getFilteredWeeklyReview() {
    const r = Store.getWeeklyReview();
    return {
      done: this.filterItems(r.done),
      open: this.filterItems(r.open),
      inbox: this.filterItems(r.inbox, { includeInbox: true }),
      overdue: this.filterItems(r.overdue),
      blocked: this.filterItems(r.blocked),
      weekItems: this.filterItems(r.weekItems),
    };
  },

  scopeFilterLabel() {
    if (this.filters.areaId) {
      const area = Store.getArea(this.filters.areaId);
      return area ? `${area.icon} ${area.name}` : null;
    }
    if (this.workspace) {
      const ws = Store.getWorkspaces()[this.workspace];
      return ws ? `${ws.icon} ${ws.label}` : null;
    }
    return null;
  },

  renderScopeBanner() {
    const label = this.scopeFilterLabel();
    if (!label) return '';
    return `<div class="info-banner">Showing only: <strong>${Utils.esc(label)}</strong></div>`;
  },

  /** @deprecated use filterItems */
  filterByWorkspace(items) {
    return this.filterItems(items);
  },

  renderWorkspaceBar() {
    const bar = document.getElementById('workspace-bar');
    if (!bar) return;
    const workspaces = Store.getWorkspaces();
    const pom = Pomodoro.state();
    const timer = Store.state.settings.activeTimer;
    let extra = '';
    if (timer) {
      const sec = Store.getTimerElapsed();
      const item = Store.getActiveTimerItem();
      const label = item ? Utils.esc(item.title) : I18n.t('timer.task');
      extra = `<button type="button" class="workspace-timer" data-action="stop-timer" title="${I18n.t('timer.stopHint')}">⏱ ${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')} · ${label}</button>
        <button type="button" class="workspace-timer-cancel" data-action="cancel-timer" title="${I18n.t('timer.cancelHint')}">✕</button>`;
    } else if (pom.running) {
      extra = `<button type="button" class="workspace-timer" data-action="pomodoro-stop" title="${I18n.t('timer.pomodoroStop')}">🍅 ${Pomodoro.fmt(Pomodoro.remainingSec())}</button>`;
    }
    bar.innerHTML = `
      <button class="workspace-chip ${!this.workspace ? 'active' : ''}" data-workspace="">All</button>
      ${Object.entries(workspaces).map(([k, w]) => `<button class="workspace-chip ${this.workspace === k ? 'active' : ''}" data-workspace="${k}">${w.icon} ${w.label}</button>`).join('')}
      ${extra}`;
    bar.querySelectorAll('[data-workspace]').forEach((el) => {
      el.addEventListener('click', () => {
        this.workspace = el.dataset.workspace || null;
        if (this.workspace && this.filters.areaId) {
          const ids = Store.getWorkspaces()[this.workspace]?.areaIds || [];
          if (!ids.includes(this.filters.areaId)) this.filters.areaId = null;
        }
        this.renderAreaFilters();
        this.renderWorkspaceBar();
        this.refresh();
      });
    });
    bar.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleAction(el.dataset.action, el.dataset);
      });
    });
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    Store.state.settings.theme = theme;
    Store.save();
  },

  applyAccessibility() {
    const a11y = { ...DEFAULT_ACCESSIBILITY, ...(Store.state.settings.accessibility || {}) };
    Store.state.settings.accessibility = a11y;
    const root = document.documentElement;
    Object.keys(DEFAULT_ACCESSIBILITY).forEach((key) => {
      root.setAttribute(`data-a11y-${key}`, a11y[key] ? '1' : '0');
    });
    const hints = document.getElementById('keyboard-hints');
    if (hints) hints.classList.toggle('hidden', !a11y.keyboardHints);
  },

  getCalItemsForDate(dateStr) {
    const schedule = Store.state.settings.schoolSchedule;
    const schoolItems = schedule?.enabled ? SchoolSchedule.getForDate(dateStr, schedule) : [];
    let items = Store.getItems({ date: dateStr });
    const mode = this.filters.calMode;
    if (mode === 'school') return schoolItems;
    if (mode === 'events') return items.filter((i) => ['event', 'reminder'].includes(i.type));
    if (mode === 'tasks') return items.filter((i) => i.type === 'task');
    if (schedule?.enabled && schedule.showInCalendar !== false) items = [...items, ...schoolItems];
    return this.filterByWorkspace(items);
  },

  refresh() {
    this.render();
    this.renderAreaFilters();
    this.renderWorkspaceBar();
    this.updateBadges();
    AppShell.render();
    if (['tasks', 'calendar', 'timeline', 'inbox', 'contacts', 'archive'].includes(this.currentView)) this.renderFilterBar();
  },

  updateNavLayout() {
    const menuBtn = document.getElementById('btn-menu');
    const isPhone = window.innerWidth <= 767;
    if (menuBtn) menuBtn.classList.toggle('hidden', !isPhone);
    if (!isPhone) this._closeSidebar?.();
  },

  bindGlobalEvents() {
    document.getElementById('btn-quick-capture').addEventListener('click', () => this.openQuickCapture());
    document.getElementById('btn-ai-capture')?.addEventListener('click', () => this.openAiAssistant());
    document.getElementById('btn-add').addEventListener('click', () => this.openAddMenu());
    document.getElementById('search-trigger').addEventListener('click', () => this.openCommandPalette());
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); this.openCommandPalette(); }
      if (e.key === 'Escape') {
        if (document.getElementById('attachment-viewer')?.classList.contains('open')) {
          this.closeAttachmentViewer();
          return;
        }
        this.closeModal();
      }
    });
    const menuBtn = document.getElementById('btn-menu');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const closeSidebar = () => {
      sidebar?.classList.remove('open');
      backdrop?.classList.remove('open');
    };
    this.updateNavLayout();
    window.addEventListener('resize', () => this.updateNavLayout());
    menuBtn?.addEventListener('click', () => {
      const open = sidebar?.classList.toggle('open');
      backdrop?.classList.toggle('open', !!open);
    });
    backdrop?.addEventListener('click', closeSidebar);
    this._closeSidebar = closeSidebar;
    this.bindModalRootEvents();
  },

  bindModalRootEvents() {
    const root = document.getElementById('modal-root');
    if (!root || root.dataset.bound) return;
    root.dataset.bound = '1';
    root.addEventListener('click', (e) => {
      const overlay = document.getElementById('modal-overlay');
      if (overlay && e.target === overlay) {
        this.closeModal();
        return;
      }
      const el = e.target.closest('[data-action]');
      if (!el || !root.contains(el)) return;
      const action = el.dataset.action;
      if (action === 'close-modal') {
        e.preventDefault();
        this.closeModal();
        return;
      }
      if (action === 'add-pick') {
        e.preventDefault();
        this.closeModal();
        this.handleAddPick(el.dataset);
        return;
      }
      if (['extract-tasks', 'delete-item-modal', 'delete-client-modal', 'open-attachment'].includes(action)) {
        e.preventDefault();
        e.stopPropagation();
        this.handleAction(action, el.dataset);
      }
    });
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action="close-attachment-viewer"], [data-action="download-attachment"], [data-action="open-attachment-external"]');
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      this.handleAction(el.dataset.action, el.dataset);
    });
  },

  navigate(view, opts = {}) {
    const source = opts.source || 'none';
    const prevView = this.currentView;
    const prevHub = this.currentHub || AppShell.viewToHub(prevView);
    const preferHub = (source === 'tab' || source === 'hub') ? this.currentHub : null;
    const newHub = AppShell.viewToHub(view, preferHub);

    const apply = () => {
      this.currentView = view;
      this.currentHub = newHub;
      if (view !== 'clients') this.clientDetailId = null;
      if (view !== 'projects') this.projectDetailId = null;
      const titles = {
        dashboard: ['view.dashboard', 'view.dashboard.sub'],
        inbox: ['view.inbox', 'view.inbox.sub'],
        today: ['view.today', 'view.today.sub'],
        calendar: ['view.calendar', 'view.calendar.sub'],
        timeline: ['view.timeline', 'view.timeline.sub'],
        tasks: ['view.tasks', 'view.tasks.sub'],
        overdue: ['view.overdue', 'view.overdue.sub'],
        pinned: ['view.pinned', 'view.pinned.sub'],
        blocked: ['view.blocked', 'view.blocked.sub'],
        projects: ['view.projects', 'view.projects.sub'],
        kanban: ['view.kanban', 'view.kanban.sub'],
        clients: ['view.clients', 'view.clients.sub'],
        vault: ['view.vault', 'view.vault.sub'],
        contacts: ['view.contacts', 'view.contacts.sub'],
        emails: ['view.emails', 'view.emails.sub'],
        links: ['view.links', 'view.links.sub'],
        subscriptions: ['view.subscriptions', 'view.subscriptions.sub'],
        templates: ['view.templates', 'view.templates.sub'],
        tools: ['view.tools', 'view.tools.sub'],
        review: ['view.review', 'view.review.sub'],
        stats: ['view.stats', 'view.stats.sub'],
        archive: ['view.archive', 'view.archive.sub'],
        areas: ['view.areas', 'view.areas.sub'],
        settings: ['view.settings', 'view.settings.sub'],
        personalization: ['view.personalization', 'view.personalization.sub'],
        accessibility: ['view.accessibility', 'view.accessibility.sub'],
        search: ['view.search', 'view.search.sub'],
      };
      const [titleKey, subKey] = titles[view] || ['', ''];
      document.getElementById('view-title').textContent = titleKey ? I18n.t(titleKey) : 'Candeias';
      document.getElementById('view-subtitle').textContent = subKey ? I18n.t(subKey) : '';
      const filterBar = document.getElementById('filter-bar');
      if (['tasks', 'calendar', 'timeline', 'inbox', 'contacts', 'emails', 'archive'].includes(view)) {
        filterBar.classList.remove('hidden');
        this.renderFilterBar();
      } else filterBar.classList.add('hidden');
      this.render();
      this.updateBadges();
      this.renderWorkspaceBar();
      AppShell.render();
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-backdrop')?.classList.remove('open');
    };

    if (view === prevView && !opts.force) {
      if (view === 'projects' && opts.projectId && opts.projectId !== this.projectDetailId) {
        this.openProject(opts.projectId);
        return;
      }
      return;
    }

    const kind = opts.skipTransition
      ? null
      : AppShell.transitionKind(prevView, view, prevHub, newHub, source);

    AppShell.runTransition(kind, apply);
  },

  filterInboxItems(items) {
    const f = this.inboxFilters;
    let result = items;
    if (f.type !== 'all') result = result.filter((i) => i.type === f.type);
    if (f.priority !== 'all') result = result.filter((i) => i.priority === f.priority);
    if (f.tag) result = result.filter((i) => i.tags.includes(f.tag));
    if (f.pickDate) {
      result = result.filter((i) => i.createdAt.slice(0, 10) === f.pickDate);
    } else if (f.pickMonth) {
      result = result.filter((i) => i.createdAt.slice(0, 7) === f.pickMonth);
    } else if (f.pickYear) {
      result = result.filter((i) => i.createdAt.slice(0, 4) === String(f.pickYear));
    } else if (f.timeRange !== 'all') {
      const now = new Date();
      result = result.filter((i) => {
        const d = i.createdAt.slice(0, 10);
        const date = new Date(d + 'T12:00:00');
        if (f.timeRange === 'today') return d === Utils.todayStr();
        if (f.timeRange === 'week') return Utils.isThisWeek(d);
        if (f.timeRange === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        if (f.timeRange === 'year') return date.getFullYear() === now.getFullYear();
        return true;
      });
    }
    return result;
  },

  archiveDateStr(entry) {
    return (entry.updatedAt || entry.createdAt || '').slice(0, 10);
  },

  filterArchiveByDate(entries) {
    const f = this.archiveFilters;
    if (f.pickDate) {
      return entries.filter((e) => this.archiveDateStr(e) === f.pickDate);
    }
    if (f.pickMonth) {
      return entries.filter((e) => (e.updatedAt || e.createdAt || '').slice(0, 7) === f.pickMonth);
    }
    if (f.pickYear) {
      return entries.filter((e) => (e.updatedAt || e.createdAt || '').slice(0, 4) === String(f.pickYear));
    }
    if (f.timeRange === 'all') return entries;
    const now = new Date();
    return entries.filter((e) => {
      const d = this.archiveDateStr(e);
      if (!d) return false;
      const date = new Date(`${d}T12:00:00`);
      if (f.timeRange === 'today') return d === Utils.todayStr();
      if (f.timeRange === 'week') return Utils.isThisWeek(d);
      if (f.timeRange === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      if (f.timeRange === 'year') return date.getFullYear() === now.getFullYear();
      return true;
    });
  },

  hasArchiveDateFilters() {
    const f = this.archiveFilters;
    return f.timeRange !== 'all' || !!f.pickDate || !!f.pickMonth || !!f.pickYear;
  },

  filterProjectItems(items) {
    const f = this.projectItemFilter || 'all';
    if (f === 'open') items = items.filter((i) => i.type === 'task' || i.type === 'checklist' ? !i.completed : true);
    else if (f === 'done') items = items.filter((i) => (i.type === 'task' || i.type === 'checklist') && i.completed);
    else if (f === 'overdue') items = items.filter((i) => Utils.isOverdue(i));
    else if (f === 'urgent') items = items.filter((i) => i.priority === 'urgent' || i.priority === 'high');
    if (this.projectItemTypeFilter) {
      items = items.filter((i) => i.type === this.projectItemTypeFilter);
    }
    if (this.projectStageFilter === this.projectStageFilterNone) {
      items = items.filter((i) => !Store.itemHasAnyProjectStage(i));
    } else if (this.projectStageFilter) {
      items = items.filter((i) => Store.itemHasProjectStage(i, this.projectStageFilter));
    }
    return items;
  },

  sortProjectItems(items) {
    const sort = this.projectItemSort || 'date-desc';
    const priorityRank = { urgent: 0, high: 1, normal: 2, low: 3 };
    return [...items].sort((a, b) => {
      if (sort === 'urgency') {
        const pa = priorityRank[a.priority] ?? 2;
        const pb = priorityRank[b.priority] ?? 2;
        if (pa !== pb) return pa - pb;
        return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
      }
      if (sort === 'title') return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
      if (sort === 'due') {
        const da = a.dueDate || '9999-12-31';
        const db = b.dueDate || '9999-12-31';
        if (da !== db) return da.localeCompare(db);
        return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
      }
      const ta = a.updatedAt || a.createdAt || '';
      const tb = b.updatedAt || b.createdAt || '';
      return sort === 'date-asc' ? ta.localeCompare(tb) : tb.localeCompare(ta);
    });
  },

  renderProjectTypeFilters() {
    const types = [['', 'project.filter.all'], ...Object.keys(ITEM_TYPES).map((k) => [k, k])];
    return `<div class="filter-row mb project-type-filters">
      ${types.map(([type, key]) => {
        const active = (type === '' && !this.projectItemTypeFilter) || this.projectItemTypeFilter === type;
        const label = type === '' ? I18n.t('project.filter.all') : Utils.typeLabel(type);
        const icon = type ? Utils.typeIcon(type) : '';
        return `<button class="filter-chip ${active ? 'active' : ''}" data-action="proj-item-type-filter" data-type="${type}">${icon ? `${icon} ` : ''}${Utils.esc(label)}</button>`;
      }).join('')}
    </div>`;
  },

  normalizeProjectTab(tab) {
    return tab || 'overview';
  },

  getProjectTabTypes(tab) {
    const map = {
      notes: ['note', 'decision', 'idea', 'document'],
      tasks: ['task', 'checklist'],
      events: ['event', 'reminder'],
      contacts: ['contact'],
      links: ['link'],
    };
    return map[tab] || null;
  },

  isProjectItemListTab(tab) {
    return tab === 'items' || !!this.getProjectTabTypes(tab);
  },

  projectTypeTab(type) {
    const map = {
      note: 'notes', decision: 'notes', idea: 'notes', document: 'notes',
      task: 'tasks', checklist: 'tasks',
      event: 'events', reminder: 'events',
      contact: 'contacts',
      link: 'links',
    };
    return map[type] || 'items';
  },

  renderProjectItemFilters() {
    const filters = [
      ['all', 'project.filter.all'],
      ['open', 'project.filter.open'],
      ['done', 'project.filter.done'],
      ['overdue', 'project.filter.overdue'],
      ['urgent', 'project.filter.urgent'],
    ];
    const sorts = [
      ['date-desc', 'project.sort.newest'],
      ['date-asc', 'project.sort.oldest'],
      ['due', 'project.sort.due'],
      ['urgency', 'project.sort.urgency'],
      ['title', 'project.sort.title'],
    ];
    return `<div class="filter-row mb">
      ${filters.map(([f, key]) => `<button class="filter-chip ${this.projectItemFilter === f ? 'active' : ''}" data-action="proj-item-filter" data-filter="${f}">${I18n.t(key)}</button>`).join('')}
      <span class="filter-sep"></span>
      ${sorts.map(([s, key]) => `<button class="filter-chip ${this.projectItemSort === s ? 'active' : ''}" data-action="proj-item-sort" data-sort="${s}">${I18n.t(key)}</button>`).join('')}
    </div>`;
  },

  renderProjectStageFilters(projectId) {
    const stages = Store.getProjectStagesForProject(projectId);
    if (!stages.length) return '';
    return `<div class="filter-row mb">
      <span class="muted sm">${I18n.t('project.stagesFilter')}:</span>
      <button class="filter-chip ${!this.projectStageFilter ? 'active' : ''}" data-action="proj-stage-filter" data-stage="">${I18n.t('project.filter.all')}</button>
      <button class="filter-chip ${this.projectStageFilter === this.projectStageFilterNone ? 'active' : ''}" data-action="proj-stage-filter" data-stage="${this.projectStageFilterNone}">${I18n.t('project.stageGeneral')}</button>
      ${stages.map((s) => `<button class="filter-chip ${this.projectStageFilter === s ? 'active' : ''}" data-action="proj-stage-filter" data-stage="${Utils.esc(s)}">${Utils.esc(s)}</button>`).join('')}
    </div>`;
  },

  renderFilterBar() {
    const bar = document.getElementById('filter-bar');
    if (this.currentView === 'tasks') {
      bar.innerHTML = `
        ${['all', 'overdue', 'urgent', 'blocked'].map((f) => `<button class="filter-chip ${this.taskFilter === f ? 'active' : ''}" data-task-filter="${f}">${{ all: 'All', overdue: 'Overdue', urgent: 'Urgent', blocked: 'Blocked' }[f]}</button>`).join('')}
        <span class="filter-sep"></span>
        ${['all', 'day', 'week', 'month', 'year'].map((p) => `<button class="filter-chip ${this.filters.period === p ? 'active' : ''}" data-period="${p}">${{ all: 'All', day: 'Today', week: 'Week', month: 'Month', year: 'Year' }[p]}</button>`).join('')}
        <span class="filter-sep"></span>
        <button class="filter-chip ${!this.filters.tag ? 'active' : ''}" data-tag="">Tags</button>
        ${Store.getAllTags().slice(0, 8).map((t) => `<button class="filter-chip ${this.filters.tag === t ? 'active' : ''}" data-tag="${Utils.esc(t)}">#${Utils.esc(t)}</button>`).join('')}`;
    } else if (this.currentView === 'calendar') {
      const finUrl = Store.state.settings.fincontrolUrl || FINCONTROL_DEFAULT_URL;
      bar.innerHTML = `
        ${['month', 'week', 'agenda'].map((v) => `<button class="filter-chip ${this.calView === v ? 'active' : ''}" data-calview="${v}">${{ month: 'Month', week: 'Week', agenda: 'Agenda' }[v]}</button>`).join('')}
        <span class="filter-sep"></span>
        ${['both', 'events', 'tasks', 'school'].map((m) => `<button class="filter-chip ${this.filters.calMode === m ? 'active' : ''}" data-calmode="${m}">${{ both: 'Both', events: 'Events', tasks: 'Tasks', school: '🏫 School' }[m]}</button>`).join('')}
        <span class="filter-sep"></span>
        <button class="filter-chip" data-action="edit-school-schedule" title="Edit weekly schedule">✏ Schedule</button>
        <a class="filter-chip fincontrol-link" href="${Utils.esc(finUrl)}" target="_blank" rel="noopener" title="Open FinControl">💶 FinControl</a>`;
    } else if (this.currentView === 'timeline') {
      bar.innerHTML = `
        <button class="filter-chip ${!this.timelineShowDone ? 'active' : ''}" data-tl-show="open">${I18n.t('timeline.filter.open')}</button>
        <button class="filter-chip ${this.timelineShowDone ? 'active' : ''}" data-tl-show="all">${I18n.t('timeline.filter.all')}</button>
        <span class="filter-sep"></span>
        <span class="muted sm">${I18n.t('timeline.filter.hint')}</span>`;
    } else if (this.currentView === 'inbox') {
      const f = this.inboxFilters;
      const inboxTags = [...new Set(Store.getItems({ inbox: true }).flatMap((i) => i.tags))].slice(0, 6);
      bar.innerHTML = `
        ${[
          ['all', 'All'], ['note', 'Notes'], ['task', 'Tasks'], ['idea', 'Ideas'],
          ['link', 'Links'], ['reminder', 'Reminders'],
        ].map(([k, label]) => `<button class="filter-chip ${f.type === k ? 'active' : ''}" data-inbox-type="${k}">${label}</button>`).join('')}
        <span class="filter-sep"></span>
        ${[
          ['all', 'Priority'], ['urgent', 'Urgent'], ['high', 'High'], ['normal', 'Normal'], ['low', 'Low'],
        ].map(([k, label]) => `<button class="filter-chip ${f.priority === k ? 'active' : ''}" data-inbox-priority="${k}">${label}</button>`).join('')}
        <span class="filter-sep"></span>
        ${[
          ['all', 'Any time'], ['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year'],
        ].map(([k, label]) => `<button class="filter-chip ${f.timeRange === k && !f.pickDate && !f.pickMonth && !f.pickYear ? 'active' : ''}" data-inbox-time="${k}">${label}</button>`).join('')}
        <span class="filter-sep"></span>
        <label class="filter-date-wrap" title="Pick day"><span class="muted sm">Day</span>
          <input type="date" class="filter-date-input" id="inbox-pick-date" value="${f.pickDate}"></label>
        <label class="filter-date-wrap" title="Pick month"><span class="muted sm">Month</span>
          <input type="month" class="filter-date-input" id="inbox-pick-month" value="${f.pickMonth}"></label>
        <label class="filter-date-wrap" title="Pick year"><span class="muted sm">Year</span>
          <input type="number" class="filter-date-input year" id="inbox-pick-year" placeholder="2026" min="2020" max="2035" value="${f.pickYear || ''}"></label>
        ${f.pickDate || f.pickMonth || f.pickYear ? `<button class="filter-chip" data-inbox-clear-time>✕ Clear date</button>` : ''}
        ${inboxTags.length ? `<span class="filter-sep"></span>` : ''}
        ${inboxTags.map((t) => `<button class="filter-chip ${f.tag === t ? 'active' : ''}" data-inbox-tag="${Utils.esc(t)}">#${Utils.esc(t)}</button>`).join('')}`;
    } else if (this.currentView === 'contacts') {
      const groups = Store.getContactGroups();
      bar.innerHTML = `
        <button class="filter-chip ${this.contactFilter === 'all' ? 'active' : ''}" data-contact-group="all">All</button>
        ${groups.map((g) => `<button class="filter-chip ${this.contactFilter === g.id ? 'active' : ''}" data-contact-group="${g.id}" style="border-color:${this.contactFilter === g.id ? g.color : ''}">${g.icon} ${Utils.esc(g.name)}</button>`).join('')}
        <span class="filter-sep"></span>
        <input type="search" class="filter-date-input contact-search" id="contact-search" placeholder="Search name, email, company…" value="${Utils.esc(this.contactSearch)}">
        <button class="filter-chip" data-action="manage-contact-groups">⚙ Groups</button>`;
    } else if (this.currentView === 'emails') {
      const accounts = Store.getEmailAccounts();
      bar.innerHTML = `
        <button class="filter-chip ${this.emailFilter === 'all' ? 'active' : ''}" data-email-filter="all">All</button>
        ${accounts.map((a) => `<button class="filter-chip ${this.emailFilter === a.id ? 'active' : ''}" data-email-filter="${a.id}" style="border-color:${this.emailFilter === a.id ? a.color : ''}">${a.icon} ${Utils.esc(a.name)}${a.unreadCount > 0 ? ` (${a.unreadCount})` : ''}</button>`).join('')}
        <span class="filter-sep"></span>
        <button class="filter-chip" data-action="manage-email-accounts">⚙ Accounts</button>
        <button class="filter-chip" data-action="refresh-all-gmail">↻ Refresh all</button>`;
    } else if (this.currentView === 'archive') {
      const f = this.archiveFilters;
      bar.innerHTML = `
        ${[
          ['all', 'Any time'], ['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year'],
        ].map(([k, label]) => `<button class="filter-chip ${f.timeRange === k && !f.pickDate && !f.pickMonth && !f.pickYear ? 'active' : ''}" data-archive-time="${k}">${label}</button>`).join('')}
        <span class="filter-sep"></span>
        <label class="filter-date-wrap" title="Pick day"><span class="muted sm">Day</span>
          <input type="date" class="filter-date-input" id="archive-pick-date" value="${f.pickDate}"></label>
        <label class="filter-date-wrap" title="Pick month"><span class="muted sm">Month</span>
          <input type="month" class="filter-date-input" id="archive-pick-month" value="${f.pickMonth}"></label>
        <label class="filter-date-wrap" title="Pick year"><span class="muted sm">Year</span>
          <input type="number" class="filter-date-input year" id="archive-pick-year" placeholder="2026" min="2020" max="2035" value="${f.pickYear || ''}"></label>
        ${f.pickDate || f.pickMonth || f.pickYear ? `<button class="filter-chip" data-archive-clear-time>✕ Clear date</button>` : ''}
        ${this.hasArchiveDateFilters() ? `<span class="filter-sep"></span><button class="filter-chip" data-action="clear-archive-filters">Clear filters</button>` : ''}`;
    }
  },

  bindFilterBar() {
    /* Delegação em bindFilterBarDelegation — chamado uma vez no init. */
  },

  filterCalItems(items) {
    return items;
  },

  promptAddSubscription() {
    const name = prompt('Name?');
    const amount = prompt('Amount €?');
    const cats = Store.getSubscriptionCategories();
    const catPick = prompt(`Category?\n${cats.map((c, i) => `${i + 1}. ${c}`).join('\n')}`, '1');
    const catNum = parseInt(catPick, 10);
    const category = (!Number.isNaN(catNum) && cats[catNum - 1]) ? cats[catNum - 1] : (catPick || cats[0] || 'Personal');
    if (name) {
      Store.addSubscription({
        name,
        amount: parseFloat(amount) || 0,
        renewalDate: Utils.addDays(Utils.todayStr(), 30),
        category,
      });
      this.refresh();
    }
  },

  handleAddPick(ds) {
    const presetDate = this.currentView === 'calendar' && this.selectedCalDay ? this.selectedCalDay : null;
    const presetProjectId = this.projectDetailId || this.filters.projectId || null;
    const presetClientId = this.clientDetailId || null;
    switch (ds.kind) {
      case 'quick':
        this.openQuickCapture();
        break;
      case 'ultra':
        this.openQuickCapture(null, true);
        break;
      case 'ai':
        this.openAiAssistant();
        break;
      case 'item':
        this.openItemModal(null, ds.date || presetDate, ds.projectId || presetProjectId, ds.type || null);
        break;
      case 'project':
        this.openProjectModal(presetClientId);
        break;
      case 'client':
        this.openClientModal();
        break;
      case 'area':
        this.openAreaModal();
        break;
      case 'vault':
        if (!Store.state.vaultUnlocked) this.navigate('vault');
        this.openVaultModal();
        break;
      case 'subscription':
        this.promptAddSubscription();
        break;
      default:
        break;
    }
  },

  renderAreaFilters() {
    const container = document.getElementById('area-filters');
    container.innerHTML = `
      <button class="area-chip ${!this.filters.areaId ? 'active' : ''}" data-area=""><span class="area-dot" style="background:var(--green)"></span> All</button>
      ${Store.state.areas.map((a) => `<button class="area-chip ${this.filters.areaId === a.id ? 'active' : ''}" data-area="${a.id}"><span class="area-dot" style="background:${a.color}"></span> ${a.icon} ${a.name}</button>`).join('')}`;
    container.querySelectorAll('.area-chip').forEach((el) => {
      el.addEventListener('click', () => {
        this.filters.areaId = el.dataset.area || null;
        if (this.filters.areaId && this.workspace) {
          const ids = Store.getWorkspaces()[this.workspace]?.areaIds || [];
          if (!ids.includes(this.filters.areaId)) this.workspace = null;
        }
        this.renderWorkspaceBar();
        this.refresh();
      });
    });
  },

  bindAreaFiltersToggle() {
    const toggle = document.getElementById('area-filters-toggle');
    if (!toggle || toggle.dataset.bound) return;
    toggle.dataset.bound = '1';
    this.areaFiltersCollapsed = Store.state.settings.areaFiltersCollapsed ?? false;
    this.applyAreaFiltersCollapsed();
    toggle.addEventListener('click', () => {
      this.areaFiltersCollapsed = !this.areaFiltersCollapsed;
      Store.state.settings.areaFiltersCollapsed = this.areaFiltersCollapsed;
      Store.save();
      this.applyAreaFiltersCollapsed();
    });
  },

  applyAreaFiltersCollapsed() {
    const section = document.getElementById('sidebar-areas');
    const toggle = document.getElementById('area-filters-toggle');
    if (!section || !toggle) return;
    section.classList.toggle('collapsed', this.areaFiltersCollapsed);
    toggle.setAttribute('aria-expanded', String(!this.areaFiltersCollapsed));
  },

  updateBadges() {
    const stats = Store.getStats();
    const badge = document.getElementById('badge-inbox');
    const overdueBadge = document.getElementById('badge-overdue');
    if (badge) {
      if (stats.inbox > 0) { badge.textContent = stats.inbox; badge.classList.remove('hidden'); } else badge.classList.add('hidden');
    }
    if (overdueBadge) {
      if (stats.overdue > 0) { overdueBadge.textContent = stats.overdue; overdueBadge.classList.remove('hidden'); } else overdueBadge.classList.add('hidden');
    }
  },

  render() {
    const renderers = {
      dashboard: () => this.renderDashboard(),
      inbox: () => this.renderInbox(),
      today: () => this.renderToday(),
      calendar: () => this.renderCalendar(),
      timeline: () => this.renderTimeline(),
      tasks: () => this.renderTasks(),
      overdue: () => this.renderOverdue(),
      pinned: () => this.renderPinned(),
      blocked: () => this.renderBlocked(),
      archive: () => this.renderArchive(),
      review: () => this.renderReview(),
      stats: () => this.renderStats(),
      clients: () => this.renderClients(),
      contacts: () => this.renderContacts(),
      emails: () => this.renderEmails(),
      links: () => this.renderLinks(),
      subscriptions: () => this.renderSubscriptions(),
      templates: () => this.renderTemplates(),
      tools: () => this.renderTools(),
      projects: () => this.renderProjects(),
      kanban: () => this.renderKanban(),
      vault: () => this.renderVault(),
      areas: () => this.renderAreas(),
      settings: () => this.renderSettings(),
      personalization: () => this.renderPersonalization(),
      accessibility: () => this.renderAccessibility(),
      search: () => this.renderSearch(),
    };
    document.getElementById('content').innerHTML = renderers[this.currentView]?.() || '';
    const content = document.getElementById('content');
    const stage = document.getElementById('content-stage');
    const isTimeline = this.currentView === 'timeline';
    content?.classList.toggle('view-timeline', isTimeline);
    stage?.classList.toggle('view-timeline', isTimeline);
    this.bindContentEvents();
  },

  openProject(id) {
    if (!id || !Store.getProject(id)) return;
    if (this.projectDetailId !== id) {
      this.projectStageFilter = null;
      this.projectItemTypeFilter = null;
    }
    this.projectDetailId = id;
    this.currentHub = 'projects';
    if (this.currentView !== 'projects') {
      this.navigate('projects', { skipTransition: true, force: true });
      return;
    }
    const content = document.getElementById('content');
    if (content) content.classList.add('content-loading');
    requestAnimationFrame(() => {
      AppShell.renderBreadcrumb();
      this.render();
      AppShell.render();
      content?.classList.remove('content-loading');
      content?.scrollTo?.({ top: 0, behavior: 'auto' });
    });
  },

  openClient(id) {
    if (!id || !Store.getClient(id)) return;
    this.clientDetailId = id;
    this.clientTab = 'overview';
    this.currentHub = 'projects';
    if (this.currentView !== 'clients') {
      this.navigate('clients', { skipTransition: true, force: true });
      return;
    }
    const content = document.getElementById('content');
    if (content) content.classList.add('content-loading');
    requestAnimationFrame(() => {
      this.render();
      AppShell.render();
      content?.classList.remove('content-loading');
      content?.scrollTo?.({ top: 0, behavior: 'auto' });
    });
  },

  bindContentDelegation() {
    const root = document.getElementById('content-stage') || document.getElementById('content');
    if (!root || root.dataset.delegationBound) return;
    root.dataset.delegationBound = '1';

    root.addEventListener('click', (e) => {
      const kanbanMove = e.target.closest('[data-kanban-move]');
      if (kanbanMove && root.contains(kanbanMove)) {
        e.stopPropagation();
        Store.updateItem(kanbanMove.dataset.id, { kanbanStatus: kanbanMove.dataset.kanbanMove });
        this.refresh();
        return;
      }

      const actionEl = e.target.closest('[data-action]');
      if (actionEl && root.contains(actionEl)) {
        e.preventDefault();
        e.stopPropagation();
        this.handleAction(actionEl.dataset.action, actionEl.dataset);
        return;
      }

      const calDay = e.target.closest('[data-cal-day]');
      if (calDay && root.contains(calDay)) {
        this.selectedCalDay = calDay.dataset.calDay;
        this.render();
        return;
      }

      const tab = e.target.closest('.tab[data-tab]');
      if (tab && root.contains(tab)) {
        this.projectTab = tab.dataset.tab || 'overview';
        if (this.projectTab !== 'items') this.projectItemTypeFilter = null;
        AppShell.renderBreadcrumb();
        this.render();
        return;
      }

      const clientTab = e.target.closest('[data-client-tab]');
      if (clientTab && root.contains(clientTab)) {
        this.clientTab = clientTab.dataset.clientTab;
        AppShell.renderBreadcrumb();
        this.render();
        return;
      }

      const clientFilter = e.target.closest('[data-client-filter]');
      if (clientFilter && root.contains(clientFilter)) {
        this.clientFilter = clientFilter.dataset.clientFilter;
        this.render();
        return;
      }

      const vaultFolder = e.target.closest('[data-vault-folder]');
      if (vaultFolder && root.contains(vaultFolder)) {
        this.vaultFolder = vaultFolder.dataset.vaultFolder;
        this.render();
        return;
      }

      const personalTab = e.target.closest('[data-personal-tab]');
      if (personalTab && root.contains(personalTab)) {
        this.personalizationTab = personalTab.dataset.personalTab;
        this.render();
        return;
      }

      const toolsTab = e.target.closest('[data-tools-tab]');
      if (toolsTab && root.contains(toolsTab)) {
        this.toolsTab = toolsTab.dataset.toolsTab;
        this.render();
        return;
      }

      if (e.target.id === 'cal-prev' || e.target.closest('#cal-prev')) {
        if (this.currentView === 'calendar' && (this.filters.calMode === 'school' || this.calView === 'week')) {
          this.calendarDate.setDate(this.calendarDate.getDate() - 7);
        } else this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
        this.render();
        return;
      }
      if (e.target.id === 'cal-next' || e.target.closest('#cal-next')) {
        if (this.currentView === 'calendar' && (this.filters.calMode === 'school' || this.calView === 'week')) {
          this.calendarDate.setDate(this.calendarDate.getDate() + 7);
        } else this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
        this.render();
        return;
      }
      if (e.target.id === 'cal-today' || e.target.closest('#cal-today')) {
        this.calendarDate = new Date();
        this.selectedCalDay = Utils.todayStr();
        this.render();
        return;
      }
      if (e.target.id === 'tl-prev' || e.target.closest('#tl-prev')) {
        this.calendarDate.setDate(this.calendarDate.getDate() - 7);
        this.render();
        return;
      }
      if (e.target.id === 'tl-next' || e.target.closest('#tl-next')) {
        this.calendarDate.setDate(this.calendarDate.getDate() + 7);
        this.render();
        return;
      }
      if (e.target.id === 'vault-lock' || e.target.closest('#vault-lock')) {
        Vault.lock();
        this.render();
        return;
      }
      if (e.target.id === 'btn-add-vault' || e.target.closest('#btn-add-vault')) {
        this.openVaultModal();
        return;
      }
      if (e.target.id === 'btn-add-project' || e.target.closest('#btn-add-project')) {
        this.openProjectModal();
        return;
      }
      if (e.target.id === 'btn-add-area' || e.target.closest('#btn-add-area')) {
        this.openAreaModal();
        return;
      }

      this.bindToolsCalcClick(e);
    });

    root.addEventListener('change', (e) => {
      if (e.target.id === 'kanban-proj-filter') {
        this.filters.projectId = e.target.value || null;
        this.render();
      }
      if (e.target.id === 'focus-select') {
        Store.state.settings.focusProjectId = e.target.value || null;
        Store.save();
      }
    });

    root.addEventListener('submit', async (e) => {
      if (e.target.id !== 'vault-unlock-form') return;
      e.preventDefault();
      const pw = document.getElementById('vault-password')?.value;
      if (!Vault.isSetup()) await Vault.setupMasterPassword(pw);
      else if (!(await Vault.unlock(pw))) { alert('Incorrect password'); return; }
      this.render();
    });

    root.addEventListener('keydown', (e) => {
      if (e.target.id === 'new-quick-tag' && e.key === 'Enter') {
        document.querySelector('[data-action="add-quick-tag"]')?.click();
      }
    });
  },

  bindFilterBarDelegation() {
    const bar = document.getElementById('filter-bar');
    if (!bar || bar.dataset.delegationBound) return;
    bar.dataset.delegationBound = '1';

    bar.addEventListener('click', (e) => {
      const el = e.target.closest('[data-period], [data-task-filter], [data-tag], [data-calmode], [data-calview], [data-tl-show], [data-inbox-type], [data-inbox-priority], [data-inbox-time], [data-inbox-tag], [data-inbox-clear-time], [data-archive-time], [data-archive-clear-time], [data-contact-group], [data-email-filter], [data-action]');
      if (!el) return;

      if (el.dataset.tlShow) {
        this.timelineShowDone = el.dataset.tlShow === 'all';
        this.refresh();
        return;
      }
      if (el.dataset.period !== undefined) {
        this.filters.period = el.dataset.period;
        this.taskFilter = 'all';
        this.refresh();
        return;
      }
      if (el.dataset.taskFilter !== undefined) {
        this.taskFilter = el.dataset.taskFilter;
        this.refresh();
        return;
      }
      if (el.dataset.tag !== undefined) {
        this.filters.tag = el.dataset.tag || null;
        this.refresh();
        return;
      }
      if (el.dataset.calmode) {
        this.filters.calMode = el.dataset.calmode;
        this.refresh();
        return;
      }
      if (el.dataset.calview) {
        this.calView = el.dataset.calview;
        this.refresh();
        return;
      }
      if (el.dataset.action === 'edit-school-schedule') {
        this.openSchoolScheduleModal();
        return;
      }
      if (el.dataset.inboxType) {
        this.inboxFilters.type = el.dataset.inboxType;
        this.refresh();
        return;
      }
      if (el.dataset.inboxPriority) {
        this.inboxFilters.priority = el.dataset.inboxPriority;
        this.refresh();
        return;
      }
      if (el.dataset.inboxTime) {
        this.inboxFilters.timeRange = el.dataset.inboxTime;
        this.inboxFilters.pickDate = '';
        this.inboxFilters.pickMonth = '';
        this.inboxFilters.pickYear = '';
        this.refresh();
        return;
      }
      if (el.dataset.inboxTag) {
        const tag = el.dataset.inboxTag;
        this.inboxFilters.tag = this.inboxFilters.tag === tag ? null : tag;
        this.refresh();
        return;
      }
      if (el.hasAttribute('data-inbox-clear-time')) {
        this.inboxFilters.pickDate = '';
        this.inboxFilters.pickMonth = '';
        this.inboxFilters.pickYear = '';
        this.inboxFilters.timeRange = 'all';
        this.refresh();
        return;
      }
      if (el.dataset.archiveTime) {
        this.archiveFilters.timeRange = el.dataset.archiveTime;
        this.archiveFilters.pickDate = '';
        this.archiveFilters.pickMonth = '';
        this.archiveFilters.pickYear = '';
        this.refresh();
        return;
      }
      if (el.hasAttribute('data-archive-clear-time')) {
        this.archiveFilters.pickDate = '';
        this.archiveFilters.pickMonth = '';
        this.archiveFilters.pickYear = '';
        this.archiveFilters.timeRange = 'all';
        this.refresh();
        return;
      }
      if (el.dataset.action === 'clear-archive-filters') {
        this.archiveFilters = { timeRange: 'all', pickDate: '', pickMonth: '', pickYear: '' };
        this.refresh();
        return;
      }
      if (el.dataset.contactGroup) {
        this.contactFilter = el.dataset.contactGroup;
        this.refresh();
        return;
      }
      if (el.dataset.emailFilter) {
        this.emailFilter = el.dataset.emailFilter;
        this.refresh();
        return;
      }
      if (el.dataset.action === 'manage-contact-groups') {
        this.personalizationTab = 'contacts';
        this.navigate('personalization');
        return;
      }
      if (el.dataset.action === 'manage-email-accounts') {
        this.personalizationTab = 'emails';
        this.navigate('personalization');
        return;
      }
      if (el.dataset.action === 'refresh-all-gmail') {
        this.refreshAllGmailAccounts(true);
      }
    });

    bar.addEventListener('input', (e) => {
      if (e.target.id === 'contact-search') {
        this.contactSearch = e.target.value;
        this.render();
      }
    });

    bar.addEventListener('change', (e) => {
      if (e.target.id === 'inbox-pick-date') {
        this.inboxFilters.pickDate = e.target.value;
        this.inboxFilters.pickMonth = '';
        this.inboxFilters.pickYear = '';
        this.inboxFilters.timeRange = 'all';
        this.refresh();
      }
      if (e.target.id === 'inbox-pick-month') {
        this.inboxFilters.pickMonth = e.target.value;
        this.inboxFilters.pickDate = '';
        this.inboxFilters.pickYear = '';
        this.inboxFilters.timeRange = 'all';
        this.refresh();
      }
      if (e.target.id === 'inbox-pick-year') {
        this.inboxFilters.pickYear = e.target.value;
        this.inboxFilters.pickDate = '';
        this.inboxFilters.pickMonth = '';
        this.inboxFilters.timeRange = 'all';
        this.refresh();
      }
      if (e.target.id === 'archive-pick-date') {
        this.archiveFilters.pickDate = e.target.value;
        this.archiveFilters.pickMonth = '';
        this.archiveFilters.pickYear = '';
        this.archiveFilters.timeRange = 'all';
        this.refresh();
      }
      if (e.target.id === 'archive-pick-month') {
        this.archiveFilters.pickMonth = e.target.value;
        this.archiveFilters.pickDate = '';
        this.archiveFilters.pickYear = '';
        this.archiveFilters.timeRange = 'all';
        this.refresh();
      }
      if (e.target.id === 'archive-pick-year') {
        this.archiveFilters.pickYear = e.target.value;
        this.archiveFilters.pickDate = '';
        this.archiveFilters.pickMonth = '';
        this.archiveFilters.timeRange = 'all';
        this.refresh();
      }
    });
  },

  bindToolsCalcClick(e) {
    const run = (id, fn) => {
      if (e.target.id === id || e.target.closest(`#${id}`)) fn();
    };
    run('calc-vdrop', () => {
      const I = parseFloat(document.getElementById('calc-i')?.value);
      const R = parseFloat(document.getElementById('calc-r')?.value);
      const L = parseFloat(document.getElementById('calc-l')?.value);
      const out = document.getElementById('calc-vdrop-out');
      if (I && R && L && out) out.textContent = `ΔV = ${EngCalc.voltageDrop(I, R, L)} V`;
    });
    run('calc-awg-btn', () => {
      const awg = parseInt(document.getElementById('calc-awg')?.value, 10);
      const out = document.getElementById('calc-awg-out');
      if (out) out.textContent = `${awg} AWG ≈ ${EngCalc.awgToMm2(awg)} mm²`;
    });
    run('calc-kw-btn', () => {
      const kw = parseFloat(document.getElementById('calc-kw')?.value);
      const out = document.getElementById('calc-kw-out');
      if (out) out.textContent = kw ? `${kw} kW = ${EngCalc.kwToCv(kw)} cv` : '—';
    });
    run('calc-cos', () => {
      const kva = parseFloat(document.getElementById('calc-kva')?.value);
      const kw = parseFloat(document.getElementById('calc-kw2')?.value);
      const out = document.getElementById('calc-cos-out');
      if (out) out.textContent = `cos φ = ${EngCalc.powerFactor(kva, kw)}`;
    });
  },

  bindContentEvents() {
    /* Delegação em bindContentDelegation — chamado uma vez no init. */
  },

  async handleAction(action, ds) {
    const id = ds.id;
    switch (action) {
      case 'nav': {
        const src = AppShell.viewToHub(ds.view) === AppShell.viewToHub(App.currentView) ? 'tab' : 'hub';
        this.navigate(ds.view, { source: src });
        break;
      }
      case 'open-item':
        if (String(id).startsWith('school-')) break;
        this.openItemModal(id);
        break;
      case 'toggle-task': Store.toggleTask(id); this.refresh(); break;
      case 'toggle-checklist-item': {
        const idx = parseInt(ds.idx, 10);
        if (!Number.isNaN(idx)) { Store.toggleChecklistItem(id, idx); this.refresh(); }
        break;
      }
      case 'toggle-pin': Store.togglePin(id); this.refresh(); break;
      case 'archive-item': Store.archiveItem(id); this.refresh(); break;
      case 'snooze-item': Store.snoozeItem(id, 1); this.refresh(); break;
      case 'delete-item': if (confirm(I18n.t('confirm.deleteItem'))) { Store.deleteItem(id); this.refresh(); } break;
      case 'classify-inbox': this.openQuickCapture(id); break;
      case 'clear-inbox-filters':
        this.inboxFilters = { type: 'all', priority: 'all', tag: null, timeRange: 'all', pickDate: '', pickMonth: '', pickYear: '' };
        this.refresh();
        break;
      case 'clear-archive-filters':
        this.archiveFilters = { timeRange: 'all', pickDate: '', pickMonth: '', pickYear: '' };
        this.refresh();
        break;
      case 'quick-ultra': this.openQuickCapture(null, true); break;
      case 'open-project': this.openProject(id); break;
      case 'back-projects': this.projectDetailId = null; this.render(); break;
      case 'extract-tasks': alert(`${Store.extractTasksFromNote(id).length} task(s) created.`); this.refresh(); break;
      case 'delete-item-modal':
        if (confirm(I18n.t('confirm.deleteItem'))) { Store.deleteItem(id); this.closeModal(); this.refresh(); }
        break;
      case 'delete-client-modal':
        if (confirm('Delete client? Projects will be unlinked.')) {
          Store.deleteClient(id);
          this.closeModal();
          this.clientDetailId = null;
          this.refresh();
        }
        break;
      case 'copy-password': await this.copyVaultPassword(id); break;
      case 'edit-vault': this.openVaultModal(id); break;
      case 'delete-vault': if (confirm('Delete?')) { Store.deleteVaultEntry(id); this.refresh(); } break;
      case 'filter-tag': this.filters.tag = ds.tag; this.navigate('tasks'); break;
      case 'add-cal-day': this.openItemModal(null, ds.date); break;
      case 'export-ics': Utils.exportICS(Store.state.items.filter((i) => i.startDate)); break;
      case 'export-backup': Utils.exportBackup(Store.state); break;
      case 'import-backup': {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.json,application/json';
        inp.onchange = async () => {
          const file = inp.files?.[0];
          if (!file) return;
          try {
            const data = JSON.parse(await file.text());
            if (!confirm('Replace all current data with this backup?')) return;
            if (Store.importBackup(data)) {
              alert('Backup imported! Your data is restored.');
              App.renderWorkspaceBar?.();
              App.renderAreaFilters?.();
              App.refresh?.();
            } else alert('Invalid backup file.');
          } catch {
            alert('Error reading JSON file.');
          }
        };
        inp.click();
        break;
      }
      case 'load-demo':
        if (confirm('Load demo examples? This replaces ALL current data.')) {
          Store.loadDemo();
          this.renderWorkspaceBar();
          this.renderAreaFilters();
          this.refresh();
        }
        break;
      case 'clear-all-data':
        if (confirm('Delete ALL tasks, projects, clients, vault entries and start empty?')) {
          Store.clearAllData();
          this.renderWorkspaceBar();
          this.renderAreaFilters();
          this.refresh();
          alert('App cleared — ready to personalize!');
        }
        break;
      case 'reset-demo':
        if (confirm('Load all demo examples? This replaces current data.')) {
          Store.loadDemo();
          this.renderWorkspaceBar();
          this.renderAreaFilters();
          this.refresh();
        }
        break;
      case 'focus-project': Store.state.settings.focusProjectId = id; Store.save(); this.refresh(); break;
      case 'clear-focus': Store.state.settings.focusProjectId = null; Store.save(); this.refresh(); break;
      case 'dup-project': Store.duplicateProject(id); alert('Project duplicated!'); this.refresh(); break;
      case 'archive-project': Store.archiveProject(id); this.projectDetailId = null; this.refresh(); break;
      case 'unarchive-project': Store.unarchiveProject(id); this.refresh(); break;
      case 'unarchive-item': Store.unarchiveItem(id); this.refresh(); break;
      case 'edit-project': this.openProjectModal(null, id); break;
      case 'save-project-stages': {
        const pid = ds.pid;
        const ta = document.getElementById(`proj-stages-${pid}`);
        const stages = (ta?.value || '').split('\n').map((s) => s.trim()).filter(Boolean);
        Store.updateProject(pid, { stages: stages.length ? stages : null });
        alert(I18n.t('project.stagesSaved'));
        this.refresh();
        break;
      }
      case 'clear-project-stages':
        Store.updateProject(ds.pid, { stages: null });
        this.refresh();
        break;
      case 'delete-project':
        if (confirm(I18n.t('confirm.deleteProject'))) {
          Store.deleteProject(id);
          if (this.projectDetailId === id) this.projectDetailId = null;
          this.refresh();
        }
        break;
      case 'add-proj-item': AppModals.openItemTypePicker(ds.pid); break;
      case 'add-project': this.openProjectModal(); break;
      case 'log-hours': { const h = parseFloat(prompt('Hours?')); if (h) { Store.logHours(id, h); this.refresh(); } } break;
      case 'add-version': { const v = prompt('Version (e.g. 1.1)?'); const n = prompt('Notes?'); if (v) { Store.addProjectVersion(id, v, n || ''); this.refresh(); } } break;
      case 'proj-tab':
        this.projectTab = ds.tab || 'overview';
        if (ds.tab === 'items' && ds.type) this.projectItemTypeFilter = ds.type;
        else if (ds.tab !== 'items') this.projectItemTypeFilter = null;
        this.refresh();
        break;
      case 'add-wishlist-item': {
        const input = document.getElementById('wishlist-new-input');
        const text = input?.value?.trim();
        if (text && ds.pid) {
          Store.addProjectWishlistItem(ds.pid, text);
          this.refresh();
        }
        break;
      }
      case 'toggle-wishlist-item':
        if (ds.pid && ds.wid) { Store.toggleProjectWishlistItem(ds.pid, ds.wid); this.refresh(); }
        break;
      case 'delete-wishlist-item':
        if (ds.pid && ds.wid && confirm(I18n.t('confirm.deleteWishlistItem'))) {
          Store.removeProjectWishlistItem(ds.pid, ds.wid);
          this.refresh();
        }
        break;
      case 'use-template': this.useTemplate(ds.template); break;
      case 'new-contact': this.openItemModal(null, null, null, 'contact'); break;
      case 'new-link': this.openItemModal(null, null, null, 'link'); break;
      case 'add-subscription':
        this.promptAddSubscription();
        break;
      case 'delete-sub': if (confirm('Delete?')) { Store.deleteSubscription(id); this.refresh(); } break;
      case 'edit-school-schedule': this.openSchoolScheduleModal(); break;
      case 'open-ai': this.openAiAssistant(); break;
      case 'start-timer': Store.startTimer(id); this.refresh(); break;
      case 'stop-timer': {
        const h = Store.stopTimer();
        alert(`${I18n.t('timer.logged')} ${Utils.fmtMinutes(Math.round(h * 60))} (${Utils.fmtHours(h)})`);
        this.refresh();
        break;
      }
      case 'cancel-timer':
        if (Store.cancelTimer()) {
          this.refresh();
        }
        break;
      case 'timeline-expand': {
        const day = ds.day;
        if (day) {
          this.timelineExpandedDays[day] = true;
          this.render();
        }
        break;
      }
      case 'timeline-collapse': {
        const day = ds.day;
        if (day) {
          delete this.timelineExpandedDays[day];
          this.render();
        }
        break;
      }
      case 'pomodoro-start': Pomodoro.start('work'); this.render(); break;
      case 'pomodoro-break': Pomodoro.start('break'); this.render(); break;
      case 'pomodoro-stop': Pomodoro.stop(); this.render(); break;
      case 'add-grade': {
        const discs = Store.getDisciplines();
        const pick = discs.length
          ? prompt(`Subject?\n${discs.map((d, i) => `${i + 1}. ${d.name}`).join('\n')}\n\nName or number:`)
          : prompt('Subject?');
        if (!pick) break;
        const num = parseInt(pick, 10);
        const subject = (!Number.isNaN(num) && discs[num - 1]) ? discs[num - 1].name : pick;
        const disc = discs.find((d) => d.name.toLowerCase() === subject.toLowerCase());
        const weight = prompt('Weight (%)?', disc?.defaultWeight ?? 30);
        const grade = prompt('Grade (0-20)?');
        if (subject && grade) Store.addGrade({ subject, weight, grade, semester: '2025/26' });
        this.refresh();
        break;
      }
      case 'delete-grade': if (confirm('Delete?')) { Store.deleteGrade(id); this.refresh(); } break;
      case 'clear-contact-filters':
        this.contactFilter = 'all';
        this.contactSearch = '';
        this.refresh();
        break;
      case 'manage-contact-groups':
        this.personalizationTab = 'contacts';
        this.navigate('personalization');
        break;
      case 'add-contact-group': this.openContactGroupModal(); break;
      case 'edit-contact-group': this.openContactGroupModal(id); break;
      case 'delete-contact-group': {
        const count = Store.getItems({ type: 'contact', contactGroupId: id }).length;
        const msg = count ? `Delete group? ${count} contact(s) will have no group.` : 'Delete group?';
        if (confirm(msg)) { Store.deleteContactGroup(id); this.refresh(); }
        break;
      }
      case 'manage-email-accounts':
        this.personalizationTab = 'emails';
        this.navigate('personalization');
        break;
      case 'add-email-account': this.openEmailAccountModal(); break;
      case 'edit-email-account': this.openEmailAccountModal(id); break;
      case 'delete-email-account':
        if (confirm('Delete email account?')) {
          if (this.emailFilter === id) this.emailFilter = 'all';
          Store.deleteEmailAccount(id);
          this.refresh();
        }
        break;
      case 'email-filter':
        this.emailFilter = ds.id || 'all';
        this.render();
        break;
      case 'open-gmail-external': {
        const account = Store.getEmailAccount(id);
        if (account) window.open(Gmail.inboxUrl(account), '_blank', 'noopener');
        break;
      }
      case 'compose-email': {
        const account = Store.getEmailAccount(id);
        if (account) window.open(Gmail.composeUrl(account), '_blank', 'noopener');
        break;
      }
      case 'open-gmail-message': {
        const account = Store.getEmailAccount(id);
        if (account && ds.message) Gmail.openMessage(account, ds.message);
        break;
      }
      case 'connect-gmail':
        await this.connectGmailAccount(id);
        break;
      case 'disconnect-gmail':
        if (confirm('Disconnect Gmail from this account?')) {
          Store.clearEmailGmailToken(id);
          this.render();
        }
        break;
      case 'refresh-gmail':
        await this.refreshGmailAccount(id, true);
        break;
      case 'refresh-all-gmail':
        await this.refreshAllGmailAccounts(true);
        break;
      case 'save-gmail-settings': {
        Store.state.settings.googleClientId = document.getElementById('google-client-id')?.value.trim() || '';
        Store.save();
        alert('Gmail settings saved!');
        this.render();
        break;
      }
      case 'add-vault-folder': this.openVaultFolderModal(); break;
      case 'edit-vault-folder': this.openVaultFolderModal(id); break;
      case 'delete-vault-folder': {
        const vf = Store.getVaultFolder(id);
        const count = Store.state.vaultEntries.filter((e) => e.folder === vf?.name).length;
        const msg = count ? `Delete folder «${vf?.name}»? ${count} entry(ies) will have no folder.` : 'Delete folder?';
        if (confirm(msg)) {
          Store.deleteVaultFolder(id);
          if (this.vaultFolder === id) this.vaultFolder = 'all';
          this.refresh();
        }
        break;
      }
      case 'add-quick-tag': {
        const inp = document.getElementById('new-quick-tag');
        if (inp?.value) { Store.addQuickTag(inp.value); inp.value = ''; this.render(); }
        break;
      }
      case 'delete-quick-tag':
        if (confirm(`Delete tag #${ds.tag}?`)) { Store.deleteQuickTag(ds.tag); this.render(); }
        break;
      case 'add-config-list': {
        const val = prompt('Name?');
        if (val && Store.addConfigListItem(ds.list, val)) this.render();
        else if (val) alert('Already exists or invalid.');
        break;
      }
      case 'remove-config-list':
        if (confirm(`Delete «${ds.value}»? Affected items will be remapped.`)) {
          if (!Store.removeConfigListItem(ds.list, ds.value)) alert('At least one value must remain.');
          else this.render();
        }
        break;
      case 'rename-config-list': {
        const val = prompt('New name?', ds.value);
        if (val && val !== ds.value) {
          if (!Store.renameConfigListItem(ds.list, ds.value, val)) alert('Invalid or duplicate name.');
          else this.render();
        }
        break;
      }
      case 'move-config-list':
        Store.moveConfigListItem(ds.list, parseInt(ds.index, 10), parseInt(ds.dir, 10));
        this.render();
        break;
      case 'add-area': this.openAreaModal(); break;
      case 'edit-area': this.openAreaModal(id); break;
      case 'toggle-workspace-area':
        Store.toggleWorkspaceArea(ds.ws, ds.area);
        break;
      case 'save-workspaces': {
        document.querySelectorAll('.ws-icon-input').forEach((inp) => {
          Store.updateWorkspace(inp.dataset.ws, { icon: inp.value });
        });
        document.querySelectorAll('.ws-label-input').forEach((inp) => {
          Store.updateWorkspace(inp.dataset.ws, { label: inp.value });
        });
        this.renderWorkspaceBar();
        alert('Workspaces saved!');
        break;
      }
      case 'add-link-category': this.openLinkCategoryModal(); break;
      case 'edit-link-category': this.openLinkCategoryModal(id); break;
      case 'delete-link-category': {
        const count = Store.getItems({ type: 'link' }).filter((i) => i.linkCategoryId === id).length;
        if (confirm(count ? `Delete category? ${count} link(s) will have no category.` : 'Delete category?')) {
          Store.deleteLinkCategory(id);
          this.render();
        }
        break;
      }
      case 'add-discipline': this.openDisciplineModal(); break;
      case 'edit-discipline': this.openDisciplineModal(id); break;
      case 'delete-discipline':
        if (confirm('Delete subject?')) { Store.deleteDiscipline(id); this.render(); }
        break;
      case 'add-custom-template': this.openCustomTemplateModal(); break;
      case 'delete-custom-template':
        if (confirm('Delete template?')) { Store.deleteCustomTemplate(id); this.render(); }
        break;
      case 'use-custom-template': {
        const t = Store.getCustomTemplates().find((x) => x.id === id);
        if (t) { Store.addItem({ ...t, id: undefined }); this.refresh(); }
        break;
      }
      case 'toggle-dashboard-widget': {
        Store.toggleDashboardWidget(ds.widget);
        this.render();
        break;
      }
      case 'export-personalization': {
        const json = JSON.stringify(Store.exportPersonalizationConfig(), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `candeias-personalization-${Utils.todayStr()}.json`;
        a.click();
        break;
      }
      case 'import-personalization': {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.json,application/json';
        inp.onchange = async () => {
          const file = inp.files?.[0];
          if (!file) return;
          try {
            const data = JSON.parse(await file.text());
            if (Store.importPersonalizationConfig(data)) {
              alert('Config imported!');
              this.renderWorkspaceBar();
              this.render();
            } else alert('Invalid file.');
          } catch {
            alert('Error reading JSON.');
          }
        };
        inp.click();
        break;
      }
      case 'copy-contact-email': {
        const item = Store.getItem(id);
        if (item?.contactInfo?.email) { await navigator.clipboard.writeText(item.contactInfo.email); alert('Email copied!'); }
        break;
      }
      case 'copy-contact-phone': {
        const item = Store.getItem(id);
        if (item?.contactInfo?.phone) { await navigator.clipboard.writeText(item.contactInfo.phone); alert('Phone copied!'); }
        break;
      }
      case 'save-ai-settings': {
        Store.state.settings.openaiApiKey = document.getElementById('openai-api-key')?.value.trim() || '';
        Store.state.settings.useAiParser = document.getElementById('use-ai-parser')?.checked !== false;
        Store.save();
        alert('AI settings saved!');
        this.render();
        break;
      }
      case 'toggle-a11y': {
        const key = ds.a11yKey;
        if (!key || !(key in DEFAULT_ACCESSIBILITY)) break;
        Store.state.settings.accessibility = { ...DEFAULT_ACCESSIBILITY, ...(Store.state.settings.accessibility || {}) };
        Store.state.settings.accessibility[key] = !Store.state.settings.accessibility[key];
        Store.save();
        this.applyAccessibility();
        this.render();
        break;
      }
      case 'save-fincontrol-url': {
        const inp = document.getElementById('fincontrol-url');
        if (inp?.value) {
          Store.state.settings.fincontrolUrl = inp.value.trim();
          Store.save();
          alert('FinControl URL saved!');
          this.render();
        }
        break;
      }
      case 'set-theme': this.applyTheme(ds.theme); this.render(); break;
      case 'set-language':
        Store.state.settings.language = ds.language === 'pt' ? 'pt' : 'en';
        Store.save();
        I18n.apply();
        this.render();
        break;
      case 'save-search': { const name = prompt('Search name?'); if (name) { Store.addSavedSearch(name, { q: this.searchQuery, type: this.searchType }); alert('Saved!'); } } break;
      case 'proj-filter': this.projectFilter = ds.filter; this.render(); break;
      case 'proj-item-type-filter':
        this.projectItemTypeFilter = ds.type || null;
        this.render();
        break;
      case 'proj-item-filter': this.projectItemFilter = ds.filter; this.render(); break;
      case 'proj-stage-filter':
        this.projectStageFilter = ds.stage === '' ? null : ds.stage;
        this.render();
        break;
      case 'proj-item-sort': this.projectItemSort = ds.sort; this.render(); break;
      case 'open-client': this.openClient(id); break;
      case 'back-clients': this.clientDetailId = null; this.render(); break;
      case 'new-client': this.openClientModal(); break;
      case 'edit-client': this.openClientModal(id); break;
      case 'add-client-contact': this.openClientContactModal(id); break;
      case 'edit-client-contact': this.openClientContactModal(ds.client, id); break;
      case 'delete-client-contact':
        if (confirm('Delete contact?')) { Store.deleteClientContact(ds.client, id); this.refresh(); }
        break;
      case 'set-primary-contact':
        Store.getClient(ds.client)?.contacts.forEach((c) => { c.isPrimary = c.id === id; });
        Store.save(); this.refresh();
        break;
      case 'new-client-project': this.openProjectModal(id); break;
      case 'client-vault': this.navigate('vault'); this.openVaultModal(null, id); break;
      case 'logout': Auth.logout(); break;
      case 'open-change-password': this.openChangePasswordModal(); break;
      case 'save-firebase-config': {
        const raw = document.getElementById('firebase-config-json')?.value.trim();
        if (!raw) { alert('Paste Firebase config JSON.'); break; }
        try {
          const config = JSON.parse(raw);
          if (!config.apiKey || !config.projectId) throw new Error('Missing apiKey or projectId');
          CloudSync.saveConfig(config);
          alert('Firebase saved! Reload and sign in with your cloud account.');
          location.reload();
        } catch (e) {
          alert(`Invalid config: ${e.message}`);
        }
        break;
      }
      case 'cloud-sync-now':
        try {
          if (!CloudSync.isSignedIn()) { alert('Sign in first (logout → login).'); break; }
          await CloudSync.syncNow();
          alert('Sync complete!');
          this.render();
        } catch (e) {
          alert(`Sync failed: ${e.message}`);
        }
        break;
      case 'restore-my-data':
        try {
          const res = await CloudSync.restoreFromBestAvailable();
          alert(res.message || (res.ok ? 'Data restored.' : 'Nothing to restore.'));
          this.renderWorkspaceBar();
          this.renderAreaFilters();
          this.refresh();
        } catch (e) {
          alert(`Restore failed: ${e.message}`);
        }
        break;
      case 'check-app-update': {
        const newer = await AppUpdate.checkVersion();
        if (newer) {
          alert(`Nova versão disponível: v${AppUpdate.remoteVersion}\n\nToca em "Atualizar para v${AppUpdate.remoteVersion}".`);
        } else if (AppUpdate.remoteVersion && AppUpdate.remoteVersion === APP_VERSION) {
          alert(`Versão no servidor: v${APP_VERSION}.\n\nSe a app ainda parece antiga (ex.: linha temporal desformatada), usa **Definições → Recarregar app** para limpar a cache do browser.`);
        } else {
          alert(`Versão local: v${APP_VERSION}${AppUpdate.remoteVersion ? `\nServidor: v${AppUpdate.remoteVersion}` : '\n(Não foi possível contactar o servidor.)'}`);
        }
        this.render();
        break;
      }
      case 'apply-app-update':
        await AppUpdate.applyUpdate();
        break;
      case 'close-modal': this.closeModal(); break;
      case 'open-attachment': this.openAttachmentViewer(ds.itemId, parseInt(ds.attIndex, 10)); break;
      case 'close-attachment-viewer': this.closeAttachmentViewer(); break;
      case 'download-attachment': {
        const att = Store.getItem(ds.itemId)?.attachments?.[parseInt(ds.attIndex, 10)];
        if (att) Utils.downloadAttachment(att);
        break;
      }
      case 'open-attachment-external': {
        const att = Store.getItem(ds.itemId)?.attachments?.[parseInt(ds.attIndex, 10)];
        if (att) Utils.openAttachmentExternal(att);
        break;
      }
    }
  },

  async copyVaultPassword(id) {
    const entry = Store.state.vaultEntries.find((e) => e.id === id);
    if (!entry || !Vault.sessionPassword) return;
    const secrets = await Vault.loadEntrySecrets(entry, Vault.sessionPassword);
    await navigator.clipboard.writeText(secrets.password);
    alert('Password copied!');
  },

  async refreshGmailAccount(accountId, showAlert = false) {
    const account = Store.getEmailAccount(accountId);
    if (!account || !Gmail.isTokenValid(account)) {
      if (showAlert) alert('Account not connected to Gmail.');
      return false;
    }
    try {
      const data = await Gmail.fetchInboxPreview(account.gmailAccessToken);
      Store.setEmailPreview(accountId, data.messages, data.unreadCount);
      if (showAlert) alert('Inbox updated!');
      this.render();
      return true;
    } catch (e) {
      Store.clearEmailGmailToken(accountId);
      if (showAlert) alert(`Gmail sync failed: ${e.message}`);
      this.render();
      return false;
    }
  },

  async refreshAllGmailAccounts(showAlert = false) {
    const accounts = Store.getEmailAccounts().filter((a) => Gmail.isTokenValid(a));
    if (!accounts.length) {
      if (showAlert) alert('No connected Gmail accounts.');
      return;
    }
    let ok = 0;
    for (const a of accounts) {
      if (await this.refreshGmailAccount(a.id, false)) ok += 1;
    }
    if (showAlert) alert(`Updated ${ok} of ${accounts.length} account(s).`);
    this.render();
  },

  async connectGmailAccount(accountId) {
    const clientId = Store.state.settings.googleClientId?.trim();
    if (!clientId) {
      alert('Add your Google OAuth Client ID in Settings → Gmail first.');
      this.navigate('settings');
      return;
    }
    const account = Store.getEmailAccount(accountId);
    if (!account) return;
    try {
      const resp = await Gmail.connect(clientId, account.email);
      Store.setEmailGmailToken(accountId, resp.access_token, resp.expires_in || 3600);
      await this.refreshGmailAccount(accountId, false);
      alert('Gmail connected!');
      this.render();
    } catch (e) {
      alert(`Gmail connection failed: ${e.message}`);
    }
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.init();
  App.init();
});
