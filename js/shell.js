const AppShell = {
  _tabsBound: false,
  _swipeBound: false,
  _bottomNavBound: false,
  _touchStartX: 0,
  _touchStartY: 0,

  hubs: {
    home: {
      icon: '⌂',
      i18n: 'shell.hub.home',
      defaultView: 'dashboard',
      primary: true,
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

  viewToHub(view) {
    for (const [hubId, hub] of Object.entries(this.hubs)) {
      if (hub.tabs.some((t) => t.view === view)) return hubId;
    }
    return 'home';
  },

  getTabIndex(hubId, view) {
    const hub = this.hubs[hubId];
    if (!hub) return -1;
    return hub.tabs.findIndex((t) => t.view === view);
  },

  getAdjacentTab(view, direction) {
    const hubId = App.currentHub || this.viewToHub(view);
    const hub = this.hubs[hubId];
    if (!hub) return null;
    const idx = this.getTabIndex(hubId, view);
    const next = hub.tabs[idx + direction];
    return next?.view || null;
  },

  useTransitions() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return window.innerWidth <= 1024;
  },

  transitionKind(prevView, view, prevHub, newHub, source) {
    if (!prevView || prevView === view) return null;
    if (source === 'hub' || prevHub !== newHub) return 'hub';
    const prevIdx = this.getTabIndex(newHub, prevView);
    const newIdx = this.getTabIndex(newHub, view);
    if (prevIdx < 0 || newIdx < 0 || prevIdx === newIdx) return 'fade';
    return newIdx > prevIdx ? 'forward' : 'backward';
  },

  runTransition(kind, applyFn) {
    const stage = document.getElementById('content-stage');
    if (!kind || !stage || !this.useTransitions()) {
      applyFn();
      return;
    }

    const exitMap = {
      forward: 'page-exit-left',
      backward: 'page-exit-right',
      hub: 'page-exit-hub',
      fade: 'page-exit-fade',
    };
    const enterMap = {
      forward: 'page-enter-right',
      backward: 'page-enter-left',
      hub: 'page-enter-hub',
      fade: 'page-enter-fade',
    };

    const exitCls = exitMap[kind] || exitMap.fade;
    const enterCls = enterMap[kind] || enterMap.fade;
    let finished = false;

    const finishExit = () => {
      if (finished) return;
      finished = true;
      stage.classList.remove(exitCls);
      applyFn();
      stage.classList.add(enterCls);
      stage.addEventListener('animationend', () => {
        stage.classList.remove(enterCls);
      }, { once: true });
    };

    stage.classList.remove(...Object.values(exitMap), ...Object.values(enterMap));
    stage.classList.add(exitCls);
    stage.addEventListener('animationend', finishExit, { once: true });
    setTimeout(finishExit, 300);
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
    requestAnimationFrame(() => this.updateTabIndicator());
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
      const active = App.currentView === t.view;
      return `<button type="button" class="app-tab ${active ? 'active' : ''}" data-view="${t.view}" role="tab" aria-selected="${active}">${I18n.t(t.i18n)}${badge}</button>`;
    }).join('');

    if (!this._tabsBound) {
      this._tabsBound = true;
      el.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-view]');
        if (!btn) return;
        App.navigate(btn.dataset.view, { source: 'tab' });
      });
    }

    requestAnimationFrame(() => this.updateTabIndicator());
  },

  updateTabIndicator() {
    const indicator = document.getElementById('app-tab-indicator');
    const tabs = document.getElementById('app-tabs');
    const active = tabs?.querySelector('.app-tab.active');
    if (!indicator || !active || !tabs) {
      indicator?.classList.remove('visible');
      return;
    }
    const tabsRect = tabs.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    indicator.style.width = `${rect.width}px`;
    indicator.style.transform = `translateX(${rect.left - tabsRect.left + tabs.scrollLeft}px)`;
    indicator.classList.add('visible');
    active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  },

  renderBottomNav(activeHub) {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    const items = [
      { hub: 'library', primary: false },
      { hub: 'work', primary: false },
      { hub: null, fab: true },
      { hub: 'home', primary: true },
      { hub: 'projects', primary: false },
    ];
    nav.innerHTML = items.map((item) => {
      if (item.fab) {
        return `<button type="button" class="bottom-nav-fab" id="bottom-nav-create" aria-label="${Utils.esc(I18n.t('topbar.new'))}"><span>+</span></button>`;
      }
      const hub = this.hubs[item.hub];
      const active = activeHub === item.hub;
      const label = I18n.t(hub.i18n);
      const primaryCls = item.primary ? ' bottom-nav-item--home' : '';
      return `<button type="button" class="bottom-nav-item${primaryCls} ${active ? 'active' : ''}" data-hub="${item.hub}" aria-label="${Utils.esc(label)}" aria-current="${active ? 'page' : 'false'}"><span class="bottom-nav-icon">${hub.icon}</span><span class="bottom-nav-label">${Utils.esc(label)}</span></button>`;
    }).join('');

    if (!this._bottomNavBound) {
      this._bottomNavBound = true;
      nav.addEventListener('click', (e) => {
        const fab = e.target.closest('#bottom-nav-create');
        if (fab) {
          App.openAddMenu();
          return;
        }
        const btn = e.target.closest('[data-hub]');
        if (!btn) return;
        const hubId = btn.dataset.hub;
        App.currentHub = hubId;
        const hub = this.hubs[hubId];
        const view = hub.tabs.some((t) => t.view === App.currentView) ? App.currentView : hub.defaultView;
        App.navigate(view, { source: 'hub' });
      });
    }
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

  bindSwipe() {
    if (this._swipeBound) return;
    const stage = document.getElementById('content-stage');
    if (!stage) return;
    this._swipeBound = true;

    stage.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      this._touchStartX = e.touches[0].clientX;
      this._touchStartY = e.touches[0].clientY;
    }, { passive: true });

    stage.addEventListener('touchend', (e) => {
      if (!this.useTransitions()) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this._touchStartX;
      const dy = t.clientY - this._touchStartY;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const dir = dx < 0 ? 1 : -1;
      const next = this.getAdjacentTab(App.currentView, dir);
      if (next) App.navigate(next, { source: 'tab' });
    }, { passive: true });
  },

  bindEvents() {
    document.getElementById('btn-header-profile')?.addEventListener('click', () => App.navigate('settings', { source: 'hub' }));
    document.getElementById('btn-notif')?.addEventListener('click', () => {
      App.currentHub = 'home';
      const inboxN = this.badgeCount('inbox');
      App.navigate(inboxN > 0 ? 'inbox' : 'overdue', { source: 'tab' });
    });
    document.getElementById('btn-cal-nav')?.addEventListener('click', () => {
      App.currentHub = 'home';
      App.navigate('calendar', { source: 'tab' });
    });
    document.getElementById('btn-header-search')?.addEventListener('click', () => App.openCommandPalette());
    this.bindSwipe();
    window.addEventListener('resize', () => this.updateTabIndicator());
  },
};
