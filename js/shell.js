const AppShell = {
  _tabsBound: false,
  _swipeBound: false,
  _bottomNavBound: false,
  _touchStartX: 0,
  _touchStartY: 0,
  _lastRenderedHub: null,

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
        { view: 'kanban', i18n: 'view.kanban' },
        { view: 'contacts', i18n: 'view.contacts' },
        { view: 'emails', i18n: 'view.emails' },
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
      icon: '▣',
      i18n: 'shell.hub.projects',
      defaultView: 'projects',
      tabs: [
        { view: 'projects', i18n: 'view.projects' },
        { view: 'kanban', i18n: 'view.kanban' },
        { view: 'clients', i18n: 'view.clients' },
      ],
    },
    library: {
      icon: '☰',
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

  viewToHub(view, preferHubId) {
    if (preferHubId && this.hubs[preferHubId]?.tabs.some((t) => t.view === view)) {
      return preferHubId;
    }
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
    return false;
  },

  useTabIndicator() {
    return window.innerWidth > 767 && !('ontouchstart' in window);
  },

  transitionKind(prevView, view, prevHub, newHub, source) {
    if (!prevView || prevView === view) return null;
    if (source === 'tab') return null;
    if (source === 'hub' || prevHub !== newHub) return 'fade';
    return null;
  },

  runTransition(kind, applyFn) {
    if (!kind || !this.useTransitions()) {
      applyFn();
      return;
    }

    const content = document.getElementById('content');
    if (!content) {
      applyFn();
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      content.classList.remove('page-exit-fade', 'page-enter-fade');
      applyFn();
    };

    content.classList.add('page-exit-fade');
    content.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 200);
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
    this.renderSidebarHubs(hubId);
    this.renderBreadcrumb();
    this.renderTabs(hubId);
    this.renderBottomNav(hubId);
    this.updateHeaderBadges();
  },

  renderSidebarHubs(activeHub) {
    const el = document.getElementById('sidebar-hubs');
    if (!el) return;
    if (!this._hubsBound) {
      this._hubsBound = true;
      el.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-hub]');
        if (!btn) return;
        const hubId = btn.dataset.hub;
        App.currentHub = hubId;
        const hub = this.hubs[hubId];
        const view = hub.tabs.some((t) => t.view === App.currentView) ? App.currentView : hub.defaultView;
        App.navigate(view, { source: 'hub' });
      });
    }
    el.innerHTML = `
      <div class="nav-section-label" data-i18n="shell.nav.section">${Utils.esc(I18n.t('shell.nav.section'))}</div>
      ${Object.entries(this.hubs).map(([id, hub]) => `
      <button type="button" class="sidebar-hub-btn ${activeHub === id ? 'active' : ''}" data-hub="${id}">
        <span class="nav-icon">${hub.icon}</span>
        <span>${Utils.esc(I18n.t(hub.i18n))}</span>
      </button>
    `).join('')}`;
  },

  renderBreadcrumb() {
    const el = document.getElementById('app-breadcrumb');
    if (!el) return;
    const hubId = App.currentHub || this.viewToHub(App.currentView);
    const hub = this.hubs[hubId];
    const parts = [{ label: I18n.t(hub.i18n), current: false }];

    if (App.currentView === 'projects' && App.projectDetailId) {
      const p = Store.getProject(App.projectDetailId);
      parts.push({ label: I18n.t('view.projects'), current: false });
      if (p) parts.push({ label: p.name, current: false });
      const tabLabels = { overview: 'Overview', tasks: 'Tasks', notes: 'Notes', events: 'Events', contacts: 'Contacts', links: 'Links', attachments: 'Attachments', hours: 'Hours', versions: 'Versions' };
      parts.push({ label: tabLabels[App.projectTab] || App.projectTab, current: true });
    } else if (App.currentView === 'clients' && App.clientDetailId) {
      const c = Store.getClient(App.clientDetailId);
      parts.push({ label: I18n.t('view.clients'), current: false });
      parts.push({ label: c?.name || '—', current: true });
    } else {
      const tab = hub.tabs.find((t) => t.view === App.currentView);
      if (tab) parts.push({ label: I18n.t(tab.i18n), current: true });
      else parts[0].current = true;
    }

    el.innerHTML = parts.map((p, i) => {
      const sep = i > 0 ? '<span class="sep" aria-hidden="true">›</span>' : '';
      return `${sep}<span class="${p.current ? 'current' : 'muted'}">${Utils.esc(p.label)}</span>`;
    }).join('');
  },

  renderTabs(hubId) {
    const wrap = document.getElementById('app-tabs-wrap');
    const el = document.getElementById('app-tabs');
    if (!el || !wrap) return;
    const hub = this.hubs[hubId];
    if (!hub) {
      wrap.classList.add('hidden');
      this._lastRenderedHub = null;
      return;
    }
    wrap.classList.remove('hidden');

    const hubUnchanged = this._lastRenderedHub === hubId
      && el.querySelectorAll('.app-tab').length === hub.tabs.length;

    if (hubUnchanged) {
      el.querySelectorAll('.app-tab').forEach((btn) => {
        const active = btn.dataset.view === App.currentView;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      this.scrollActiveTabIntoView(false);
      if (this.useTabIndicator()) this.updateTabIndicator();
      return;
    }

    this._lastRenderedHub = hubId;
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

    this.scrollActiveTabIntoView(false);
    if (this.useTabIndicator()) requestAnimationFrame(() => this.updateTabIndicator());
  },

  scrollActiveTabIntoView(smooth) {
    const tabs = document.getElementById('app-tabs');
    const active = tabs?.querySelector('.app-tab.active');
    if (!tabs || !active) return;
    const left = active.offsetLeft - (tabs.clientWidth - active.offsetWidth) / 2;
    tabs.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
  },

  updateTabIndicator() {
    if (!this.useTabIndicator()) return;
    const indicator = document.getElementById('app-tab-indicator');
    const tabs = document.getElementById('app-tabs');
    const active = tabs?.querySelector('.app-tab.active');
    if (!indicator || !active || !tabs) {
      indicator?.classList.remove('visible');
      return;
    }
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft}px)`;
    indicator.classList.add('visible');
  },

  renderBottomNav(activeHub) {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;

    const existing = nav.querySelector('[data-hub], .bottom-nav-fab');
    if (existing) {
      nav.querySelectorAll('[data-hub]').forEach((btn) => {
        const active = btn.dataset.hub === activeHub;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-current', active ? 'page' : 'false');
      });
      return;
    }

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
    /* Desativado no telemóvel — conflitava com scroll horizontal (timeline, kanban). */
  },

  bindMobileZoomLock() {
    if (!window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

    const blockGesture = (e) => e.preventDefault();
    document.addEventListener('gesturestart', blockGesture, { passive: false });
    document.addEventListener('gesturechange', blockGesture, { passive: false });
    document.addEventListener('gestureend', blockGesture, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
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
    this.bindMobileZoomLock();
    window.addEventListener('resize', () => {
      if (AppShell.useTabIndicator()) AppShell.updateTabIndicator();
    });
  },
};
