const AppShell = {
  hubs: {
    home: {
      icon: '⌂',
      i18n: 'shell.hub.home',
      defaultView: 'dashboard',
      tabs: [
        { view: 'dashboard', i18n: 'shell.tab.overview' },
        { view: 'today', i18n: 'view.today' },
        { view: 'inbox', i18n: 'view.inbox', badge: 'inbox' },
        { view: 'calendar', i18n: 'view.calendar' },
        { view: 'timeline', i18n: 'view.timeline' },
        { view: 'review', i18n: 'view.review' },
        { view: 'stats', i18n: 'view.stats' },
      ],
    },
    work: {
      icon: '✓',
      i18n: 'shell.hub.work',
      defaultView: 'tasks',
      tabs: [
        { view: 'tasks', i18n: 'view.tasks' },
        { view: 'overdue', i18n: 'view.overdue', badge: 'overdue' },
        { view: 'pinned', i18n: 'view.pinned' },
        { view: 'blocked', i18n: 'view.blocked' },
      ],
    },
    projects: {
      icon: '📁',
      i18n: 'shell.hub.projects',
      defaultView: 'projects',
      tabs: [
        { view: 'projects', i18n: 'view.projects' },
        { view: 'kanban', i18n: 'view.kanban' },
        { view: 'clients', i18n: 'view.clients' },
      ],
    },
    library: {
      icon: '▦',
      i18n: 'shell.hub.library',
      defaultView: 'vault',
      tabs: [
        { view: 'vault', i18n: 'view.vault' },
        { view: 'contacts', i18n: 'view.contacts' },
        { view: 'emails', i18n: 'view.emails' },
        { view: 'links', i18n: 'view.links' },
        { view: 'subscriptions', i18n: 'view.subscriptions' },
        { view: 'templates', i18n: 'view.templates' },
        { view: 'tools', i18n: 'view.tools' },
        { view: 'archive', i18n: 'view.archive' },
        { view: 'areas', i18n: 'view.areas' },
        { view: 'personalization', i18n: 'view.personalization' },
        { view: 'accessibility', i18n: 'view.accessibility' },
        { view: 'settings', i18n: 'view.settings' },
      ],
    },
  },

  extraViews: ['search', 'personalization', 'accessibility'],

  viewToHub(view) {
    for (const [hubId, hub] of Object.entries(this.hubs)) {
      if (hub.tabs.some((t) => t.view === view)) return hubId;
    }
    return 'home';
  },

  badgeCount(id) {
    if (id === 'inbox') return Store.getItems({ inbox: true, snoozed: false }).length;
    if (id === 'overdue') return Store.getItems({ overdue: true }).length;
    return 0;
  },

  todayEventCount() {
    const today = Utils.todayStr();
    return Store.getItems({ types: ['event', 'reminder'] }).filter((i) => i.startDate?.startsWith(today)).length;
  },

  render() {
    const hubId = App.currentHub || this.viewToHub(App.currentView);
    App.currentHub = hubId;
    this.renderTabs(hubId);
    this.renderBottomNav(hubId);
    this.updateHeaderBadges();
  },

  renderTabs(hubId) {
    const wrap = document.getElementById('app-tabs-wrap');
    const el = document.getElementById('app-tabs');
    if (!el || !wrap) return;
    const hub = this.hubs[hubId];
    if (!hub) {
      wrap.classList.add('hidden');
      return;
    }
    wrap.classList.remove('hidden');
    el.innerHTML = hub.tabs.map((t) => {
      const n = t.badge ? this.badgeCount(t.badge) : 0;
      const badge = n > 0 ? `<span class="app-tab-badge">${n}</span>` : '';
      return `<button type="button" class="app-tab ${App.currentView === t.view ? 'active' : ''}" data-view="${t.view}" role="tab">${I18n.t(t.i18n)}${badge}</button>`;
    }).join('');
    el.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => App.navigate(btn.dataset.view));
    });
  },

  renderBottomNav(activeHub) {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    const items = [
      { hub: 'library', action: 'hub', label: I18n.t('shell.hub.library') },
      { hub: 'work', action: 'hub', label: I18n.t('shell.hub.work') },
      { hub: null, action: 'create', label: I18n.t('topbar.new'), fab: true },
      { hub: 'home', action: 'hub', label: I18n.t('shell.hub.home') },
      { hub: 'projects', action: 'hub', label: I18n.t('shell.hub.projects') },
    ];
    nav.innerHTML = items.map((item) => {
      if (item.fab) {
        return `<button type="button" class="bottom-nav-fab" id="bottom-nav-create" aria-label="${Utils.esc(item.label)}"><span>+</span></button>`;
      }
      const hub = this.hubs[item.hub];
      const active = activeHub === item.hub;
      return `<button type="button" class="bottom-nav-item ${active ? 'active' : ''}" data-hub="${item.hub}" aria-label="${Utils.esc(item.label)}"><span class="bottom-nav-icon">${hub.icon}</span><span class="bottom-nav-label">${Utils.esc(item.label)}</span></button>`;
    }).join('');
    nav.querySelectorAll('[data-hub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hubId = btn.dataset.hub;
        App.currentHub = hubId;
        const hub = this.hubs[hubId];
        const view = hub.tabs.some((t) => t.view === App.currentView) ? App.currentView : hub.defaultView;
        App.navigate(view);
      });
    });
    document.getElementById('bottom-nav-create')?.addEventListener('click', () => App.openAddMenu());
  },

  updateHeaderBadges() {
    const inboxN = this.badgeCount('inbox');
    const overdueN = this.badgeCount('overdue');
    const todayN = this.todayEventCount();
    const notifTotal = inboxN + overdueN;
    const setBadge = (id, n) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = String(n);
      el.classList.toggle('hidden', n === 0);
    };
    setBadge('header-badge-inbox', notifTotal);
    setBadge('header-badge-today', todayN);
  },

  bindEvents() {
    document.getElementById('btn-header-profile')?.addEventListener('click', () => App.navigate('settings'));
    document.getElementById('btn-notif')?.addEventListener('click', () => {
      App.currentHub = 'home';
      const inboxN = this.badgeCount('inbox');
      App.navigate(inboxN > 0 ? 'inbox' : 'overdue');
    });
    document.getElementById('btn-cal-nav')?.addEventListener('click', () => {
      App.currentHub = 'home';
      App.navigate('calendar');
    });
    document.getElementById('btn-header-search')?.addEventListener('click', () => App.openCommandPalette());
  },
};
