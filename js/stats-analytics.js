const StatsAnalytics = {
  AREA_COLORS: ['#00d26a', '#00ff88', '#34d399', '#10b981', '#a78bfa', '#f472b6', '#ffa502'],
  PRIORITY_COLORS: { urgent: '#ff4757', high: '#ffa502', normal: '#00d26a', low: '#6b7280' },
  TYPE_COLORS: ['#00d26a', '#34d399', '#10b981', '#00ff88', '#a78bfa', '#f472b6', '#ffa502', '#60a5fa', '#fbbf24', '#94a3b8'],

  build(items, projects, extras = {}) {
    const { subscriptions = [], clients = [], settings = {}, vaultEntries = [] } = extras;
    const tasks = items.filter((i) => i.type === 'task');
    const openTasks = tasks.filter((t) => !t.completed);
    const doneTasks = tasks.filter((t) => t.completed);
    const weeklyDone = this.weeklyCompleted(tasks, 8);
    const maxWeekly = Math.max(1, ...weeklyDone.map((w) => w.count));

    const priorityBreakdown = this.countBy(tasks, (t) => t.priority || 'normal', PRIORITIES);
    const kanbanBreakdown = this.countBy(openTasks, (t) => t.kanbanStatus || 'To do', Store.getKanbanColumns());
    const typeBreakdown = this.countBy(items, (i) => i.type, Object.keys(ITEM_TYPES));
    const areaBreakdown = this.areaCounts(items);
    const activityHeatmap = this.activityHeatmap(items, 84);
    const maxActivity = Math.max(1, ...activityHeatmap.map((d) => d.count));

    const projectHours = projects
      .filter((p) => (p.loggedHours || 0) > 0)
      .map((p) => ({ id: p.id, name: p.name, hours: p.loggedHours || 0, color: p.color || '#00d26a' }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);
    const maxProjectHours = Math.max(1, ...projectHours.map((p) => p.hours), 1);

    const pipelineBreakdown = this.countBy(
      projects.filter((p) => p.pipeline),
      (p) => p.pipeline,
      Store.getPipelineStages()
    );

    const clientStatusBreakdown = this.countBy(clients.filter((c) => !c.archived), (c) => c.status, Store.getClientStatuses());

    const subscriptionMonthly = subscriptions.reduce((s, sub) => s + (parseFloat(sub.amount) || 0), 0);
    const renewalsSoon = subscriptions.filter((s) => {
      if (!s.renewalDate) return false;
      const days = (new Date(s.renewalDate) - new Date(Utils.todayStr())) / 86400000;
      return days >= 0 && days <= 30;
    }).length;

    const pomodoro = settings.pomodoro || {};
    const completionRate = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0;
    const overdueRate = openTasks.length
      ? Math.round((openTasks.filter((t) => Utils.isOverdue(t)).length / openTasks.length) * 100)
      : 0;

    const topTags = this.topTags(items, 12);
    const grades = Store.state?.grades || [];
    const gradesAvg = Grades.weightedAverage(grades);

    const hoursTotal = projects.reduce((s, p) => s + (p.loggedHours || 0), 0);
    const itemHours = items.reduce((s, i) => s + (i.hoursLogged || 0), 0);

    return {
      weeklyDone,
      maxWeekly,
      priorityBreakdown,
      kanbanBreakdown,
      typeBreakdown,
      areaBreakdown,
      activityHeatmap,
      maxActivity,
      projectHours,
      maxProjectHours,
      pipelineBreakdown,
      clientStatusBreakdown,
      subscriptionMonthly,
      renewalsSoon,
      pomodoroSessions: pomodoro.sessions || 0,
      completionRate,
      overdueRate,
      topTags,
      gradesAvg,
      gradesCount: grades.length,
      vaultCount: vaultEntries.length,
      hoursTotal,
      itemHours,
      tasksTotal: tasks.length,
      openTasks: openTasks.length,
      doneTasks: doneTasks.length,
      itemsTotal: items.length,
      avgWeeklyDone: weeklyDone.length
        ? (weeklyDone.reduce((s, w) => s + w.count, 0) / weeklyDone.length).toFixed(1)
        : '0',
    };
  },

  countBy(items, keyFn, order = null) {
    const map = new Map();
    for (const item of items) {
      const key = keyFn(item);
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    const keys = order || [...map.keys()].sort();
    return keys
      .filter((k) => map.has(k))
      .map((label) => ({ label, count: map.get(label) }));
  },

  areaCounts(items) {
    return Store.state.areas.map((area, i) => ({
      id: area.id,
      label: area.name,
      icon: area.icon,
      color: area.color || this.AREA_COLORS[i % this.AREA_COLORS.length],
      count: items.filter((item) => {
        let aid = item.areaId;
        if (!aid && item.projectId) aid = Store.getProject(item.projectId)?.areaId;
        return aid === area.id;
      }).length,
    })).filter((a) => a.count > 0);
  },

  weekStarts(count) {
    const start = Utils.startOfWeek();
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() - (count - 1 - i) * 7);
      return d.toISOString().slice(0, 10);
    });
  },

  weekEnd(weekStartStr) {
    return Utils.addDays(weekStartStr, 6);
  },

  weeklyCompleted(tasks, weeks) {
    const done = tasks.filter((t) => t.completed);
    return this.weekStarts(weeks).map((weekStart) => {
      const weekEnd = this.weekEnd(weekStart);
      const count = done.filter((t) => {
        const d = (t.updatedAt || t.createdAt || '').slice(0, 10);
        return d >= weekStart && d <= weekEnd;
      }).length;
      const label = new Date(weekStart + 'T12:00:00').toLocaleDateString(I18n.locale(), { day: '2-digit', month: 'short' });
      return { weekStart, label, count };
    });
  },

  activityHeatmap(items, days) {
    const today = Utils.todayStr();
    const cells = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = Utils.addDays(today, -i);
      const count = items.filter((item) => (item.updatedAt || item.createdAt || '').slice(0, 10) === date).length;
      cells.push({ date, count });
    }
    return cells;
  },

  topTags(items, limit) {
    const map = new Map();
    for (const item of items) {
      for (const tag of item.tags || []) {
        map.set(tag, (map.get(tag) || 0) + 1);
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  },

  renderBarChart(data, max, { ariaLabel } = {}) {
    if (!data.length) return `<p class="muted chart-empty">${I18n.t('stats.noData')}</p>`;
    const peak = max || Math.max(1, ...data.map((d) => d.count));
    return `<div class="chart-bars" role="img" aria-label="${Utils.esc(ariaLabel || '')}">
      ${data.map((d) => {
        const pct = Math.round((d.count / peak) * 100);
        return `<div class="chart-bar-col" title="${Utils.esc(d.label)}: ${d.count}">
          <div class="chart-bar-value">${d.count || ''}</div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="height:${Math.max(pct, d.count ? 8 : 0)}%"></div></div>
          <div class="chart-bar-label">${Utils.esc(d.shortLabel || d.label)}</div>
        </div>`;
      }).join('')}
    </div>`;
  },

  renderHBarChart(data, max, { colors = null, labelFn = null } = {}) {
    if (!data.length) return `<p class="muted chart-empty">${I18n.t('stats.noData')}</p>`;
    const peak = max || Math.max(1, ...data.map((d) => d.count));
    return `<div class="chart-hbars">
      ${data.map((d, i) => {
        const pct = Math.round((d.count / peak) * 100);
        const color = d.color || colors?.[i] || this.TYPE_COLORS[i % this.TYPE_COLORS.length];
        const label = labelFn ? labelFn(d) : (d.icon ? `${d.icon} ${d.label}` : d.label);
        return `<div class="chart-hbar-row">
          <span class="chart-hbar-label">${Utils.esc(label)}</span>
          <div class="chart-hbar-track"><div class="chart-hbar-fill" style="width:${pct}%;background:${color}"></div></div>
          <span class="chart-hbar-value">${d.count}</span>
        </div>`;
      }).join('')}
    </div>`;
  },

  renderDonut(data, { colors = null } = {}) {
    const total = data.reduce((s, d) => s + d.count, 0);
    if (!total) return `<p class="muted chart-empty">${I18n.t('stats.noData')}</p>`;
    let acc = 0;
    const stops = data.map((d, i) => {
      const pct = (d.count / total) * 100;
      const color = d.color || colors?.[i] || this.TYPE_COLORS[i % this.TYPE_COLORS.length];
      const start = acc;
      acc += pct;
      return `${color} ${start}% ${acc}%`;
    }).join(', ');
    return `<div class="chart-donut-wrap">
      <div class="chart-donut" style="background:conic-gradient(${stops})" title="${total} total">
        <div class="chart-donut-hole"><span class="chart-donut-total">${total}</span></div>
      </div>
      <div class="chart-donut-legend">
        ${data.map((d, i) => {
          const color = d.color || colors?.[i] || this.TYPE_COLORS[i % this.TYPE_COLORS.length];
          const pct = Math.round((d.count / total) * 100);
          return `<div class="chart-legend-row"><span class="chart-legend-swatch" style="background:${color}"></span>
            <span class="chart-legend-label">${Utils.esc(d.label)}</span>
            <span class="chart-legend-value">${d.count} <span class="muted">(${pct}%)</span></span></div>`;
        }).join('')}
      </div>
    </div>`;
  },

  renderHeatmap(cells, max) {
    if (!cells.length) return `<p class="muted chart-empty">${I18n.t('stats.noData')}</p>`;
    const peak = max || Math.max(1, ...cells.map((c) => c.count));
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    const level = (count) => {
      if (!count) return 0;
      const ratio = count / peak;
      if (ratio >= 0.75) return 4;
      if (ratio >= 0.5) return 3;
      if (ratio >= 0.25) return 2;
      return 1;
    };

    return `<div class="chart-heatmap-wrap">
      <div class="chart-heatmap">
        ${weeks.map((week) => `<div class="chart-heatmap-week">
          ${week.map((cell) => {
            const lv = level(cell.count);
            const title = `${Utils.fmtDate(cell.date)}: ${cell.count} ${I18n.t('stats.updates')}`;
            return `<div class="chart-heatmap-cell lv-${lv}" title="${Utils.esc(title)}"></div>`;
          }).join('')}
        </div>`).join('')}
      </div>
      <div class="chart-heatmap-legend">
        <span class="muted sm">${I18n.t('stats.less')}</span>
        ${[0, 1, 2, 3, 4].map((lv) => `<span class="chart-heatmap-cell lv-${lv}"></span>`).join('')}
        <span class="muted sm">${I18n.t('stats.more')}</span>
      </div>
    </div>`;
  },

  renderSparkline(values, max) {
    const peak = max || Math.max(1, ...values);
    const w = 120;
    const h = 32;
    const step = values.length > 1 ? w / (values.length - 1) : w;
    const points = values.map((v, i) => {
      const x = Math.round(i * step);
      const y = Math.round(h - (v / peak) * (h - 4)) + 2;
      return `${x},${y}`;
    }).join(' ');
    return `<svg class="chart-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="var(--green-bright)" stroke-width="2" points="${points}"/>
    </svg>`;
  },

  renderKpi(value, label, { action, sub, accent } = {}) {
    const navAttr = action?.view ? ` data-action="nav" data-view="${action.view}"` : '';
    return `<div class="stat-card${navAttr ? ' stat-card--link' : ''}"${navAttr}>
      <div class="stat-value" style="${accent ? `color:${accent}` : ''}">${value}</div>
      <div class="stat-label">${Utils.esc(label)}</div>
      ${sub ? `<div class="stat-sub muted sm">${Utils.esc(sub)}</div>` : ''}
    </div>`;
  },

  renderPanel(title, body, { className = '' } = {}) {
    return `<div class="chart-panel ${className}">
      <h3 class="chart-panel-title">${Utils.esc(title)}</h3>
      ${body}
    </div>`;
  },
};
