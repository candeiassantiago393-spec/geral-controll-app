const AppViews = {
  itemMeta(item) {
    const parts = [];
    if (item.areaId) { const a = Store.getArea(item.areaId); if (a) parts.push(`${a.icon} ${a.name}`); }
    if (item.projectId) { const p = Store.getProject(item.projectId); if (p) parts.push(p.name); }
    if (item.subContextId && item.areaId) {
      const ctx = Store.getArea(item.areaId)?.subContexts?.find((c) => c.id === item.subContextId);
      if (ctx) parts.push(`${ctx.icon} ${ctx.name}`);
    }
    if (item.dueDate) parts.push(`Due: ${Utils.fmtDate(item.dueDate)}`);
    if (item.duration) parts.push(`${item.duration} min`);
    if (item.hoursLogged) parts.push(`${item.hoursLogged}h`);
    if (item.workStatus && item.workStatus !== 'In progress') parts.push(item.workStatus);
    return parts.join(' · ');
  },

  renderItemCard(item) {
    if (item.isSchoolSchedule) {
      return `<div class="item-card school-item">
        <div class="item-type">🏫 School · ${Utils.fmtTime(item.startDate)}–${Utils.fmtTime(item.endDate)}</div>
        <div class="item-title">${Utils.esc(item.title)}</div>
        ${item.location ? `<div class="school-room">Room ${Utils.esc(item.location)}</div>` : ''}
      </div>`;
    }
    const pin = item.pinned ? '<span class="tag" style="background:var(--warning);color:#000">📌</span> ' : '';
    const overdue = Utils.isOverdue(item) ? '<span class="tag" style="background:rgba(255,71,87,.2);color:var(--danger)">overdue</span> ' : '';
    let extra = '';
    if (item.type === 'contact') {
      const grp = item.contactGroupId ? Store.getContactGroup(item.contactGroupId) : null;
      const ci = item.contactInfo || {};
      extra = `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">
        ${ci.company ? Utils.esc(ci.company) + ' · ' : ''}${Utils.esc(ci.email || ci.phone || '')}</div>`;
      if (grp) extra = `<span class="tag contact-group-tag" style="border-color:${grp.color};color:${grp.color}">${grp.icon} ${Utils.esc(grp.name)}</span> ` + extra;
    }
    if (item.type === 'link' && item.url) extra = `<div style="font-size:12px;color:var(--green);margin-top:6px">${Utils.esc(item.url)}</div>`;
    if (item.type === 'checklist' && item.checklistItems?.length) {
      const done = item.checklistItems.filter((c) => c.done).length;
      extra = `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">${done}/${item.checklistItems.length} done</div>`;
    }
    return `
      <div class="item-card ${item.completed ? 'completed' : ''}" data-action="open-item" data-id="${item.id}">
        <div class="item-type">${Utils.typeIcon(item.type)} ${Utils.typeLabel(item.type)} ${pin}${overdue}</div>
        <div class="item-title">${Utils.esc(item.title)}</div>
        ${item.body ? `<p class="item-body-preview">${Utils.esc(item.body.slice(0, 120))}${item.body.length > 120 ? '…' : ''}</p>` : ''}
        ${extra}
        <div class="item-meta">${Utils.esc(this.itemMeta(item))}
          ${item.tags.map((t) => `<span class="tag tag-click" data-action="filter-tag" data-tag="${Utils.esc(t)}">#${Utils.esc(t)}</span>`).join('')}
        </div>
        <div class="item-actions">
          <button class="btn btn-sm" data-action="open-item" data-id="${item.id}">${I18n.t('action.edit')}</button>
          ${item.archived ? `<button class="btn btn-sm btn-ghost" data-action="unarchive-item" data-id="${item.id}">${I18n.t('action.restore')}</button>` : `<button class="btn btn-sm btn-ghost" data-action="toggle-pin" data-id="${item.id}">${item.pinned ? I18n.t('action.unpin') : I18n.t('action.pin')}</button>
          <button class="btn btn-sm btn-ghost" data-action="archive-item" data-id="${item.id}">${I18n.t('action.archive')}</button>`}
          <button class="btn btn-sm btn-ghost danger-left" data-action="delete-item" data-id="${item.id}">${I18n.t('action.delete')}</button>
        </div>
      </div>`;
  },

  renderTaskRow(item) {
    const canCheck = item.type === 'task';
    const timer = Store.state.settings.activeTimer;
    const isRunning = timer?.itemId === item.id;
    const elapsed = isRunning ? Store.getTimerElapsed() : 0;
    const timerLabel = isRunning ? `⏱ ${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}` : '⏱';
    return `
      <div class="task-row ${Utils.isOverdue(item) ? 'task-overdue' : ''}">
        <div class="task-check ${item.completed ? 'checked' : ''}" data-action="${canCheck ? 'toggle-task' : 'open-item'}" data-id="${item.id}">${item.completed ? '✓' : ''}</div>
        <div class="task-content ${item.completed ? 'completed' : ''}" data-action="open-item" data-id="${item.id}">
          <div class="task-title">${item.pinned ? '📌 ' : ''}${Utils.esc(item.title)}</div>
          <div class="task-details">${Utils.esc(this.itemMeta(item))}</div>
        </div>
        ${canCheck && !item.completed ? `<button class="btn btn-sm btn-ghost timer-btn ${isRunning ? 'active' : ''}" data-action="${isRunning ? 'stop-timer' : 'start-timer'}" data-id="${item.id}">${timerLabel}</button>` : ''}
      </div>`;
  },

  renderDashboard() {
    const stats = App.getFilteredStats();
    const widgets = Store.getDashboardWidgets();
    const show = (k) => widgets.includes(k);
    const pinned = App.getFilteredItems({ pinned: true }).slice(0, 5);
    const overdue = App.getFilteredItems({ overdue: true });
    const devStage = Store.getPipelineStages().find((s) => s.toLowerCase().includes('desenvolv')) || 'In development';
    const devProjects = App.filterProjects(Store.state.projects.filter((p) => p.areaId === 'area-freelance' && p.pipeline === devStage));
    const recent = App.filterItems(Store.state.settings.recentItems.map((id) => Store.getItem(id)).filter(Boolean)).slice(0, 5);
    const review = App.getFilteredWeeklyReview();

    let html = App.renderScopeBanner();
    if (show('banners')) {
      const emptyScore = typeof CloudSync !== 'undefined' ? CloudSync.dataScore(Store.state) : 0;
      html += `${stats.overdue > 0 ? `<div class="overdue-banner">⚠ ${stats.overdue} overdue task(s) · <a href="#" data-action="nav" data-view="overdue">View all</a></div>` : ''}
      ${stats.inbox > 0 ? `<div class="info-banner">📥 ${stats.inbox} no Inbox · <a href="#" data-action="nav" data-view="inbox">Classify</a></div>` : ''}
      ${emptyScore === 0 ? `<div class="overdue-banner" style="border-color:#f59e0b">⚠ App looks empty · <a href="#" data-action="restore-my-data">Recover my data</a></div>` : ''}
      ${Store.state.settings.fullDemoLoaded ? `<div class="info-banner" style="opacity:0.85">💡 Demo data loaded · <a href="#" data-action="clear-all-data">Clear and start fresh</a></div>` : ''}`;
    }
    if (show('stats')) {
      const openPct = stats.tasksOpen + stats.tasksWeekDone > 0
        ? Math.round((stats.tasksWeekDone / (stats.tasksOpen + stats.tasksWeekDone)) * 100) : 0;
      html += `<div class="insight-grid">
        <div class="insight-card" data-action="nav" data-view="inbox">
          <div><div class="insight-value">${stats.inbox}</div><div class="insight-label">${I18n.t('view.inbox')}</div></div>
          <div class="insight-hint">${stats.inbox > 0 ? I18n.t('shell.hint.inbox') : I18n.t('shell.hint.inboxZero')}</div>
        </div>
        <div class="insight-card" data-action="nav" data-view="tasks">
          <div><div class="insight-value">${stats.tasksOpen}</div><div class="insight-label">${I18n.t('shell.metric.openTasks')}</div></div>
          <div class="insight-hint">${stats.tasksWeekDone} ${I18n.t('shell.metric.doneWeek')}</div>
        </div>
        <div class="insight-card" data-action="nav" data-view="overdue">
          <div><div class="insight-value">${stats.overdue}</div><div class="insight-label">${I18n.t('view.overdue')}</div></div>
          <div class="insight-hint">${stats.overdue > 0 ? I18n.t('shell.hint.overdue') : '✓'}</div>
        </div>
        <div class="insight-card" data-action="nav" data-view="projects">
          <div><div class="insight-value">${stats.projects}</div><div class="insight-label">${I18n.t('view.projects')}</div></div>
          <div class="insight-hint">${stats.hoursLogged}h ${I18n.t('shell.metric.logged')}</div>
        </div>
      </div>
      <div class="engage-section">
        <div class="engage-title">${I18n.t('shell.engage.title')}</div>
        <div class="engage-scroll">
          <div class="engage-card" data-action="nav" data-view="tasks"><div class="engage-icon">⚡</div><div class="engage-val">${openPct}%</div><div class="engage-lbl">${I18n.t('shell.engage.completion')}</div></div>
          <div class="engage-card" data-action="nav" data-view="pinned"><div class="engage-icon">📌</div><div class="engage-val">${pinned.length}</div><div class="engage-lbl">${I18n.t('view.pinned')}</div></div>
          <div class="engage-card" data-action="nav" data-view="review"><div class="engage-icon">📋</div><div class="engage-val">${review.done.length}</div><div class="engage-lbl">${I18n.t('shell.engage.done')}</div></div>
          <div class="engage-card" data-action="nav" data-view="stats"><div class="engage-icon">📊</div><div class="engage-val">${stats.hoursLogged}h</div><div class="engage-lbl">${I18n.t('shell.metric.hours')}</div></div>
        </div>
      </div>
      <div class="shell-cta" data-action="export-backup">
        <div class="shell-cta-icon">📄</div>
        <div class="shell-cta-body"><div class="shell-cta-title">${I18n.t('shell.cta.backup')}</div><div class="shell-cta-desc">${I18n.t('shell.cta.backupDesc')}</div></div>
        <button type="button" class="shell-cta-btn" aria-hidden="true">↓</button>
      </div>
      <div class="stats-grid desktop-stats">
        <div class="stat-card" data-action="nav" data-view="inbox"><div class="stat-value">${stats.inbox}</div><div class="stat-label">Inbox</div></div>
        <div class="stat-card" data-action="nav" data-view="tasks"><div class="stat-value">${stats.tasksOpen}</div><div class="stat-label">Open tasks</div></div>
        <div class="stat-card"><div class="stat-value">${stats.tasksWeekDone}</div><div class="stat-label">Done/week</div></div>
        <div class="stat-card" data-action="nav" data-view="overdue"><div class="stat-value">${stats.overdue}</div><div class="stat-label">Overdue</div></div>
        <div class="stat-card" data-action="nav" data-view="projects"><div class="stat-value">${stats.projects}</div><div class="stat-label">Projects</div></div>
        <div class="stat-card"><div class="stat-value">${stats.hoursLogged}h</div><div class="stat-label">Hours logged</div></div>
      </div>`;
    }
    html += '<div class="dash-grid"><div>';
    if (show('pinned') && pinned.length) {
      html += `<div class="section-header"><div class="section-title">📌 Pinned</div></div>${pinned.map((i) => this.renderItemCard(i)).join('')}`;
    }
    if (show('recent')) {
      html += `<div class="section-header"><div class="section-title">Recentes</div></div>
        ${recent.length ? recent.map((i) => this.renderItemCard(i)).join('') : App.getFilteredItems().slice(0, 4).map((i) => this.renderItemCard(i)).join('')}`;
    }
    html += '</div><div>';
    if (show('dev')) {
      html += `<div class="section-header"><div class="section-title">candeias.dev — In dev</div></div>
        ${devProjects.map((p) => this.renderProjectMini(p)).join('') || '<p class="muted">No projects in dev</p>'}`;
    }
    if (show('overdue') && overdue.length) {
      html += `<div class="section-header mt"><div class="section-title danger">Overdue</div></div>${overdue.slice(0, 3).map((i) => this.renderTaskRow(i)).join('')}`;
    }
    if (show('review')) {
      html += `<div class="section-header mt"><div class="section-title">Weekly review</div><button class="btn btn-sm" data-action="nav" data-view="review">Open</button></div>
        <p class="muted">${review.done.length} completed · ${review.open.length} open · ${review.inbox.length} inbox</p>`;
    }
    html += `</div></div>
      <footer class="app-footer"><a href="https://candeias.dev" target="_blank" rel="noopener">candeias.dev</a> · Candeias v${APP_VERSION}</footer>`;
    return html;
  },

  renderProjectMini(p) {
    return `<div class="project-card mini" data-action="open-project" data-id="${p.id}">
      <div class="project-header"><div class="project-color" style="background:${p.color}"></div>
      <div><div class="project-name">${Utils.esc(p.name)}</div><div class="project-client">${Utils.esc(p.client)}</div></div></div>
      ${p.pipeline ? `<span class="pipeline-badge">${Utils.esc(p.pipeline)}</span>` : ''}
      ${p.paymentStatus ? `<span class="tag">${Utils.esc(p.paymentStatus)}</span>` : ''}
    </div>`;
  },

  renderInbox() {
    const allItems = Store.getItems({ inbox: true, snoozed: false });
    const items = App.filterInboxItems(allItems);
    const hasFilters = App.inboxFilters.type !== 'all' || App.inboxFilters.priority !== 'all'
      || App.inboxFilters.tag || App.inboxFilters.timeRange !== 'all'
      || App.inboxFilters.pickDate || App.inboxFilters.pickMonth || App.inboxFilters.pickYear;
    const snoozed = Store.state.items.filter((i) => i.snoozedUntil && i.snoozedUntil > Utils.todayStr());
    return `
      <div class="section-header"><div class="section-title">Inbox (${items.length}${hasFilters ? ` of ${allItems.length}` : ''})</div>
        <button class="btn btn-sm btn-primary" data-action="quick-ultra">⚡ Ultra-fast</button></div>
      ${hasFilters ? `<div class="info-banner">Active filters · <a href="#" data-action="clear-inbox-filters">Clear filters</a></div>` : ''}
      ${items.map((i) => `
        <div class="item-card mb">
          <div class="item-type">${Utils.typeIcon(i.type)} ${Utils.typeLabel(i.type)} · ${Utils.fmtDate(i.createdAt.slice(0, 10))}</div>
          <div class="item-title">${Utils.esc(i.title)}</div>
          <p class="muted">${Utils.esc(i.body)}</p>
          <div class="btn-row">
            <button class="btn btn-sm btn-primary" data-action="classify-inbox" data-id="${i.id}">Classify</button>
            <button class="btn btn-sm" data-action="open-item" data-id="${i.id}">Edit</button>
            <button class="btn btn-sm" data-action="snooze-item" data-id="${i.id}">Snooze 1d</button>
            <button class="btn btn-sm btn-ghost" data-action="delete-item" data-id="${i.id}">Delete</button>
          </div>
        </div>`).join('') || `<div class="empty-state"><div class="icon">📥</div><h3>${hasFilters ? 'No items match these filters' : 'Inbox empty'}</h3><p>Streak: ${Store.state.settings.inboxStreak || 0} days</p></div>`}
      ${snoozed.length ? `<div class="section-header mt"><div class="section-title">Snoozed</div></div>${snoozed.map((i) => this.renderItemCard(i)).join('')}` : ''}`;
  },

  renderToday() {
    const today = Utils.todayStr();
    let events = App.getFilteredItems({ types: ['event', 'reminder'] }).filter((i) => i.startDate?.startsWith(today));
    let tasks = App.getFilteredItems({ type: 'task', period: 'day', snoozed: false });
    let dueToday = App.filterItems(Store.state.items.filter((i) => i.type === 'task' && !i.completed && i.dueDate === today && !i.archived));
    const allTasks = [...new Map([...tasks, ...dueToday].map((t) => [t.id, t])).values()];
    return `${App.renderScopeBanner()}
      <div class="section-header"><div class="section-title">Events & Reminders</div></div>
      ${events.length ? events.map((i) => this.renderItemCard(i)).join('') : '<p class="muted mb">No events today</p>'}
      <div class="section-header mt"><div class="section-title">Tasks</div></div>
      ${allTasks.length ? allTasks.map((i) => this.renderTaskRow(i)).join('') : '<div class="empty-state"><div class="icon">☀</div><h3>Free day</h3></div>'}`;
  },

  renderOverdue() {
    const items = App.getFilteredItems({ overdue: true });
    return `${App.renderScopeBanner()}<div class="section-header"><div class="section-title">Overdue (${items.length})</div></div>
      ${items.length ? items.map((i) => this.renderTaskRow(i)).join('') : '<div class="empty-state"><h3>Nothing overdue 🎉</h3></div>'}`;
  },

  renderPinned() {
    const items = App.getFilteredItems({ pinned: true });
    return `${App.renderScopeBanner()}<div class="section-header"><div class="section-title">Pinned (${items.length})</div></div>
      ${items.map((i) => this.renderItemCard(i)).join('') || '<div class="empty-state"><p>No pinned items</p></div>'}`;
  },

  renderBlocked() {
    const items = App.getFilteredItems({ blocked: true });
    return `${App.renderScopeBanner()}<div class="section-header"><div class="section-title">Blocked (${items.length})</div></div>
      ${items.map((i) => this.renderTaskRow(i)).join('') || '<div class="empty-state"><p>Nothing blocked</p></div>'}`;
  },

  renderArchive() {
    const allItems = Store.getItems({ archived: true });
    const allProjects = Store.getArchivedProjects();
    let items = App.filterArchiveByDate(allItems);
    let projects = App.filterArchiveByDate(allProjects);
    items = App.filterItems(items);
    projects = App.filterProjects(projects);
    const hasFilters = App.hasArchiveDateFilters();
    return `${App.renderScopeBanner()}
      <div class="section-header"><div class="section-title">${I18n.t('view.archive')}</div></div>
      ${hasFilters ? `<div class="info-banner">Date filters active · ${projects.length} of ${allProjects.length} projects · ${items.length} of ${allItems.length} items · <a href="#" data-action="clear-archive-filters">Clear filters</a></div>` : ''}
      <h3 class="sub-heading">${I18n.t('archive.projects')} (${projects.length}${hasFilters ? ` of ${allProjects.length}` : ''})</h3>
      ${projects.map((p) => `<div class="item-card mb">
        <div class="flex-center" data-action="open-project" data-id="${p.id}" style="cursor:pointer">
          <strong>${Utils.esc(p.name)}</strong>
          <span class="muted sm"> · ${Utils.fmtDate(App.archiveDateStr(p))}</span>
        </div>
        <div class="item-actions mt">
          <button class="btn btn-sm" data-action="edit-project" data-id="${p.id}">${I18n.t('action.edit')}</button>
          <button class="btn btn-sm btn-ghost" data-action="unarchive-project" data-id="${p.id}">${I18n.t('action.restore')}</button>
          <button class="btn btn-sm btn-ghost danger-left" data-action="delete-project" data-id="${p.id}">${I18n.t('action.delete')}</button>
        </div>
      </div>`).join('') || `<p class="muted">${I18n.t('archive.noProjects')}</p>`}
      <h3 class="sub-heading mt">${I18n.t('archive.items')} (${items.length}${hasFilters ? ` of ${allItems.length}` : ''})</h3>
      ${items.map((i) => this.renderItemCard(i)).join('') || `<p class="muted">${hasFilters ? 'No items match these dates' : I18n.t('archive.noItems')}</p>`}`;
  },

  renderReview() {
    const r = App.getFilteredWeeklyReview();
    Store.state.settings.lastWeeklyReview = new Date().toISOString();
    Store.save();
    return `${App.renderScopeBanner()}
      <div class="section-header"><div class="section-title">Weekly review</div></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${r.done.length}</div><div class="stat-label">Completed</div></div>
        <div class="stat-card"><div class="stat-value">${r.open.length}</div><div class="stat-label">Open</div></div>
        <div class="stat-card"><div class="stat-value">${r.inbox.length}</div><div class="stat-label">Inbox</div></div>
        <div class="stat-card"><div class="stat-value">${r.overdue.length}</div><div class="stat-label">Overdue</div></div>
      </div>
      ${r.inbox.length ? `<h3 class="sub-heading">Inbox to classify</h3>${r.inbox.map((i) => this.renderItemCard(i)).join('')}` : '<p class="muted">✓ Inbox zero!</p>'}
      ${r.overdue.length ? `<h3 class="sub-heading mt danger">Overdue</h3>${r.overdue.map((i) => this.renderTaskRow(i)).join('')}` : ''}
      ${r.blocked.length ? `<h3 class="sub-heading mt">Blocked</h3>${r.blocked.map((i) => this.renderTaskRow(i)).join('')}` : ''}
      <h3 class="sub-heading mt">This week</h3>
      ${r.weekItems.slice(0, 15).map((i) => i.type === 'task' ? this.renderTaskRow(i) : this.renderItemCard(i)).join('') || '<p class="muted">No items</p>'}`;
  },

  renderStats() {
    const stats = App.getFilteredStats();
    const byArea = Store.state.areas.map((a) => ({
      area: a, count: App.getFilteredItems({ areaId: a.id }).length,
    }));
    const tags = Store.getAllTags().slice(0, 15);
    return `${App.renderScopeBanner()}
      <div class="section-header"><div class="section-title">Statistics</div></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${stats.tasksDone}</div><div class="stat-label">Tasks done</div></div>
        <div class="stat-card"><div class="stat-value">${stats.tasksWeekDone}</div><div class="stat-label">This week</div></div>
        <div class="stat-card"><div class="stat-value">${stats.hoursLogged}h</div><div class="stat-label">Project hours</div></div>
        <div class="stat-card"><div class="stat-value">${stats.inboxStreak || Store.state.settings.inboxStreak}</div><div class="stat-label">Inbox streak</div></div>
      </div>
      <h3 class="sub-heading">By area</h3>
      <div class="stats-grid">${byArea.map(({ area, count }) => `<div class="stat-card"><div class="stat-value">${count}</div><div class="stat-label">${area.icon} ${Utils.esc(area.name)}</div></div>`).join('')}</div>
      <h3 class="sub-heading mt">Popular tags</h3>
      <div class="tag-cloud">${tags.map((t) => `<span class="tag tag-click" data-action="filter-tag" data-tag="${Utils.esc(t)}">#${Utils.esc(t)}</span>`).join('')}</div>`;
  },

  renderContactCard(item) {
    const grp = item.contactGroupId ? Store.getContactGroup(item.contactGroupId) : null;
    const ci = item.contactInfo || {};
    return `<div class="contact-card item-card mb">
      <div class="contact-card-head">
        <div class="contact-card-avatar" style="background:${grp?.color || 'var(--green-dim)'}">${grp?.icon || '👤'}</div>
        <div class="contact-card-main">
          <div class="item-title">${Utils.esc(item.title)}</div>
          ${ci.company ? `<div class="muted sm">${Utils.esc(ci.company)}</div>` : ''}
          ${grp ? `<span class="tag contact-group-tag" style="border-color:${grp.color};color:${grp.color}">${grp.icon} ${Utils.esc(grp.name)}</span>` : ''}
        </div>
      </div>
      ${item.body ? `<p class="item-body-preview muted">${Utils.esc(item.body.slice(0, 100))}</p>` : ''}
      <div class="contact-card-details">
        ${ci.email ? `<div class="contact-detail-row">✉ <a href="mailto:${Utils.esc(ci.email)}">${Utils.esc(ci.email)}</a></div>` : ''}
        ${ci.phone ? `<div class="contact-detail-row">📞 <a href="tel:${Utils.esc(ci.phone)}">${Utils.esc(ci.phone)}</a></div>` : ''}
      </div>
      <div class="item-actions">
        ${ci.email ? `<button class="btn btn-sm btn-ghost" data-action="copy-contact-email" data-id="${item.id}">Copy email</button>` : ''}
        ${ci.phone ? `<button class="btn btn-sm btn-ghost" data-action="copy-contact-phone" data-id="${item.id}">Copy phone</button>` : ''}
        <button class="btn btn-sm" data-action="open-item" data-id="${item.id}">Edit</button>
        <button class="btn btn-sm btn-ghost" data-action="archive-item" data-id="${item.id}">Archive</button>
      </div>
      </div>`;
  },

  renderEmailAccountCard(account, expanded = false) {
    const connected = typeof Gmail !== 'undefined' && Gmail.isTokenValid(account);
    const preview = account.gmailPreview || [];
    const messages = expanded ? preview : preview.slice(0, 3);
    const fromShort = (from) => {
      const m = from.match(/^([^<]+)</);
      return Utils.esc((m ? m[1] : from).trim().replace(/"/g, '') || from);
    };
    return `<div class="email-account-card item-card" style="border-color:${account.color}44">
      <div class="email-account-head">
        <span class="area-dot lg" style="background:${account.color}"></span>
        <div class="flex1">
          <div class="email-account-title">${account.icon} ${Utils.esc(account.name)}</div>
          <div class="muted sm">${Utils.esc(account.email)}</div>
        </div>
        ${connected ? `<span class="email-status connected">● Synced</span>` : ''}
        ${account.unreadCount > 0 ? `<span class="nav-badge">${account.unreadCount}</span>` : ''}
      </div>
      <div class="btn-row mt mb">
        <button class="btn btn-sm btn-primary" data-action="open-gmail-external" data-id="${account.id}">Open Gmail</button>
        <button class="btn btn-sm" data-action="compose-email" data-id="${account.id}">Compose</button>
        ${connected
          ? `<button class="btn btn-sm btn-ghost" data-action="refresh-gmail" data-id="${account.id}">↻ Refresh</button>
             <button class="btn btn-sm btn-ghost" data-action="disconnect-gmail" data-id="${account.id}">Disconnect</button>`
          : `<button class="btn btn-sm" data-action="connect-gmail" data-id="${account.id}">Connect Gmail</button>`}
        ${!expanded ? `<button class="btn btn-sm btn-ghost" data-action="email-filter" data-id="${account.id}">View all</button>` : ''}
      </div>
      ${account.lastFetch ? `<p class="muted sm mb">Last sync: ${new Date(account.lastFetch).toLocaleString()}</p>` : ''}
      ${messages.length ? `<div class="email-preview-list">
        ${messages.map((m) => `<button type="button" class="email-message-row ${m.unread ? 'unread' : ''}" data-action="open-gmail-message" data-id="${account.id}" data-message="${m.id}">
          <div class="email-message-from">${fromShort(m.from)}</div>
          <div class="email-message-subject">${Utils.esc(m.subject)}</div>
          <div class="email-message-snippet muted sm">${Utils.esc(m.snippet)}</div>
        </button>`).join('')}
      </div>` : connected ? '<p class="muted sm">Inbox empty or no recent messages.</p>' : '<p class="muted sm">Connect Gmail to preview inbox here, or open Gmail in the browser.</p>'}
    </div>`;
  },

  renderEmails() {
    const accounts = Store.getEmailAccounts();
    const filter = App.emailFilter || 'all';
    const clientId = Store.state.settings.googleClientId?.trim();
    const filtered = filter === 'all' ? accounts : accounts.filter((a) => a.id === filter);
    const relatedContacts = filter !== 'all'
      ? Store.getItems({ type: 'contact' }).filter((c) => {
          const email = c.contactInfo?.email?.toLowerCase() || '';
          const domain = (Store.getEmailAccount(filter)?.email || '').split('@')[1]?.toLowerCase();
          return domain && email.endsWith(`@${domain}`);
        }).slice(0, 5)
      : [];
    return `<div class="section-header">
      <div class="section-title">Emails${filter !== 'all' ? ` — ${Utils.esc(Store.getEmailAccount(filter)?.name || '')}` : ''}</div>
      <div class="btn-row">
        <button class="btn btn-sm btn-primary" data-action="add-email-account">+ Account</button>
        <button class="btn btn-sm" data-action="manage-email-accounts">⚙ Accounts</button>
        ${filter !== 'all' ? '<button class="btn btn-sm btn-ghost" data-action="email-filter" data-id="all">← All accounts</button>' : ''}
      </div></div>
      <p class="muted mb">Work, school, personal — open Gmail or sync inbox preview when connected.</p>
      ${!clientId ? `<div class="info-banner">📧 To sync inbox here, add your <strong>Google OAuth Client ID</strong> in <a href="#" data-action="nav" data-view="settings" style="color:var(--green)">Settings → Gmail</a>. Without it you can still open Gmail in the browser.</div>` : ''}
      ${filter === 'all' && accounts.length > 1 ? `<div class="email-accounts-grid">${filtered.map((a) => this.renderEmailAccountCard(a, false)).join('')}</div>`
        : filtered.map((a) => this.renderEmailAccountCard(a, true)).join('')}
      ${relatedContacts.length ? `<div class="settings-box mt"><h3 class="sub-heading">Related contacts</h3>
        ${relatedContacts.map((c) => `<div class="category-row item-card mb mini">
          <strong>${Utils.esc(c.title)}</strong>
          <span class="muted sm">${Utils.esc(c.contactInfo?.email || '')}</span>
          <button class="btn btn-sm btn-ghost" data-action="open-item" data-id="${c.id}">Edit</button>
        </div>`).join('')}</div>` : ''}`;
  },

  renderEmailAccountsList() {
    const accounts = Store.getEmailAccounts();
    return `${accounts.map((a) => `<div class="category-row item-card mb mini">
      <span class="area-dot" style="background:${a.color}"></span>
      <span>${a.icon} <strong>${Utils.esc(a.name)}</strong></span>
      <span class="muted sm">${Utils.esc(a.email)}${a.gmailAuthIndex != null ? ` · u/${a.gmailAuthIndex}` : ''}</span>
      <div class="btn-row" style="margin-left:auto">
        <button class="btn btn-sm btn-ghost" data-action="edit-email-account" data-id="${a.id}">Edit</button>
        <button class="btn btn-sm btn-ghost" data-action="delete-email-account" data-id="${a.id}">Delete</button>
      </div></div>`).join('')}
    <button class="btn btn-sm mt btn-primary" data-action="add-email-account">+ New email account</button>`;
  },

  renderContacts() {
    const groups = Store.getContactGroups();
    let items = App.getFilteredItems({ type: 'contact' });
    if (App.contactFilter && App.contactFilter !== 'all') {
      items = items.filter((i) => i.contactGroupId === App.contactFilter);
    }
    if (App.contactSearch) {
      const q = App.contactSearch.toLowerCase();
      items = items.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.body?.toLowerCase().includes(q) ||
        i.contactInfo?.email?.toLowerCase().includes(q) ||
        i.contactInfo?.phone?.includes(q) ||
        i.contactInfo?.company?.toLowerCase().includes(q)
      );
    }
    const total = App.getFilteredItems({ type: 'contact' }).length;
    const counts = Object.fromEntries(groups.map((g) => [g.id, App.getFilteredItems({ type: 'contact', contactGroupId: g.id }).length]));
    return `${App.renderScopeBanner()}<div class="section-header"><div class="section-title">Contacts (${items.length}${App.contactFilter !== 'all' || App.contactSearch ? ` of ${total}` : ''})</div>
      <div class="btn-row">
        <button class="btn btn-sm btn-primary" data-action="new-contact">+ Contact</button>
        <button class="btn btn-sm" data-action="manage-contact-groups">⚙ Groups</button>
      </div></div>
      <p class="muted mb">Filter by group. Customize categories in <a href="#" data-action="nav" data-view="personalization" style="color:var(--green)">Personalization</a>.</p>
      ${App.contactFilter !== 'all' || App.contactSearch ? `<div class="info-banner">Active filters · <a href="#" data-action="clear-contact-filters">Clear</a></div>` : ''}
      ${items.map((i) => this.renderContactCard(i)).join('') || '<div class="empty-state"><p>No contacts in this filter</p></div>'}
      <div class="contact-group-stats mt">
        ${groups.map((g) => `<span class="tag" style="border-color:${g.color};color:${g.color}">${g.icon} ${Utils.esc(g.name)}: ${counts[g.id] || 0}</span>`).join('')}
      </div>`;
  },

  renderConfigStringList(listKey, items, desc) {
    return `<p class="muted mb">${desc}</p>
      ${items.map((item, i) => `<div class="category-row item-card mb mini">
        <span class="config-list-index muted sm">${i + 1}</span>
        <strong>${Utils.esc(item)}</strong>
        <div class="btn-row" style="margin-left:auto">
          <button class="btn btn-sm btn-ghost" data-action="move-config-list" data-list="${listKey}" data-index="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn btn-sm btn-ghost" data-action="move-config-list" data-list="${listKey}" data-index="${i}" data-dir="1" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn btn-sm btn-ghost" data-action="rename-config-list" data-list="${listKey}" data-value="${Utils.esc(item)}">Rename</button>
          <button class="btn btn-sm btn-ghost" data-action="remove-config-list" data-list="${listKey}" data-value="${Utils.esc(item)}">Delete</button>
        </div></div>`).join('')}
      <button class="btn btn-sm btn-primary mt" data-action="add-config-list" data-list="${listKey}">+ Add</button>`;
  },

  renderPersonalization() {
    const tab = App.personalizationTab || 'vault';
    const tabs = [
      ['vault', '🔐 Vault'],
      ['contacts', '👤 Contacts'],
      ['emails', '✉ Emails'],
      ['tags', '🏷 Tags'],
      ['areas', '📁 Areas'],
      ['tasks', '✓ Tasks'],
      ['clients', '🤝 Clients'],
      ['links', '🔗 Links'],
      ['subs', '💳 Subscriptions'],
      ['school', '📚 School'],
      ['templates', '📋 Templates'],
      ['dashboard', '◉ Dashboard'],
      ['data', '⬇ Data'],
    ];
    let body = '';
    if (tab === 'vault') {
      const folders = Store.getVaultFolders();
      body = `<p class="muted mb">Vault folders/filters — passwords, API keys, hosting, university, etc.</p>
        ${folders.map((vf) => {
          const count = Store.state.vaultEntries.filter((e) => e.folder === vf.name).length;
          return `<div class="category-row item-card mb mini">
            <span class="area-dot" style="background:${vf.color}"></span>
            <span>${vf.icon} <strong>${Utils.esc(vf.name)}</strong></span>
            <span class="muted sm">${count} entry(ies)</span>
            <div class="btn-row" style="margin-left:auto">
              <button class="btn btn-sm btn-ghost" data-action="edit-vault-folder" data-id="${vf.id}">Edit</button>
              <button class="btn btn-sm btn-ghost" data-action="delete-vault-folder" data-id="${vf.id}">Delete</button>
            </div></div>`;
        }).join('')}
        <button class="btn btn-sm btn-primary mt" data-action="add-vault-folder">+ New vault folder</button>`;
    } else if (tab === 'contacts') {
      body = `<p class="muted mb">Groups to filter contacts: Work, University, Clients…</p>${this.renderContactGroupsList()}`;
    } else if (tab === 'emails') {
      body = `<p class="muted mb">Email accounts for Work, School, Personal — used in the Emails section and Gmail links.</p>${this.renderEmailAccountsList()}`;
    } else if (tab === 'tags') {
      const tags = Store.getQuickTags();
      body = `<p class="muted mb">Tags shown in Quick Note and capture.</p>
        <div class="tag-cloud mb">${tags.map((t) => `<span class="tag">${Utils.esc(t)} <button type="button" class="tag-del" data-action="delete-quick-tag" data-tag="${Utils.esc(t)}">✕</button></span>`).join('')}</div>
        <div class="form-row">
          <input class="form-control" id="new-quick-tag" placeholder="New tag (e.g. university)">
          <button class="btn btn-sm btn-primary" data-action="add-quick-tag">Add</button>
        </div>`;
    } else if (tab === 'areas') {
      const workspaces = Store.getWorkspaces();
      const areas = Store.state.areas;
      body = `<p class="muted mb">Work areas and workspace mapping (Work, School, Personal).</p>
        <h3 class="sub-heading">Areas</h3>
        ${areas.map((area) => `<div class="category-row item-card mb mini">
          <span class="area-dot" style="background:${area.color}"></span>
          <span>${area.icon} <strong>${Utils.esc(area.name)}</strong></span>
          <span class="muted sm">${Store.getProjectsByArea(area.id).length} proj · ${Store.getItems({ areaId: area.id }).length} items</span>
          <div class="btn-row" style="margin-left:auto">
            <button class="btn btn-sm btn-ghost" data-action="edit-area" data-id="${area.id}">Edit</button>
          </div></div>`).join('')}
        <button class="btn btn-sm btn-primary mt mb" data-action="add-area">+ New area</button>
        <h3 class="sub-heading mt">Workspaces</h3>
        ${Object.entries(workspaces).map(([wsId, ws]) => `<div class="settings-box mb">
          <div class="form-row mb">
            <div class="form-group"><label>Icon</label><input class="form-control ws-icon-input" data-ws-field="icon" data-ws="${wsId}" value="${Utils.esc(ws.icon)}" maxlength="4"></div>
            <div class="form-group flex1"><label>Nome</label><input class="form-control ws-label-input" data-ws-field="label" data-ws="${wsId}" value="${Utils.esc(ws.label)}"></div>
          </div>
          <p class="muted sm mb">Included areas:</p>
          <div class="workspace-area-grid">${areas.map((a) => {
            const checked = (ws.areaIds || []).includes(a.id);
            return `<label class="checkbox-row sm"><input type="checkbox" data-action="toggle-workspace-area" data-ws="${wsId}" data-area="${a.id}" ${checked ? 'checked' : ''}> ${a.icon} ${Utils.esc(a.name)}</label>`;
          }).join('')}</div>
        </div>`).join('')}
        <button class="btn btn-sm" data-action="save-workspaces">Save workspaces</button>`;
    } else if (tab === 'tasks') {
      body = `<h3 class="sub-heading">Kanban columns</h3>
        ${this.renderConfigStringList('kanbanColumns', Store.getKanbanColumns(), 'Kanban board columns (candeias.dev).')}
        <h3 class="sub-heading mt">Work statuses</h3>
        ${this.renderConfigStringList('workStatuses', Store.getWorkStatuses(), 'Internal task status (In progress, Blocked…).')}
        <h3 class="sub-heading mt">Priorities</h3>
        ${this.renderConfigStringList('priorities', Store.getPriorities(), 'Priority levels on tasks.')}`;
    } else if (tab === 'clients') {
      body = `<h3 class="sub-heading">Client statuses</h3>
        ${this.renderConfigStringList('clientStatuses', Store.getClientStatuses(), 'Lead, Active, Inactive…')}
        <h3 class="sub-heading mt">candeias.dev pipeline</h3>
        ${this.renderConfigStringList('pipelineStages', Store.getPipelineStages(), 'Freelance project pipeline stages.')}
        <p class="muted mt sm">Current order: ${Store.getPipelineStages().join(' → ')}</p>
        <h3 class="sub-heading mt">Payment statuses</h3>
        ${this.renderConfigStringList('paymentStatuses', Store.getPaymentStatuses(), 'To invoice, Paid, Partial…')}`;
    } else if (tab === 'links') {
      const cats = Store.getLinkCategories();
      body = `<p class="muted mb">Categories to organize links.</p>
        ${cats.map((c) => {
          const count = Store.getItems({ type: 'link' }).filter((i) => i.linkCategoryId === c.id).length;
          return `<div class="category-row item-card mb mini">
            <span class="area-dot" style="background:${c.color}"></span>
            <span>${c.icon} <strong>${Utils.esc(c.name)}</strong></span>
            <span class="muted sm">${count} link(s)</span>
            <div class="btn-row" style="margin-left:auto">
              <button class="btn btn-sm btn-ghost" data-action="edit-link-category" data-id="${c.id}">Edit</button>
              <button class="btn btn-sm btn-ghost" data-action="delete-link-category" data-id="${c.id}">Delete</button>
            </div></div>`;
        }).join('')}
        <button class="btn btn-sm btn-primary mt" data-action="add-link-category">+ New category</button>`;
    } else if (tab === 'subs') {
      body = this.renderConfigStringList('subscriptionCategories', Store.getSubscriptionCategories(), 'Categories for subscriptions (Personal, Dev, Cloud…).');
    } else if (tab === 'school') {
      const discs = Store.getDisciplines();
      body = `<p class="muted mb">Preset subjects for school grades (Tools → Grades).</p>
        ${discs.map((d) => `<div class="category-row item-card mb mini">
          <strong>${Utils.esc(d.name)}</strong>
          <span class="muted sm">weight ${d.defaultWeight}%</span>
          <div class="btn-row" style="margin-left:auto">
            <button class="btn btn-sm btn-ghost" data-action="edit-discipline" data-id="${d.id}">Edit</button>
            <button class="btn btn-sm btn-ghost" data-action="delete-discipline" data-id="${d.id}">Delete</button>
          </div></div>`).join('')}
        <button class="btn btn-sm btn-primary mt" data-action="add-discipline">+ New subject</button>
        <p class="muted mt sm"><a href="#" data-action="nav" data-view="tools">Open grade calculator</a></p>`;
    } else if (tab === 'templates') {
      const custom = Store.getCustomTemplates();
      body = `<p class="muted mb">Built-in templates plus your custom ones.</p>
        <h3 class="sub-heading">Built-in</h3>
        <div class="card-grid mb">${BUILTIN_TEMPLATES.map((t) => `<div class="item-card mini"><div class="item-type">${t.icon} ${Utils.esc(t.name)}</div><p class="muted sm">Key: ${t.key}</p></div>`).join('')}</div>
        <h3 class="sub-heading">Custom</h3>
        ${custom.map((t) => `<div class="category-row item-card mb mini">
          <span>${t.icon} <strong>${Utils.esc(t.name)}</strong></span>
          <span class="muted sm">${t.type}</span>
          <div class="btn-row" style="margin-left:auto">
            <button class="btn btn-sm btn-ghost" data-action="use-custom-template" data-id="${t.id}">Use</button>
            <button class="btn btn-sm btn-ghost" data-action="delete-custom-template" data-id="${t.id}">Delete</button>
          </div></div>`).join('') || '<p class="muted mb">No custom templates</p>'}
        <button class="btn btn-sm btn-primary mt" data-action="add-custom-template">+ New template</button>`;
    } else if (tab === 'dashboard') {
      body = `<p class="muted mb">Choose what appears on the Dashboard.</p>
        ${DASHBOARD_WIDGETS.map((w) => {
          const checked = Store.getDashboardWidgets().includes(w.key);
          return `<label class="a11y-option item-card mb mini">
            <input type="checkbox" data-action="toggle-dashboard-widget" data-widget="${w.key}" ${checked ? 'checked' : ''}>
            <div><strong>${Utils.esc(w.label)}</strong><p class="muted sm">${Utils.esc(w.desc)}</p></div>
          </label>`;
        }).join('')}`;
    } else if (tab === 'data') {
      body = `<p class="muted mb">Export or import all custom categories and lists (JSON).</p>
        <div class="btn-row">
          <button class="btn btn-sm btn-primary" data-action="export-personalization">⬇ Export config</button>
          <button class="btn btn-sm" data-action="import-personalization">⬆ Import config</button>
        </div>
        <p class="muted mt sm">Includes: vault, contacts, emails, tags, kanban, pipeline, workspaces, links, school, templates, dashboard.</p>`;
    }
    return `<div class="section-header"><div class="section-title">Personalization</div></div>
      <p class="muted mb">Custom categories and filters — adapt the app to your workflow.</p>
      <div class="filter-bar-inline mb personalization-tabs">${tabs.map(([k, l]) => `<button class="filter-chip ${tab === k ? 'active' : ''}" data-personal-tab="${k}">${l}</button>`).join('')}</div>
      <div class="settings-box">${body}</div>`;
  },

  renderContactGroupsList() {
    const groups = Store.getContactGroups();
    return `${groups.map((g) => {
      const count = Store.getItems({ type: 'contact', contactGroupId: g.id }).length;
      return `<div class="category-row item-card mb mini">
        <span class="area-dot" style="background:${g.color}"></span>
        <span>${g.icon} <strong>${Utils.esc(g.name)}</strong></span>
        <span class="muted sm">${count} contact(s)</span>
        <div class="btn-row" style="margin-left:auto">
          <button class="btn btn-sm btn-ghost" data-action="edit-contact-group" data-id="${g.id}">Edit</button>
          <button class="btn btn-sm btn-ghost" data-action="delete-contact-group" data-id="${g.id}">Delete</button>
        </div></div>`;
    }).join('')}
    <button class="btn btn-sm mt btn-primary" data-action="add-contact-group">+ New contact group</button>`;
  },

  renderContactGroupsSettings() {
    return `<div class="settings-box mb"><h3>Contact groups</h3>
      <p class="muted mb">Categories to filter contacts.</p>
      ${this.renderContactGroupsList()}</div>`;
  },

  renderClients() {
    if (App.clientDetailId) return this.renderClientDetail(App.clientDetailId);
    const status = App.clientFilter || 'all';
    let clients = Store.getClients();
    if (status !== 'all') clients = Store.getClients({ status });
    if (App.clientSearch) {
      clients = Store.getClients({ search: App.clientSearch });
    }
    const stats = Store.getStats();
    return `
      <div class="section-header">
        <div class="section-title">Clients — candeias.dev</div>
        <button class="btn btn-primary btn-sm" data-action="new-client">+ Client</button>
      </div>
      <div class="stats-grid mb">
        <div class="stat-card"><div class="stat-value">${stats.clients}</div><div class="stat-label">Total</div></div>
        <div class="stat-card"><div class="stat-value">${stats.clientsActive}</div><div class="stat-label">Active</div></div>
        <div class="stat-card"><div class="stat-value">${stats.leads}</div><div class="stat-label">Leads</div></div>
      </div>
      <div class="filter-bar-inline mb">
        ${['all', ...Store.getClientStatuses()].map((s) => `<button class="filter-chip ${status === s ? 'active' : ''}" data-client-filter="${s}">${s === 'all' ? 'All' : s}</button>`).join('')}
      </div>
      <div class="card-grid">
        ${clients.map((c) => this.renderClientCard(c)).join('')}
      </div>
      ${!clients.length ? '<div class="empty-state"><div class="icon">🤝</div><h3>No clients</h3><p>Add clients from your freelance work</p></div>' : ''}`;
  },

  renderClientCard(c) {
    const projects = Store.getProjectsByClientId(c.id);
    const primary = c.contacts.find((p) => p.isPrimary) || c.contacts[0];
    const statusClass = { Lead: 'status-lead', Active: 'status-active', Ativo: 'status-active', Inactive: 'status-inactive', Inativo: 'status-inactive', Maintenance: 'status-maint', Manutenção: 'status-maint' }[c.status] || '';
    return `
      <div class="client-card" data-action="open-client" data-id="${c.id}">
        <div class="client-card-header">
          <div class="client-avatar">${(c.name[0] || '?').toUpperCase()}</div>
          <div>
            <div class="client-name">${Utils.esc(c.name)}</div>
            <div class="client-company">${Utils.esc(c.company || c.email)}</div>
          </div>
          <span class="client-status ${statusClass}">${Utils.esc(c.status)}</span>
        </div>
        <div class="client-card-body">
          ${c.phone ? `<div class="client-info-row">📞 ${Utils.esc(c.phone)}</div>` : ''}
          ${c.email ? `<div class="client-info-row">✉ ${Utils.esc(c.email)}</div>` : ''}
          ${primary ? `<div class="client-info-row">👤 ${Utils.esc(primary.name)}${primary.role ? ` · ${Utils.esc(primary.role)}` : ''}</div>` : ''}
        </div>
        <div class="client-card-footer">
          <span class="muted">${projects.length} project(s) · ${c.contacts.length} contact(s)</span>
          ${c.tags.slice(0, 2).map((t) => `<span class="tag">#${Utils.esc(t)}</span>`).join('')}
        </div>
      </div>`;
  },

  renderClientDetail(clientId) {
    const client = Store.getClient(clientId);
    if (!client) return '<p>Client not found</p>';
    const projects = Store.getProjectsByClientId(clientId);
    const items = Store.getItemsByClientId(clientId);
    const vault = Store.getVaultByClientId(clientId);
    const tab = App.clientTab || 'overview';

    const tabs = {
      overview: 'Overview',
      contacts: `Contacts (${client.contacts.length})`,
      projects: `Projects (${projects.length})`,
      activity: `Activity (${items.length})`,
      credentials: `Credentials (${vault.length})`,
    };

    let body = '';
    if (tab === 'overview') {
      body = `
        <div class="client-detail-grid mb">
          <div class="settings-box">
            <h3>Client details</h3>
            <div class="detail-list">
              ${client.company ? `<div><span class="muted">Company</span><br>${Utils.esc(client.company)}</div>` : ''}
              ${client.email ? `<div><span class="muted">Email</span><br><a href="mailto:${Utils.esc(client.email)}">${Utils.esc(client.email)}</a></div>` : ''}
              ${client.phone ? `<div><span class="muted">Phone</span><br><a href="tel:${Utils.esc(client.phone)}">${Utils.esc(client.phone)}</a></div>` : ''}
              ${client.website ? `<div><span class="muted">Website</span><br><a href="${Utils.esc(client.website)}" target="_blank">${Utils.esc(client.website)}</a></div>` : ''}
              ${client.nif ? `<div><span class="muted">NIF</span><br>${Utils.esc(client.nif)}</div>` : ''}
              ${client.address ? `<div><span class="muted">Address</span><br>${Utils.esc(client.address)}</div>` : ''}
            </div>
          </div>
          <div class="settings-box">
            <h3>Status & notes</h3>
            <p><span class="client-status">${Utils.esc(client.status)}</span></p>
            ${client.notes ? `<p class="muted mt" style="white-space:pre-wrap">${Utils.esc(client.notes)}</p>` : '<p class="muted">No notes</p>'}
            ${client.tags.length ? `<div class="tag-cloud mt">${client.tags.map((t) => `<span class="tag">#${Utils.esc(t)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
        <div class="btn-row">
          <button class="btn btn-sm btn-primary" data-action="edit-client" data-id="${clientId}">Edit client</button>
          <button class="btn btn-sm" data-action="new-client-project" data-id="${clientId}">+ Project</button>
          <button class="btn btn-sm" data-action="add-client-contact" data-id="${clientId}">+ Contact</button>
          <button class="btn btn-sm" data-action="client-vault" data-id="${clientId}">+ Credential</button>
        </div>`;
    } else if (tab === 'contacts') {
      body = `
        <div class="section-header"><div class="section-title">Contact people</div>
          <button class="btn btn-sm btn-primary" data-action="add-client-contact" data-id="${clientId}">+ Contact</button></div>
        ${client.contacts.length ? client.contacts.map((p) => `
          <div class="contact-person-card">
            <div class="contact-person-main">
              <div class="client-avatar sm">${(p.name[0] || '?').toUpperCase()}</div>
              <div>
                <div class="contact-person-name">${Utils.esc(p.name)} ${p.isPrimary ? '<span class="tag">Primary</span>' : ''}</div>
                <div class="muted">${Utils.esc(p.role || 'Contact')}</div>
                ${p.email ? `<div class="client-info-row">✉ <a href="mailto:${Utils.esc(p.email)}">${Utils.esc(p.email)}</a></div>` : ''}
                ${p.phone ? `<div class="client-info-row">📞 ${Utils.esc(p.phone)}</div>` : ''}
              </div>
            </div>
            <div class="btn-row">
              <button class="btn btn-sm" data-action="edit-client-contact" data-client="${clientId}" data-id="${p.id}">Edit</button>
              <button class="btn btn-sm btn-ghost" data-action="delete-client-contact" data-client="${clientId}" data-id="${p.id}">Delete</button>
              ${!p.isPrimary ? `<button class="btn btn-sm" data-action="set-primary-contact" data-client="${clientId}" data-id="${p.id}">Primary</button>` : ''}
            </div>
          </div>`).join('') : '<div class="empty-state"><p>No contacts — add the manager, marketing, etc.</p></div>'}`;
    } else if (tab === 'projects') {
      body = `
        <div class="section-header"><div class="section-title">Projects</div>
          <button class="btn btn-sm btn-primary" data-action="new-client-project" data-id="${clientId}">+ Project</button></div>
        ${projects.length ? projects.map((p) => this.renderProjectMini(p)).join('') : '<div class="empty-state"><p>No projects — cria o primeiro site/app</p></div>'}`;
    } else if (tab === 'activity') {
      body = items.length
        ? items.map((i) => (i.type === 'task' ? this.renderTaskRow(i) : this.renderItemCard(i))).join('')
        : '<div class="empty-state"><p>No activity for this client</p></div>';
    } else if (tab === 'credentials') {
      body = `
        <div class="section-header"><div class="section-title">Client credentials</div>
          <button class="btn btn-sm btn-primary" data-action="client-vault" data-id="${clientId}">+ Credential</button></div>
        <p class="muted mb">Hosting, FTP, WordPress admin, domains, etc.</p>
        ${vault.length ? vault.map((e) => `
          <div class="vault-entry">
            <div class="vault-entry-icon">🔑</div>
            <div class="vault-entry-info">
              <div class="vault-entry-title">${Utils.esc(e.service)}</div>
              <div class="vault-entry-sub">${Utils.esc(e.email || e.username || '')}</div>
            </div>
            <button class="btn btn-sm" data-action="edit-vault" data-id="${e.id}">Open</button>
          </div>`).join('') : '<div class="empty-state"><p>No credentials — add in Vault</p></div>'}`;
    }

    return `
      <button class="btn btn-ghost btn-sm mb" data-action="back-clients">← Back</button>
      <div class="client-detail-header mb">
        <div class="client-avatar lg">${(client.name[0] || '?').toUpperCase()}</div>
        <div>
          <div class="client-name lg">${Utils.esc(client.name)}</div>
          <div class="client-company">${Utils.esc(client.company)} · <span class="client-status">${Utils.esc(client.status)}</span></div>
        </div>
      </div>
      <div class="project-tabs">${Object.entries(tabs).map(([k, label]) =>
        `<button class="tab ${tab === k ? 'active' : ''}" data-client-tab="${k}">${label}</button>`).join('')}</div>
      ${body}`;
  },

  renderLinks() {
    const items = App.getFilteredItems({ type: 'link' });
    return `${App.renderScopeBanner()}<div class="section-header"><div class="section-title">Links (${items.length})</div>
      <button class="btn btn-sm btn-primary" data-action="new-link">+ Link</button></div>
      <p class="muted mb sm">Categories in Personalization → Links</p>
      ${items.map((i) => {
        const cat = i.linkCategoryId ? Store.getLinkCategory(i.linkCategoryId) : null;
        const extra = cat ? `<span class="tag" style="border-color:${cat.color};color:${cat.color}">${cat.icon} ${Utils.esc(cat.name)}</span> ` : '';
        return this.renderItemCard(i).replace('<div class="item-type">', `<div class="item-type">${extra}`);
      }).join('') || '<div class="empty-state"><p>No links</p></div>'}`;
  },

  renderSubscriptions() {
    const subs = Store.state.subscriptions;
    const total = subs.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    return `
      <div class="section-header"><div class="section-title">Subscriptions (${subs.length}) · ${total.toFixed(2)}€/month</div>
        <button class="btn btn-sm btn-primary" data-action="add-subscription">+ Subscription</button></div>
      ${subs.map((s) => `
        <div class="vault-entry">
          <div class="vault-entry-icon">💳</div>
          <div class="vault-entry-info">
            <div class="vault-entry-title">${Utils.esc(s.name)}</div>
            <div class="vault-entry-sub">${s.amount}€ · Renews ${Utils.fmtDate(s.renewalDate)} · ${Utils.esc(s.category)}</div>
          </div>
          <button class="btn btn-sm btn-ghost" data-action="delete-sub" data-id="${s.id}">✕</button>
        </div>`).join('') || '<div class="empty-state"><p>No subscriptions</p></div>'}`;
  },

  renderTemplates() {
    const custom = Store.getCustomTemplates();
    return `
      <div class="section-header"><div class="section-title">Templates</div>
        <button class="btn btn-sm" data-action="nav" data-view="personalization">⚙ Customize</button></div>
      <div class="card-grid">
        ${BUILTIN_TEMPLATES.map((t) => `<div class="item-card" data-action="use-template" data-template="${t.key}">
          <div class="item-type">${t.icon} Template</div>
          <div class="item-title">${Utils.esc(t.name)}</div>
        </div>`).join('')}
        ${custom.map((t) => `<div class="item-card" data-action="use-custom-template" data-id="${t.id}">
          <div class="item-type">${t.icon} Custom</div>
          <div class="item-title">${Utils.esc(t.name)}</div>
        </div>`).join('')}
      </div>`;
  },

  renderTimeline() {
    const weeks = Utils.weekDates(App.calendarDate);
    const weekLabel = `${Utils.fmtDate(weeks[0])} — ${Utils.fmtDate(weeks[6])}`;
    let html = `<div class="section-header"><div class="section-title">Weekly timeline</div>
      <div class="calendar-nav">
        <button class="btn btn-icon" id="tl-prev">‹</button><span>${weekLabel}</span>
        <button class="btn btn-icon" id="tl-next">›</button>
      </div></div><div class="timeline-grid">`;
    for (const day of weeks) {
      const tasks = App.getFilteredItems({ date: day, type: 'task' });
      html += `<div class="timeline-col"><div class="timeline-day ${day === Utils.todayStr() ? 'today' : ''}">${Utils.fmtDate(day)}</div>`;
      for (const t of tasks) {
        const w = Math.min(100, Math.max(20, (t.duration || 60) / 5));
        html += `<div class="timeline-bar" style="width:${w}%" data-action="open-item" data-id="${t.id}">${Utils.esc(t.title)} (${t.duration || '?'}min)</div>`;
      }
      html += '</div>';
    }
    return html + '</div>';
  },

  renderCalendar() {
    if (App.filters.calMode === 'school') return this.renderSchoolTimetable();
    if (App.calView === 'week') return this.renderCalendarWeek();
    if (App.calView === 'agenda') return this.renderCalendarAgenda();
    return this.renderCalendarMonth();
  },

  renderSchoolTimetable() {
    const schedule = Store.state.settings.schoolSchedule;
    const weekStart = Utils.startOfWeek(App.calendarDate);
    const weekLabel = `${Utils.fmtDate(weekStart.toISOString().slice(0, 10))} — ${Utils.fmtDate(Utils.addDays(weekStart.toISOString().slice(0, 10), 4))}`;
    const cols = SCHOOL_WEEKDAYS.map((wd) => {
      const dateStr = Utils.addDays(weekStart.toISOString().slice(0, 10), wd.id);
      const slots = SchoolSchedule.getForDate(dateStr, schedule);
      const isToday = dateStr === Utils.todayStr();
      return `<div class="timetable-col ${isToday ? 'today' : ''}">
        <div class="timetable-day-head"><span class="timetable-day-name">${wd.short}</span>
          <span class="timetable-day-date">${new Date(dateStr + 'T12:00:00').getDate()}</span></div>
        <div class="timetable-slots">
          ${slots.length ? slots.map((s) => `
            <div class="timetable-slot">
              <div class="timetable-time">${Utils.fmtTime(s.startDate)}–${Utils.fmtTime(s.endDate)}</div>
              <div class="timetable-subject">${Utils.esc(s.title)}</div>
              ${s.location ? `<div class="timetable-room">${Utils.esc(s.location)}</div>` : ''}
            </div>`).join('') : '<div class="timetable-empty">—</div>'}
        </div>
      </div>`;
    }).join('');
    const enabled = schedule?.enabled;
    return `<div class="calendar-header"><h2>🏫 School Schedule</h2>
      <div class="calendar-nav">
        <button class="btn btn-icon" id="cal-prev">‹</button>
        <span class="timetable-week-label">${weekLabel}</span>
        <button class="btn btn-icon" id="cal-next">›</button>
        <button class="btn btn-sm" id="cal-today">Today</button>
        <button class="btn btn-sm" data-action="edit-school-schedule">✏ Edit</button>
      </div></div>
      ${!enabled ? '<div class="info-banner">Schedule disabled. Click «Edit» to enable.</div>' : ''}
      <p class="muted mb">Repeats automatically every week (Monday to Friday).</p>
      <div class="timetable-grid">${cols}</div>`;
  },

  renderCalendarMonth() {
    const year = App.calendarDate.getFullYear();
    const month = App.calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7;
    const today = Utils.todayStr();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    let cells = '';
    const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startPad + 1;
      let dateStr, otherMonth = false;
      if (dayNum < 1) { const d = new Date(year, month, dayNum); dateStr = d.toISOString().slice(0, 10); otherMonth = true; }
      else if (dayNum > lastDay.getDate()) { const d = new Date(year, month + 1, dayNum - lastDay.getDate()); dateStr = d.toISOString().slice(0, 10); otherMonth = true; }
      else dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
      const dayItems = App.getCalItemsForDate(dateStr);
      const dots = dayItems.slice(0, 4).map((it) => {
        const color = it.isSchoolSchedule ? '#10b981' : (Store.getArea(it.areaId)?.color || 'var(--green)');
        return `<span class="cal-dot" style="background:${color}"></span>`;
      }).join('');
      cells += `<div class="cal-day ${otherMonth?'other-month':''} ${dateStr===today?'today':''} ${App.selectedCalDay===dateStr?'selected':''}" data-cal-day="${dateStr}">
        <div class="cal-day-num">${otherMonth ? new Date(dateStr).getDate() : dayNum}</div><div>${dots}</div>
        <div class="cal-events-preview">${dayItems.length ? dayItems.length + ' item(s)' : ''}</div></div>`;
    }
    let dayPanel = '';
    if (App.selectedCalDay) {
      const dayItems = App.getCalItemsForDate(App.selectedCalDay);
      dayPanel = `<div class="day-panel"><div class="section-header"><div class="section-title">${Utils.fmtDate(App.selectedCalDay)}</div>
        <button class="btn btn-sm btn-primary" data-action="add-cal-day" data-date="${App.selectedCalDay}">+ Add</button></div>
        ${dayItems.length ? dayItems.map((i) => i.type==='task' && !i.isSchoolSchedule ? this.renderTaskRow(i) : this.renderItemCard(i)).join('') : '<p class="muted">Nothing on this day</p>'}</div>`;
    }
    return `<div class="calendar-header"><h2>${monthNames[month]} ${year}</h2>
      <div class="calendar-nav">
        <button class="btn btn-icon" id="cal-prev">‹</button>
        <button class="btn btn-sm" id="cal-today">Today</button>
        <button class="btn btn-icon" id="cal-next">›</button>
        <button class="btn btn-sm" data-action="export-ics">Export ICS</button>
      </div></div>
      <div class="cal-grid">${weekdays.map((d)=>`<div class="cal-weekday">${d}</div>`).join('')}${cells}</div>${dayPanel}`;
  },

  renderCalendarWeek() {
    const weeks = Utils.weekDates(App.calendarDate);
    return `<div class="section-header"><div class="section-title">Week view</div>
      <button class="btn btn-sm" data-action="export-ics">Export ICS</button></div>
      <div class="week-grid">${weeks.map((day) => {
        const items = App.getCalItemsForDate(day);
        return `<div class="week-col ${day===Utils.todayStr()?'today':''}"><div class="week-day-head">${Utils.fmtDate(day)}</div>
          ${items.map((i) => `<div class="week-item ${i.isSchoolSchedule?'school-week-item':''}" data-action="${i.isSchoolSchedule?'':'open-item'}" data-id="${i.id}">${i.isSchoolSchedule?'🏫':Utils.typeIcon(i.type)} ${Utils.esc(i.title)}${i.location?` · ${Utils.esc(i.location)}`:''}</div>`).join('') || '<p class="muted">—</p>'}</div>`;
      }).join('')}</div>`;
  },

  renderCalendarAgenda() {
    const schedule = Store.state.settings.schoolSchedule;
    const year = App.calendarDate.getFullYear();
    const month = App.calendarDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    let items = Store.state.items.filter((i) => i.startDate || i.dueDate);
    if (schedule?.enabled) {
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        items.push(...SchoolSchedule.getForDate(dateStr, schedule));
      }
    }
    const mode = App.filters.calMode;
    if (mode === 'school') items = items.filter((i) => i.isSchoolSchedule);
    else if (mode === 'events') items = items.filter((i) => ['event', 'reminder'].includes(i.type));
    else if (mode === 'tasks') items = items.filter((i) => i.type === 'task');
    else if (mode === 'both' && schedule?.showInCalendar === false) items = items.filter((i) => !i.isSchoolSchedule);
    items = items.sort((a, b) => (a.startDate || a.dueDate).localeCompare(b.startDate || b.dueDate)).slice(0, 60);
    return `<div class="section-header"><div class="section-title">Agenda</div>
      <button class="btn btn-sm" data-action="export-ics">Export ICS</button></div>
      ${items.map((i) => `<div class="agenda-row ${i.isSchoolSchedule ? 'school-agenda-row' : ''}" ${i.isSchoolSchedule ? '' : `data-action="open-item" data-id="${i.id}"`}>
        <div class="agenda-date">${Utils.fmtDate(i.startDate || i.dueDate)} ${Utils.fmtTime(i.startDate)}</div>
        <div>${i.isSchoolSchedule ? '🏫' : Utils.typeIcon(i.type)} ${Utils.esc(i.title)}${i.location ? ` · ${Utils.esc(i.location)}` : ''}</div></div>`).join('') || '<p class="muted">No events</p>'}`;
  },

  renderTasks() {
    let items;
    if (App.taskFilter === 'overdue') items = App.getFilteredItems({ type: 'task', overdue: true });
    else if (App.taskFilter === 'urgent') items = App.getFilteredItems({ type: 'task', urgent: true });
    else if (App.taskFilter === 'blocked') items = App.getFilteredItems({ type: 'task', blocked: true });
    else if (App.filters.period && App.filters.period !== 'all') items = App.getFilteredItems({ type: 'task', period: App.filters.period, snoozed: false });
    else items = App.getFilteredItems({ type: 'task', snoozed: false });
    if (App.filters.subContextId) items = items.filter((i) => i.subContextId === App.filters.subContextId);
    if (App.filters.tag) items = items.filter((i) => i.tags.includes(App.filters.tag));
    if (Store.state.settings.focusProjectId) items = items.filter((i) => i.projectId === Store.state.settings.focusProjectId);
    const open = items.filter((i) => !i.completed);
    const done = items.filter((i) => i.completed);
    return `${App.renderScopeBanner()}
      ${Store.state.settings.focusProjectId ? `<div class="info-banner">Focus mode: ${Utils.esc(Store.getProject(Store.state.settings.focusProjectId)?.name)} · <a href="#" data-action="clear-focus">Exit</a></div>` : ''}
      <div class="section-header"><div class="section-title">${open.length} open · ${done.length} completed</div></div>
      ${open.map((i) => this.renderTaskRow(i)).join('')}
      ${done.length ? `<div class="section-header mt"><div class="section-title muted">Completed</div></div>${done.map((i) => this.renderTaskRow(i)).join('')}` : ''}
      ${!items.length ? '<div class="empty-state"><div class="icon">✓</div><h3>No tasks</h3></div>' : ''}`;
  },

  renderProjects() {
    if (App.projectDetailId) return this.renderProjectDetail(App.projectDetailId);
    const showArchived = App.projectFilter === 'archived';
    const projects = App.filterProjects(showArchived ? Store.getArchivedProjects() : Store.getActiveProjects());
    const grouped = {};
    for (const p of projects) { if (!grouped[p.areaId]) grouped[p.areaId] = []; grouped[p.areaId].push(p); }
    return `${App.renderScopeBanner()}
      <div class="section-header"><div class="section-title">${I18n.t('view.projects')}</div>
        <div class="btn-row">
          <button class="btn btn-sm ${App.projectFilter==='active'?'btn-primary':''}" data-action="proj-filter" data-filter="active">${I18n.t('projects.active')}</button>
          <button class="btn btn-sm ${App.projectFilter==='archived'?'btn-primary':''}" data-action="proj-filter" data-filter="archived">${I18n.t('projects.archived')}</button>
          <button class="btn btn-primary btn-sm" data-action="add-project">${I18n.t('projects.add')}</button>
        </div></div>
      ${Object.entries(grouped).map(([areaId, projs]) => {
        const area = Store.getArea(areaId);
        return `<div class="mb-lg"><h3 class="sub-heading">${area?.icon} ${Utils.esc(area?.name)}</h3><div class="card-grid">
          ${projs.map((p) => `<div class="project-card" data-action="open-project" data-id="${p.id}" style="cursor:pointer">
            <div class="project-header"><div class="project-color" style="background:${p.color}"></div>
            <div><div class="project-name">${Utils.esc(p.name)}</div><div class="project-client">${Utils.esc(p.client)} ${p.stack?`· ${Utils.esc(p.stack)}`:''}</div></div></div>
            ${p.pipeline?`<span class="pipeline-badge">${Utils.esc(p.pipeline)}</span>`:''}
            ${p.paymentStatus?`<span class="tag">${Utils.esc(p.paymentStatus)}</span>`:''}
            <div class="muted mt">${Store.getItems({projectId:p.id}).length} items · ${p.loggedHours||0}/${p.estimatedHours||'?'}h</div>
            ${showArchived ? `<div class="item-actions mt">
              <button class="btn btn-sm" data-action="edit-project" data-id="${p.id}">${I18n.t('action.edit')}</button>
              <button class="btn btn-sm btn-ghost" data-action="unarchive-project" data-id="${p.id}">${I18n.t('action.restore')}</button>
              <button class="btn btn-sm btn-ghost danger-left" data-action="delete-project" data-id="${p.id}">${I18n.t('action.delete')}</button>
            </div>` : ''}
          </div>`).join('')}</div></div>`;
      }).join('') || '<div class="empty-state"><div class="icon">📁</div><h3>No projects</h3></div>'}`;
  },

  renderProjectDetail(projectId) {
    const project = Store.getProject(projectId);
    if (!project) return '<p>Project not found</p>';
    const area = Store.getArea(project.areaId);
    let items = Store.getItems({ projectId });
    const tabs = { overview:'Overview', notes:['note','decision','idea'], tasks:['task','checklist'], events:['event','reminder'], contacts:['contact'], links:['link'], attachments:null, hours:null, versions:null };
    if (App.projectTab !== 'overview' && App.projectTab !== 'attachments' && App.projectTab !== 'hours' && App.projectTab !== 'versions') {
      const types = tabs[App.projectTab];
      if (Array.isArray(types)) items = items.filter((i) => types.includes(i.type));
      items = App.filterProjectItems(items);
      items = App.sortProjectItems(items);
    }
    const tabHtml = Object.keys(tabs).map((t) => `<button class="tab ${App.projectTab===t?'active':''}" data-tab="${t}">${typeof tabs[t]==='string'?tabs[t]:t.charAt(0).toUpperCase()+t.slice(1)}</button>`).join('');
    let body = '';
    if (App.projectTab === 'overview') {
      body = `<div class="stats-grid mb">${['task','note','event'].map((tp) => {
        const c = Store.getItems({projectId,type:tp});
        return `<div class="stat-card"><div class="stat-value">${tp==='task'?c.filter(x=>!x.completed).length:c.length}</div><div class="stat-label">${Utils.typeLabel(tp)}</div></div>`;
      }).join('')}</div>
      <div class="btn-row mb">
        <button class="btn btn-sm btn-primary" data-action="add-proj-item" data-pid="${projectId}">+ Item</button>
        <button class="btn btn-sm" data-action="edit-project" data-id="${projectId}">${I18n.t('action.edit')}</button>
        <button class="btn btn-sm" data-action="focus-project" data-id="${projectId}">${I18n.t('projects.focus')}</button>
        <button class="btn btn-sm" data-action="dup-project" data-id="${projectId}">${I18n.t('projects.duplicate')}</button>
        ${project.archived
          ? `<button class="btn btn-sm" data-action="unarchive-project" data-id="${projectId}">${I18n.t('action.restore')}</button>`
          : `<button class="btn btn-sm" data-action="archive-project" data-id="${projectId}">${I18n.t('action.archive')}</button>`}
        <button class="btn btn-sm btn-ghost danger-left" data-action="delete-project" data-id="${projectId}">${I18n.t('action.delete')}</button>
      </div>
      ${Store.getItems({projectId}).slice(0,8).map((i)=>this.renderItemCard(i)).join('')}`;
    } else if (App.projectTab === 'attachments') {
      const atts = items.filter((i) => i.attachments?.length);
      body = atts.length ? atts.flatMap((i) => i.attachments.map((a) => {
        const prev = Utils.previewAttachment(a);
        return `<div class="attachment-chip">${prev?`<img src="${prev}" class="att-preview">`:''} 📎 ${Utils.esc(a.name)} (${Utils.esc(i.title)})</div>`;
      })).join('') : '<div class="empty-state"><p>No attachments</p></div>';
    } else if (App.projectTab === 'hours') {
      body = `<p class="mb">${project.loggedHours||0}h / ${project.estimatedHours||'?'}h estimated</p>
        <button class="btn btn-sm btn-primary" data-action="log-hours" data-id="${projectId}">+ Log hours</button>`;
    } else if (App.projectTab === 'versions') {
      body = (project.versions||[]).map((v) => `<div class="item-card mb"><strong>v${Utils.esc(v.version)}</strong> — ${Utils.fmtDate(v.date)}<p class="muted">${Utils.esc(v.notes)}</p></div>`).join('')
        + `<button class="btn btn-sm mt" data-action="add-version" data-id="${projectId}">+ Version</button>`;
    } else {
      const filterBar = ['notes', 'tasks', 'events', 'contacts', 'links'].includes(App.projectTab)
        ? App.renderProjectItemFilters()
        : '';
      body = filterBar + (items.length ? items.map((i) => (i.type==='task'||i.type==='checklist') ? this.renderTaskRow(i) : this.renderItemCard(i)).join('') : '<div class="empty-state"><p>No items</p></div>');
    }
    return `<button class="btn btn-ghost btn-sm mb" data-action="back-projects">${I18n.t('projects.back')}</button>
      <div class="project-header mb"><div class="project-color" style="background:${project.color};height:56px"></div>
      <div><div class="project-name lg">${Utils.esc(project.name)}</div>
      <div class="project-client">${area?.icon} ${Utils.esc(area?.name)} · ${Utils.esc(project.client)}</div>
      ${project.clientEmail?`<p class="muted">${Utils.esc(project.clientEmail)} · ${Utils.esc(project.clientPhone)}</p>`:''}
      ${project.url?`<a href="${Utils.esc(project.url)}" target="_blank">${Utils.esc(project.url)}</a>`:''}</div></div>
      <div class="project-tabs">${tabHtml}</div>${body}`;
  },

  renderKanban() {
    const freelanceProjects = App.filterProjects(Store.state.projects.filter((p) => p.areaId === 'area-freelance' && !p.archived));
    let tasks = Store.state.items.filter((i) => i.type === 'task' && freelanceProjects.some((p) => p.id === i.projectId));
    tasks = App.filterItems(tasks);
    if (App.filters.projectId) tasks = tasks.filter((t) => t.projectId === App.filters.projectId);
    return `<div class="section-header"><div class="section-title">Kanban — candeias.dev</div>
      <select class="form-control w-auto" id="kanban-proj-filter"><option value="">All</option>
      ${freelanceProjects.map((p)=>`<option value="${p.id}" ${App.filters.projectId===p.id?'selected':''}>${Utils.esc(p.name)}</option>`).join('')}</select></div>
      <div class="kanban-board">${Store.getKanbanColumns().map((col) => {
        const cols = Store.getKanbanColumns();
        const colTasks = tasks.filter((t) => t.kanbanStatus === col);
        return `<div class="kanban-col"><div class="kanban-col-header">${col} (${colTasks.length})</div>
          ${colTasks.map((t) => `<div class="kanban-card" data-action="open-item" data-id="${t.id}">
            <div style="font-weight:600">${Utils.esc(t.title)}</div>
            <div class="muted">${Utils.esc(Store.getProject(t.projectId)?.name||'')}</div>
            <div class="btn-row mt">${cols.filter((c)=>c!==col).slice(0,2).map((c)=>`<button class="btn btn-sm mini" data-kanban-move="${c}" data-id="${t.id}">→ ${c}</button>`).join('')}</div>
          </div>`).join('')||'<p class="muted">—</p>'}</div>`;
      }).join('')}</div>`;
  },

  renderVault() {
    if (!Vault.isSetup() || !Store.state.vaultUnlocked) {
      return `<div class="vault-locked"><div class="vault-icon">🔐</div><h2>Candeias Vault</h2>
        <p class="muted mb">${Vault.isSetup()?'Enter master password.':'Set master password.'}</p>
        <form class="vault-form" id="vault-unlock-form"><div class="form-group"><label>Master Password</label>
        <input type="password" class="form-control" id="vault-password" required></div>
        <button type="submit" class="btn btn-primary w100">${Vault.isSetup()?'Unlock':'Create vault'}</button></form>
        <p class="muted mt">AES-GCM · candeias.dev</p></div>`;
    }
    const folder = App.vaultFolder || 'all';
    const folders = Store.getVaultFolders();
    let entries = Store.state.vaultEntries;
    if (folder !== 'all') {
      const vf = Store.getVaultFolder(folder);
      if (vf) entries = entries.filter((e) => e.folder === vf.name);
    }
    return `<div class="section-header"><div class="section-title">Vault (${entries.length})</div>
      <div class="btn-row"><button class="btn btn-sm" id="vault-lock">Lock</button>
      <button class="btn btn-primary btn-sm" id="btn-add-vault">+ Entry</button>
      <button class="btn btn-sm" data-action="nav" data-view="personalization">⚙ Folders</button></div></div>
      <div class="filter-bar-inline mb">
        <button class="filter-chip ${folder==='all'?'active':''}" data-vault-folder="all">All</button>
        ${folders.map((vf) => `<button class="filter-chip ${folder===vf.id?'active':''}" data-vault-folder="${vf.id}" style="${folder===vf.id?`border-color:${vf.color};color:${vf.color}`:''}">${vf.icon} ${Utils.esc(vf.name)}</button>`).join('')}
      </div>
      ${entries.map((e) => `<div class="vault-entry"><div class="vault-entry-icon">🔑</div>
        <div class="vault-entry-info"><div class="vault-entry-title">${Utils.esc(e.service)} ${e.favorite?'⭐':''}</div>
        <div class="vault-entry-sub">${Utils.esc(e.email||e.username||'')} ${e.expiryDate?'· Expires '+Utils.fmtDate(e.expiryDate):''}</div></div>
        <div class="vault-actions"><button class="btn btn-sm" data-action="copy-password" data-id="${e.id}">Copy</button>
        <button class="btn btn-sm" data-action="edit-vault" data-id="${e.id}">Edit</button>
        <button class="btn btn-sm btn-ghost" data-action="delete-vault" data-id="${e.id}">✕</button></div></div>`).join('')||'<div class="empty-state"><div class="icon">🔐</div><h3>Vault empty</h3></div>'}`;
  },

  renderAreas() {
    return `<div class="section-header"><div class="section-title">Areas & Contexts</div>
      <button class="btn btn-primary btn-sm" id="btn-add-area">+ Area</button></div>
      ${Store.state.areas.map((area) => `<div class="item-card mb">
        <div class="flex-center mb"><span class="area-dot lg" style="background:${area.color}"></span>
        <strong>${area.icon} ${Utils.esc(area.name)}</strong></div>
        ${area.subContexts?.length?`<div class="sub-context-grid">${area.subContexts.map((c)=>`<span class="sub-ctx-btn">${c.icon} ${Utils.esc(c.name)}</span>`).join('')}</div>`:'<p class="muted">No sub-contexts</p>'}
        <p class="muted mt">${Store.getProjectsByArea(area.id).length} projects · ${Store.getItems({areaId:area.id}).length} items</p>
        <button class="btn btn-sm mt" data-action="add-subctx" data-area="${area.id}">+ Sub-context</button>
      </div>`).join('')}
      <div class="settings-box mt"><p class="muted">Pipeline: ${Store.getPipelineStages().join(' → ')} · <a href="#" data-action="nav" data-view="personalization">Customize</a></p>
      <div class="btn-row mt"><button class="btn btn-sm" data-action="export-backup">Export backup</button>
        <button class="btn btn-sm btn-ghost" data-action="load-demo">↺ Load demo examples</button></div></div>`;
  },

  renderSettings() {
    const s = Store.state.settings;
    const lang = s.language || 'en';
    return `<div class="section-header"><div class="section-title">${I18n.t('view.settings')}</div></div>
      <div class="settings-box mb"><h3>${I18n.t('settings.language')}</h3>
        <p class="muted mb">${I18n.t('settings.language.desc')}</p>
        <button class="btn btn-sm ${lang==='en'?'btn-primary':''}" data-action="set-language" data-language="en">${I18n.t('settings.language.en')}</button>
        <button class="btn btn-sm ${lang==='pt'?'btn-primary':''}" data-action="set-language" data-language="pt">${I18n.t('settings.language.pt')}</button></div>
      <div class="settings-box mb"><h3>${I18n.t('settings.theme')}</h3>
        <button class="btn btn-sm ${s.theme==='dark'?'btn-primary':''}" data-action="set-theme" data-theme="dark">Dark</button>
        <button class="btn btn-sm ${s.theme==='light'?'btn-primary':''}" data-action="set-theme" data-theme="light">Light</button></div>
      <div class="settings-box mb"><h3>Personalization</h3>
        <p class="muted mb">Vault, contacts, tags, areas, kanban, pipeline, links, school, dashboard — all in one place.</p>
        <button class="btn btn-sm btn-primary" data-action="nav" data-view="personalization">⚙ Open personalization</button></div>
      <div class="settings-box mb"><h3>AI Assistant</h3>
        <p class="muted mb">Optional — with API key uses OpenAI; without key uses local parser (free).</p>
        <input class="form-control" type="password" id="openai-api-key" value="${Utils.esc(s.openaiApiKey || '')}" placeholder="sk-...">
        <label class="checkbox-row mt"><input type="checkbox" id="use-ai-parser" ${s.useAiParser !== false ? 'checked' : ''}> Use OpenAI when key is set</label>
        <button class="btn btn-sm mt" data-action="save-ai-settings">Save AI</button></div>
      <div class="settings-box mb"><h3>FinControl (finance)</h3>
        <p class="muted mb">Calendar link to open the finance app.</p>
        <input class="form-control" id="fincontrol-url" value="${Utils.esc(s.fincontrolUrl || FINCONTROL_DEFAULT_URL)}" placeholder="http://localhost:5173">
        <button class="btn btn-sm mt" data-action="save-fincontrol-url">Save URL</button>
        <a class="btn btn-sm mt fincontrol-link" href="${Utils.esc(s.fincontrolUrl || FINCONTROL_DEFAULT_URL)}" target="_blank" rel="noopener">Open FinControl</a></div>
      <div class="settings-box mb"><h3>Gmail integration</h3>
        <p class="muted mb">Optional — preview inbox in the Emails section. In <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a>: enable Gmail API, create OAuth Client ID (Web), add authorized origin <code>http://localhost:8080</code>.</p>
        <input class="form-control" id="google-client-id" value="${Utils.esc(s.googleClientId || '')}" placeholder="123456789-abc.apps.googleusercontent.com">
        <button class="btn btn-sm mt" data-action="save-gmail-settings">Save Gmail settings</button></div>
      <div class="settings-box mb"><h3>School schedule</h3>
        <p class="muted mb">Weekly schedule (Mon–Fri) on the calendar. Repeats automatically.</p>
        <button class="btn btn-sm" data-action="edit-school-schedule">✏ Edit schedule</button></div>
      <div class="settings-box mb"><h3>Accessibility</h3>
        <p class="muted mb">Adapt the app to your needs.</p>
        <button class="btn btn-sm" data-action="nav" data-view="accessibility">Open accessibility</button></div>
      <div class="settings-box mb"><h3>Focus mode</h3>
        <select class="form-control" id="focus-select"><option value="">Off</option>
        ${Store.getActiveProjects().map((p)=>`<option value="${p.id}" ${s.focusProjectId===p.id?'selected':''}>${Utils.esc(p.name)}</option>`).join('')}</select></div>
      <div class="settings-box mb"><h3>Saved searches</h3>
        ${(s.savedSearches||[]).map((sr)=>`<div class="item-card mb mini">${Utils.esc(sr.name)}</div>`).join('')||'<p class="muted">None</p>'}</div>
      <div class="settings-box mb"><h3>Data backup (PC → casa)</h3>
        <p class="muted mb sm">Use isto no PC da empresa <strong>sem Firebase</strong>. Exporta agora, guarda o ficheiro na pasta <code>backups/</code> deste projeto. Em casa importas e depois ligamos o Firebase.</p>
        <div class="btn-row">
          <button class="btn btn-sm btn-primary" data-action="export-backup">⬇ Export backup</button>
          <button class="btn btn-sm" data-action="import-backup">⬆ Import backup</button>
        </div>
        <p class="muted sm mt">O ficheiro JSON fica só no teu PC — não vai para o GitHub.</p></div>
      ${CloudSync.isRenderMode?.() ? `<div class="settings-box mb"><h3>Cloud sync (Render)</h3>
        <p class="muted mb sm">Password-protected · same data on PC and phone. Data stored on Render server (not GitHub).</p>
        <p class="muted mt sm">${CloudSync.statusText()}</p>
        <div class="btn-row mt">
          <button class="btn btn-sm btn-primary" data-action="cloud-sync-now">↻ Sync now</button>
        </div></div>` : `<div class="settings-box mb"><h3>Cloud sync (PC + phone)</h3>
        <p class="muted mb sm">One account, same tasks everywhere. Uses free <a href="https://console.firebase.google.com/" target="_blank" rel="noopener">Firebase</a> (Auth + Firestore).</p>
        <p class="muted mb sm"><strong>Setup once:</strong> Firebase → Create project → Authentication (Email) → Firestore → paste config below.</p>
        <textarea class="form-control" id="firebase-config-json" rows="5" placeholder='{"apiKey":"...","authDomain":"...","projectId":"...","appId":"..."}'>${Utils.esc(s.firebaseConfig ? JSON.stringify(s.firebaseConfig, null, 2) : '')}</textarea>
        <button class="btn btn-sm mt" data-action="save-firebase-config">Save Firebase config</button>
        <p class="muted mt sm">${typeof CloudSync !== 'undefined' ? CloudSync.statusText() : ''}${s.cloudEmail ? ` · ${Utils.esc(s.cloudEmail)}` : ''}</p>
        <div class="btn-row mt">
          <button class="btn btn-sm btn-primary" data-action="cloud-sync-now">↻ Sync now</button>
        </div></div>`}
      <div class="settings-box mb"><h3>App update</h3>
        <p class="muted mb">Version <strong>${APP_VERSION}</strong> · ${typeof AppUpdate !== 'undefined' ? AppUpdate.statusLabel() : ''}</p>
        <div class="btn-row">
          <button class="btn btn-sm" data-action="check-app-update">Check for updates</button>
          <button class="btn btn-sm btn-primary" data-action="apply-app-update">↻ Update app</button>
        </div>
        <p class="muted sm mt">Use after a new GitHub deploy — no need to reinstall the PWA.</p></div>
      <div class="settings-box mb"><h3>Account</h3>
        <p class="muted mb">${CloudSync.isRenderMode?.() ? 'Render password login · auto-sync every 30s. Face ID unlocks on this device.' : CloudSync.isConfigured() ? 'Cloud login syncs across devices. Face ID works on this device.' : 'Local login on this device only — enable cloud sync above.'}</p>
        <button class="btn btn-sm btn-ghost danger-left" data-action="logout">Sign out</button></div>
      <div class="settings-box mb"><h3>Data</h3>
        <p class="muted mb sm">${typeof CloudSync !== 'undefined' ? `${CloudSync.dataScore(Store.state)} records on this device` : ''}${CloudSync.hasEmergencyBackup?.() ? ' · local backup available' : ''}</p>
        <div class="btn-row mb">
          <button class="btn btn-sm btn-primary" data-action="restore-my-data">↺ Recover my data</button>
          <button class="btn btn-sm" data-action="cloud-sync-now">Sync now</button>
        </div>
        <p class="muted mb sm">Recover tries: local backup → cloud backup → cloud sync. Export weekly for safety.</p>
        <div class="btn-row">
          <button class="btn btn-sm" data-action="export-backup">⬇ Export backup</button>
          <button class="btn btn-sm" data-action="import-backup">⬆ Import backup</button>
        </div>
        <div class="btn-row mt">
          <button class="btn btn-sm btn-ghost" data-action="clear-all-data">🗑 Clear all — start fresh</button>
          <button class="btn btn-sm btn-ghost" data-action="load-demo">↺ Load demo examples</button>
        </div></div>
      <div class="settings-box about-box"><div class="brand-icon lg">C</div><h2>Candeias</h2><p class="green">candeias.dev</p>
      <p class="muted">Organize. Build. Live.</p><p>Version ${APP_VERSION}</p>
      <a href="https://candeias.dev" target="_blank" class="btn btn-sm mt">Visit site</a></div>`;
  },

  renderAccessibility() {
    const a11y = { ...DEFAULT_ACCESSIBILITY, ...(Store.state.settings.accessibility || {}) };
    const active = Object.values(a11y).filter(Boolean).length;
    return `<div class="section-header"><div class="section-title">Accessibility</div>
      <span class="muted">${active} active</span></div>
      <p class="muted mb">Enable or disable features to make the app more comfortable.</p>
      <div class="a11y-grid">
        ${ACCESSIBILITY_OPTIONS.map((opt) => `
          <button type="button" class="a11y-card ${a11y[opt.key] ? 'active' : ''}" data-action="toggle-a11y" data-a11y-key="${opt.key}">
            <div class="a11y-card-head">
              <span class="a11y-status">${a11y[opt.key] ? '✓ Enabled' : 'Disabled'}</span>
            </div>
            <div class="a11y-label">${opt.label}</div>
            <div class="a11y-desc">${opt.desc}</div>
          </button>`).join('')}
      </div>`;
  },

  renderTools() {
    const tab = App.toolsTab || 'calc';
    const pom = Pomodoro.tick();
    const rem = Pomodoro.remainingSec();
    const grades = Store.state.grades || [];
    const avg = Grades.weightedAverage(grades);
    const tabs = [['calc', '⚡ Calculators'], ['pomodoro', '🍅 Pomodoro'], ['grades', '📚 Grades']];
    let body = '';
    if (tab === 'calc') {
      body = `<div class="tools-grid">
        <div class="settings-box"><h3>Voltage drop (ΔV)</h3>
          <p class="muted sm mb">ΔV = 2 × I × R/km × L(m)/1000</p>
          <div class="form-row"><input class="form-control" id="calc-i" type="number" step="0.1" placeholder="I (A)">
          <input class="form-control" id="calc-r" type="number" step="0.01" placeholder="R Ω/km"></div>
          <input class="form-control mt" id="calc-l" type="number" placeholder="Length (m)">
          <button class="btn btn-sm mt" id="calc-vdrop">Calculate</button>
          <div class="calc-result mt" id="calc-vdrop-out">—</div></div>
        <div class="settings-box"><h3>AWG → mm²</h3>
          <select class="form-control" id="calc-awg">${[10,12,14,16,18,20,22,24].map((a)=>`<option value="${a}">${a} AWG</option>`).join('')}</select>
          <button class="btn btn-sm mt" id="calc-awg-btn">Convert</button>
          <div class="calc-result mt" id="calc-awg-out">—</div></div>
        <div class="settings-box"><h3>kW → cv</h3>
          <input class="form-control" id="calc-kw" type="number" step="0.1" placeholder="kW">
          <button class="btn btn-sm mt" id="calc-kw-btn">Convert</button>
          <div class="calc-result mt" id="calc-kw-out">—</div></div>
        <div class="settings-box"><h3>Cos φ</h3>
          <div class="form-row"><input class="form-control" id="calc-kva" type="number" placeholder="kVA">
          <input class="form-control" id="calc-kw2" type="number" placeholder="kW"></div>
          <button class="btn btn-sm mt" id="calc-cos">Calculate</button>
          <div class="calc-result mt" id="calc-cos-out">—</div></div>
      </div>
      <button class="btn btn-sm mt" data-action="use-template" data-template="field-sheet">+ Field sheet (template)</button>`;
    } else if (tab === 'pomodoro') {
      body = `<div class="pomodoro-box settings-box">
        <div class="pomodoro-time">${Pomodoro.fmt(rem || (pom.phase === 'work' ? Pomodoro.WORK_SEC : Pomodoro.BREAK_SEC))}</div>
        <div class="muted mb">${pom.running ? (pom.phase === 'work' ? 'Focus' : 'Break') : 'Ready'} · ${pom.sessions || 0} sessions</div>
        <div class="btn-row">
          ${pom.running ? `<button class="btn btn-sm" data-action="pomodoro-stop">Stop</button>` : `<button class="btn btn-primary btn-sm" data-action="pomodoro-start">▶ Focus 25min</button>`}
          <button class="btn btn-sm btn-ghost" data-action="pomodoro-break">Break 5min</button>
        </div></div>`;
    } else {
      body = `<div class="section-header"><div class="section-title">Average: ${avg}</div>
        <button class="btn btn-sm btn-primary" data-action="add-grade">+ Subject</button></div>
        <p class="muted mb sm">Preset subjects in <a href="#" data-action="nav" data-view="personalization" style="color:var(--green)">Personalization → School</a></p>
        ${grades.map((g) => `<div class="item-card mb mini" style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>${Utils.esc(g.subject)}</strong> · weight ${g.weight} · ${g.grade}</div>
          <button class="btn btn-sm btn-ghost" data-action="delete-grade" data-id="${g.id}">✕</button>
        </div>`).join('') || '<p class="muted">No notes</p>'}`;
    }
    return `<div class="section-header"><div class="section-title">Tools</div></div>
      <div class="filter-bar-inline mb">${tabs.map(([k,l])=>`<button class="filter-chip ${tab===k?'active':''}" data-tools-tab="${k}">${l}</button>`).join('')}</div>${body}`;
  },

  renderSearch() {
    const q = App.searchQuery;
    const typeFilter = App.searchType;
    let items = q ? App.filterItems(Store.getItems({ search: q })) : [];
    if (typeFilter) items = items.filter((i) => i.type === typeFilter);
    const projects = q ? App.filterProjects(Store.state.projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))) : [];
    return `${App.renderScopeBanner()}<div class="section-header"><div class="section-title">Search: "${Utils.esc(q)}"</div>
      <button class="btn btn-sm" data-action="save-search">Save search</button></div>
      <div class="filter-bar-inline mb">${['','note','task','event','contact','link'].map((t)=>`<button class="filter-chip ${App.searchType===t?'active':''}" data-search-type="${t}">${t||'All'}</button>`).join('')}</div>
      ${projects.length?`<h3 class="sub-heading">Projects</h3>${projects.map((p)=>`<div class="item-card mb" data-action="open-project" data-id="${p.id}">${Utils.esc(p.name)}</div>`).join('')}`:''}
      ${items.map((i)=>this.renderItemCard(i)).join('')||'<div class="empty-state"><p>No results</p></div>'}`;
  },
};
