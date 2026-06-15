const AppModals = {
  typeOptions(selected) {
    return Object.entries(ITEM_TYPES).map(([k, v]) =>
      `<option value="${k}" ${selected === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
    ).join('');
  },

  layerOptions(selected = {}) {
    const areaId = selected.areaId || '';
    let projectsHtml = '<option value="">— No project —</option>';
    let subCtxHtml = '<option value="">— No context —</option>';
    if (areaId) {
      Store.getProjectsByArea(areaId).forEach((p) => {
        projectsHtml += `<option value="${p.id}" ${selected.projectId === p.id ? 'selected' : ''}>${Utils.esc(p.name)}</option>`;
      });
      Store.getArea(areaId)?.subContexts?.forEach((c) => {
        subCtxHtml += `<option value="${c.id}" ${selected.subContextId === c.id ? 'selected' : ''}>${c.icon} ${Utils.esc(c.name)}</option>`;
      });
    }
    return `<div class="form-group"><label>Area</label>
      <select class="form-control" name="areaId" id="layer-area"><option value="">— Inbox —</option>
      ${Store.state.areas.map((a) => `<option value="${a.id}" ${areaId === a.id ? 'selected' : ''}>${a.icon} ${Utils.esc(a.name)}</option>`).join('')}</select></div>
      <div class="form-row"><div class="form-group"><label>Project</label><select class="form-control" name="projectId" id="layer-project">${projectsHtml}</select></div>
      <div class="form-group"><label>Context</label><select class="form-control" name="subContextId" id="layer-subctx">${subCtxHtml}</select></div></div>`;
  },

  updateLayerSelects() {
    const areaId = document.getElementById('layer-area')?.value;
    const projectSel = document.getElementById('layer-project');
    const subCtxSel = document.getElementById('layer-subctx');
    if (!projectSel || !subCtxSel) return;
    projectSel.innerHTML = '<option value="">— No project —</option>';
    subCtxSel.innerHTML = '<option value="">— No context —</option>';
    if (areaId) {
      Store.getProjectsByArea(areaId).forEach((p) => { projectSel.innerHTML += `<option value="${p.id}">${Utils.esc(p.name)}</option>`; });
      Store.getArea(areaId)?.subContexts?.forEach((c) => { subCtxSel.innerHTML += `<option value="${c.id}">${c.icon} ${Utils.esc(c.name)}</option>`; });
    }
  },

  extraFields(item, type) {
    let html = '';
    if (['link', 'document'].includes(type)) {
      html += `<div class="form-group"><label>URL</label><input class="form-control" name="url" value="${Utils.esc(item?.url || '')}"></div>`;
    }
    if (type === 'link') {
      const cats = Store.getLinkCategories();
      html += `<div class="form-group"><label>Category</label>
        <select class="form-control" name="linkCategoryId">
          <option value="">— No category —</option>
          ${cats.map((c) => `<option value="${c.id}" ${item?.linkCategoryId === c.id ? 'selected' : ''}>${c.icon} ${Utils.esc(c.name)}</option>`).join('')}
        </select></div>`;
    }
    if (type === 'contact') {
      const groups = Store.getContactGroups();
      const selected = item?.contactGroupId || (App.contactFilter && App.contactFilter !== 'all' ? App.contactFilter : '');
      html += `<div class="form-group"><label>Contact group</label>
        <select class="form-control" name="contactGroupId">
          <option value="">— No group —</option>
          ${groups.map((g) => `<option value="${g.id}" ${selected === g.id ? 'selected' : ''}>${g.icon} ${Utils.esc(g.name)}</option>`).join('')}
        </select></div>`;
      html += `<div class="form-row">
        <div class="form-group"><label>Email</label><input class="form-control" name="contactEmail" value="${Utils.esc(item?.contactInfo?.email || '')}"></div>
        <div class="form-group"><label>Phone</label><input class="form-control" name="contactPhone" value="${Utils.esc(item?.contactInfo?.phone || '')}"></div></div>
        <div class="form-group"><label>Company</label><input class="form-control" name="contactCompany" value="${Utils.esc(item?.contactInfo?.company || '')}"></div>`;
    }
    if (type === 'task' || type === 'checklist') {
      html += `<div class="form-row">
        <div class="form-group"><label>Work status</label><select class="form-control" name="workStatus">${Store.getWorkStatuses().map((s) => `<option ${item?.workStatus === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="form-group"><label>Kanban</label><select class="form-control" name="kanbanStatus">${Store.getKanbanColumns().map((s) => `<option ${item?.kanbanStatus === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
        <div class="form-group"><label>Equipment ref.</label><input class="form-control" name="equipmentRef" value="${Utils.esc(item?.equipmentRef || '')}" placeholder="Quadro 12"></div>
        <div class="form-group"><label>Part numbers / BOM</label><input class="form-control" name="partNumbers" value="${Utils.esc(item?.partNumbers || '')}"></div>
        <div class="form-group"><label>Hours logged</label><input class="form-control" type="number" step="0.5" name="hoursLogged" value="${item?.hoursLogged || ''}"></div>`;
    }
    if (type === 'checklist') {
      const lines = (item?.checklistItems || [{ text: '', done: false }]).map((c) => c.text).join('\n');
      html += `<div class="form-group"><label>Checklist items (1 per line)</label><textarea class="form-control" name="checklistText" rows="4">${Utils.esc(lines)}</textarea></div>`;
    }
    return html;
  },

  openModal(html) {
    document.getElementById('modal-root').innerHTML = `<div class="modal-overlay" id="modal-overlay">${html}</div>`;
    document.getElementById('layer-area')?.addEventListener('change', () => this.updateLayerSelects());
  },

  closeModal() { document.getElementById('modal-root').innerHTML = ''; },

  openAddMenu() {
    const itemBtns = Object.entries(ITEM_TYPES).map(([key, v]) =>
      `<button type="button" class="add-menu-item" data-action="add-pick" data-kind="item" data-type="${key}">
        <span class="add-menu-icon">${v.icon}</span><span class="add-menu-label">${v.label}</span>
      </button>`).join('');

    const quickBtns = [
      ['quick', '⚡', 'Quick note'],
      ['ultra', '💨', 'Ultra-fast'],
      ['ai', '🤖', 'AI assistant'],
    ].map(([kind, icon, label]) =>
      `<button type="button" class="add-menu-item highlight" data-action="add-pick" data-kind="${kind}">
        <span class="add-menu-icon">${icon}</span><span class="add-menu-label">${label}</span>
      </button>`).join('');

    const orgBtns = [
      ['project', '📁', 'Project'],
      ['client', '🤝', 'Client'],
      ['area', '⚙', 'Area'],
    ].map(([kind, icon, label]) =>
      `<button type="button" class="add-menu-item" data-action="add-pick" data-kind="${kind}">
        <span class="add-menu-icon">${icon}</span><span class="add-menu-label">${label}</span>
      </button>`).join('');

    const resourceBtns = [
      ['vault', '🔐', 'Vault entry'],
      ['subscription', '💳', 'Subscription'],
    ].map(([kind, icon, label]) =>
      `<button type="button" class="add-menu-item" data-action="add-pick" data-kind="${kind}">
        <span class="add-menu-icon">${icon}</span><span class="add-menu-label">${label}</span>
      </button>`).join('');

    this.openModal(`<div class="modal modal-lg"><div class="modal-header"><h2>+ New</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <div class="modal-body add-menu">
        <p class="muted mb">Create anything — items, projects, clients, vault entries…</p>
        <h3 class="sub-heading">Quick capture</h3>
        <div class="add-menu-grid">${quickBtns}</div>
        <h3 class="sub-heading mt">Items</h3>
        <div class="add-menu-grid">${itemBtns}</div>
        <h3 class="sub-heading mt">Organization</h3>
        <div class="add-menu-grid">${orgBtns}</div>
        <h3 class="sub-heading mt">Resources</h3>
        <div class="add-menu-grid">${resourceBtns}</div>
      </div></div>`);
  },

  openQuickCapture(inboxItemId = null, ultra = false) {
    const item = inboxItemId ? Store.getItem(inboxItemId) : null;
    const last = Store.state.settings.lastQuickCapture || {};
    this.openModal(`<div class="modal"><div class="modal-header"><h2>⚡ ${ultra ? 'Ultra-fast' : 'Quick Note'}</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="quick-form"><div class="modal-body">
        <div class="form-group"><label>Title</label><input class="form-control" name="title" required value="${Utils.esc(item?.title || '')}"></div>
        ${ultra ? '' : `<div class="form-group"><label>Content</label><textarea class="form-control" name="body">${Utils.esc(item?.body || '')}</textarea></div>`}
        <div class="form-row"><div class="form-group"><label>Tipo</label><select class="form-control" name="type">${this.typeOptions(item?.type || 'idea')}</select></div>
        <div class="form-group"><label>Priority</label><select class="form-control" name="priority">${Store.getPriorities().map((p) => `<option value="${p}">${p}</option>`).join('')}</select></div></div>
        ${ultra ? '' : this.layerOptions(item || last)}
        <div class="form-group"><label>Quick tags</label><div class="tag-cloud">${Store.getQuickTags().map((t) => `<span class="tag tag-click quick-tag" data-tag="${t}">#${t}</span>`).join('')}</div>
        <input class="form-control mt" name="tags" placeholder="urgente, dev..."></div>
      </div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn btn-primary">Save</button></div></form></div>`);

    document.querySelectorAll('.quick-tag').forEach((el) => {
      el.addEventListener('click', () => {
        const inp = document.querySelector('[name=tags]');
        const t = el.dataset.tag;
        inp.value = inp.value ? inp.value + ', ' + t : t;
      });
    });
    document.getElementById('quick-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd);
      data.areaId = data.areaId || null;
      data.projectId = data.projectId || null;
      data.subContextId = data.subContextId || null;
      data.tags = Utils.parseTags(data.tags);
      data.inbox = !data.areaId && !data.projectId;
      if (item) Store.updateItem(item.id, data);
      else Store.addItem(data);
      Store.state.settings.lastQuickCapture = { areaId: data.areaId, projectId: data.projectId, subContextId: data.subContextId };
      Store.clearInboxStreak();
      Store.save();
      this.closeModal();
      App.refresh();
    });
  },

  openAiAssistant() {
    const hasKey = !!Store.state.settings.openaiApiKey?.trim();
    this.openModal(`<div class="modal"><div class="modal-header"><h2>🤖 AI Assistant</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <div class="modal-body">
        <p class="muted mb">Write in natural language — create tasks, complete tasks, log progress…</p>
        <textarea class="form-control ai-prompt" id="ai-prompt" rows="4" placeholder="Ex: Adiciona uma task chamada macaco"></textarea>
        <div class="ai-examples mt">
          ${AiAssistant.EXAMPLES.map((ex) => `<button type="button" class="filter-chip ai-example">${Utils.esc(ex)}</button>`).join('')}
        </div>
        <div id="ai-result" class="ai-result hidden"></div>
        <p class="muted mt sm">${hasKey ? '✓ OpenAI enabled (Settings)' : 'Local mode active — optional: API key in Settings → AI'}</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
        <button type="button" class="btn btn-primary" id="ai-submit">Process</button>
      </div></div>`);

    document.querySelectorAll('.ai-example').forEach((btn) => {
      btn.addEventListener('click', () => { document.getElementById('ai-prompt').value = btn.textContent; });
    });

    const run = async () => {
      const prompt = document.getElementById('ai-prompt').value.trim();
      const resultEl = document.getElementById('ai-result');
      const btn = document.getElementById('ai-submit');
      if (!prompt) return;
      btn.disabled = true;
      btn.textContent = 'Processing…';
      resultEl.classList.remove('hidden');
      resultEl.textContent = '…';
      try {
        const res = await AiAssistant.process(prompt);
        resultEl.textContent = res.message;
        resultEl.className = `ai-result ${res.ok ? 'ok' : 'err'}`;
        if (res.ok) {
          Store.clearInboxStreak();
          App.refresh();
          setTimeout(() => { this.closeModal(); App.refresh(); }, 1200);
        }
      } catch (e) {
        resultEl.textContent = 'Erro: ' + e.message;
        resultEl.className = 'ai-result err';
      }
      btn.disabled = false;
      btn.textContent = 'Process';
    };

    document.getElementById('ai-submit').addEventListener('click', run);
    document.getElementById('ai-prompt').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
    });
  },

  openVaultFolderModal(folderId = null) {
    const f = folderId ? Store.getVaultFolder(folderId) : null;
    this.openModal(`<div class="modal"><div class="modal-header"><h2>${f ? 'Edit' : 'New'} vault folder</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="vault-folder-form"><div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label>Icon</label><input class="form-control" name="icon" value="${Utils.esc(f?.icon || '🔐')}" maxlength="4"></div>
          <div class="form-group"><label>Color</label><input class="form-control" type="color" name="color" value="${f?.color || '#00d26a'}"></div>
        </div>
        <div class="form-group"><label>Name *</label><input class="form-control" name="name" required value="${Utils.esc(f?.name || '')}" placeholder="e.g. University, API Keys..."></div>
      </div><div class="modal-footer">
        <button type="button" class="btn" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div></form></div>`);
    document.getElementById('vault-folder-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      if (f) Store.updateVaultFolder(folderId, data);
      else Store.addVaultFolder(data);
      this.closeModal();
      App.refresh();
    });
  },

  openContactGroupModal(groupId = null) {
    const g = groupId ? Store.getContactGroup(groupId) : null;
    this.openModal(`<div class="modal"><div class="modal-header"><h2>${g ? 'Edit' : 'New'} group</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="contact-group-form"><div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label>Icon (emoji)</label><input class="form-control" name="icon" value="${Utils.esc(g?.icon || '👤')}" maxlength="4"></div>
          <div class="form-group"><label>Color</label><input class="form-control" type="color" name="color" value="${g?.color || '#00d26a'}"></div>
        </div>
        <div class="form-group"><label>Name *</label><input class="form-control" name="name" required value="${Utils.esc(g?.name || '')}" placeholder="e.g. Siemens, University..."></div>
      </div><div class="modal-footer">
        <button type="button" class="btn" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div></form></div>`);
    document.getElementById('contact-group-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      if (g) Store.updateContactGroup(groupId, data);
      else Store.addContactGroup(data);
      this.closeModal();
      App.refresh();
    });
  },

  openEmailAccountModal(accountId = null) {
    const a = accountId ? Store.getEmailAccount(accountId) : null;
    this.openModal(`<div class="modal"><div class="modal-header"><h2>${a ? 'Edit' : 'New'} email account</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="email-account-form"><div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label>Icon (emoji)</label><input class="form-control" name="icon" value="${Utils.esc(a?.icon || '✉')}" maxlength="4"></div>
          <div class="form-group"><label>Color</label><input class="form-control" type="color" name="color" value="${a?.color || '#00d26a'}"></div>
        </div>
        <div class="form-group"><label>Name *</label><input class="form-control" name="name" required value="${Utils.esc(a?.name || '')}" placeholder="Work, School, Personal…"></div>
        <div class="form-group"><label>Email *</label><input class="form-control" type="email" name="email" required value="${Utils.esc(a?.email || '')}" placeholder="you@gmail.com"></div>
        <div class="form-row">
          <div class="form-group"><label>Provider</label><select class="form-control" name="provider">
            <option value="gmail" ${(!a || a.provider === 'gmail') ? 'selected' : ''}>Gmail</option>
            <option value="other" ${a?.provider === 'other' ? 'selected' : ''}>Other (browser only)</option>
          </select></div>
          <div class="form-group"><label>Gmail profile index</label>
            <input class="form-control" type="number" name="gmailAuthIndex" min="0" max="9" value="${a?.gmailAuthIndex ?? ''}" placeholder="0 = first account in browser">
            <p class="muted sm mt">If you use multiple Gmail accounts in Chrome, use 0, 1, 2… to open the right inbox.</p>
          </div>
        </div>
      </div><div class="modal-footer">
        <button type="button" class="btn" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div></form></div>`);
    document.getElementById('email-account-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      if (a) Store.updateEmailAccount(accountId, data);
      else Store.addEmailAccount(data);
      this.closeModal();
      App.refresh();
    });
  },

  openItemModal(id = null, presetDate = null, presetProjectId = null, presetType = null) {
    const item = id ? Store.getItem(id) : null;
    if (item) Store.trackRecent(item.id);
    const today = presetDate || Utils.todayStr();
    const type = item?.type || presetType || 'note';

    this.openModal(`<div class="modal modal-lg"><div class="modal-header"><h2>${item ? 'Edit' : 'New'} item</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="item-form"><div class="modal-body">
        <div class="form-row"><div class="form-group"><label>Tipo</label><select class="form-control" name="type" id="item-type-select">${this.typeOptions(type)}</select></div>
        <div class="form-group"><label>Priority</label><select class="form-control" name="priority">${Store.getPriorities().map((p) => `<option value="${p}" ${item?.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div></div>
        <div class="form-group"><label>Title</label><input class="form-control" name="title" required value="${Utils.esc(item?.title || '')}"></div>
        <div class="form-group"><label>Content</label><textarea class="form-control" name="body" rows="5">${Utils.esc(item?.body || '')}</textarea></div>
        ${this.layerOptions(item || { projectId: presetProjectId })}
        <div class="form-row"><div class="form-group"><label>Start date</label><input class="form-control" type="date" name="startDate" value="${item?.startDate?.slice(0, 10) || today}"></div>
        <div class="form-group"><label>Due date</label><input class="form-control" type="date" name="dueDate" value="${item?.dueDate || ''}"></div></div>
        <div class="form-row"><div class="form-group"><label>Duration (min)</label><input class="form-control" type="number" name="duration" value="${item?.duration || ''}"></div>
        <div class="form-group"><label>Location / Link</label><input class="form-control" name="location" value="${Utils.esc(item?.location || '')}"></div></div>
        <div id="extra-fields">${this.extraFields(item, type)}</div>
        <div class="form-group"><label>Tags</label><input class="form-control" name="tags" value="${Utils.esc(item?.tags?.join(', ') || '')}"></div>
        <div class="form-group"><label>Attachment</label><input type="file" class="form-control" id="item-attachment"></div>
        ${item?.attachments?.length ? `<div class="attachment-list">${item.attachments.map((a) => {
          const prev = Utils.previewAttachment(a);
          return prev ? `<img src="${prev}" class="att-preview">` : `<span class="attachment-chip">📎 ${Utils.esc(a.name)}</span>`;
        }).join('')}</div>` : ''}
        ${item && ['note', 'decision'].includes(item.type) ? `<button type="button" class="btn btn-sm mt" data-action="extract-tasks" data-id="${item.id}">Extract tasks [ ]</button>` : ''}
        <label class="checkbox-row"><input type="checkbox" name="pinned" ${item?.pinned ? 'checked' : ''}> Pin</label>
      </div><div class="modal-footer">
        ${item ? `<button type="button" class="btn btn-ghost danger-left" data-action="delete-item-modal" data-id="${item.id}">Delete</button>` : ''}
        <button type="button" class="btn" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button></div></form></div>`);

    document.getElementById('item-type-select')?.addEventListener('change', (e) => {
      document.getElementById('extra-fields').innerHTML = this.extraFields(item, e.target.value);
    });
    document.getElementById('item-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd);
      data.areaId = data.areaId || null;
      data.projectId = data.projectId || null;
      data.subContextId = data.subContextId || null;
      data.tags = Utils.parseTags(data.tags);
      data.duration = data.duration ? parseInt(data.duration, 10) : null;
      data.hoursLogged = data.hoursLogged ? parseFloat(data.hoursLogged) : 0;
      data.pinned = !!fd.get('pinned');
      data.contactGroupId = data.contactGroupId || null;
      data.linkCategoryId = data.linkCategoryId || null;
      data.inbox = !data.areaId && !data.projectId;
      if (data.startDate && !data.startDate.includes('T')) data.startDate = data.startDate + 'T09:00';
      if (data.contactEmail || data.contactPhone || data.contactCompany) {
        data.contactInfo = { email: data.contactEmail || '', phone: data.contactPhone || '', company: data.contactCompany || '' };
      }
      if (data.checklistText) {
        data.checklistItems = data.checklistText.split('\n').filter(Boolean).map((text) => ({ text: text.trim(), done: false }));
      }
      const fileInput = document.getElementById('item-attachment');
      let attachments = item?.attachments || [];
      if (fileInput?.files?.[0]) {
        const file = fileInput.files[0];
        if (file.size > 500000) alert('Max 500KB');
        else {
          const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
          attachments = [...attachments, { name: file.name, type: file.type, data: b64 }];
        }
      }
      data.attachments = attachments;
      if (item) Store.updateItem(item.id, data);
      else Store.addItem(data);
      Store.clearInboxStreak();
      this.closeModal();
      App.refresh();
    });
  },

  openProjectModal(presetClientId = null, projectId = null) {
    const project = projectId ? Store.getProject(projectId) : null;
    const isEdit = !!project;
    const clients = Store.getClients();
    this.openModal(`<div class="modal"><div class="modal-header"><h2>${isEdit ? I18n.t('project.edit') : I18n.t('project.new')}</h2><button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="project-form"><div class="modal-body">
        <div class="form-group"><label>Name</label><input class="form-control" name="name" required value="${Utils.esc(project?.name || '')}"></div>
        <div class="form-group"><label>Area</label><select class="form-control" name="areaId" id="proj-area">${Store.state.areas.map((a) => `<option value="${a.id}" ${project ? (project.areaId === a.id ? 'selected' : '') : (a.id === 'area-freelance' ? 'selected' : '')}>${a.icon} ${Utils.esc(a.name)}</option>`).join('')}</select></div>
        <div class="form-group"><label>Client (candeias.dev)</label>
          <select class="form-control" name="clientId" id="proj-client">
            <option value="">— Manual / no client —</option>
            ${clients.map((c) => `<option value="${c.id}" ${(project?.clientId === c.id || presetClientId === c.id) ? 'selected' : ''}>${Utils.esc(c.name)}${c.company ? ` (${Utils.esc(c.company)})` : ''}</option>`).join('')}
          </select></div>
        <div class="form-row"><div class="form-group"><label>Client name (if manual)</label><input class="form-control" name="client" id="proj-client-name" value="${Utils.esc(project?.client || '')}"></div>
        <div class="form-group"><label>Email</label><input class="form-control" name="clientEmail" id="proj-client-email" value="${Utils.esc(project?.clientEmail || '')}"></div></div>
        <div class="form-row"><div class="form-group"><label>Phone</label><input class="form-control" name="clientPhone" value="${Utils.esc(project?.clientPhone || '')}"></div>
        <div class="form-group"><label>Stack</label><input class="form-control" name="stack" value="${Utils.esc(project?.stack || '')}"></div></div>
        <div class="form-row"><div class="form-group"><label>Pipeline</label><select class="form-control" name="pipeline"><option value="">—</option>${Store.getPipelineStages().map((s) => `<option ${project?.pipeline === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="form-group"><label>Payment</label><select class="form-control" name="paymentStatus"><option value="">—</option>${Store.getPaymentStatuses().map((s) => `<option ${project?.paymentStatus === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
        <div class="form-row"><div class="form-group"><label>Estimated hours</label><input class="form-control" type="number" name="estimatedHours" value="${project?.estimatedHours ?? ''}"></div>
        <div class="form-group"><label>URL</label><input class="form-control" name="url" value="${Utils.esc(project?.url || '')}"></div></div>
        <div class="form-group"><label>Description</label><textarea class="form-control" name="description">${Utils.esc(project?.description || '')}</textarea></div>
      </div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">${I18n.t('action.cancel')}</button>
      <button type="submit" class="btn btn-primary">${isEdit ? I18n.t('action.save') : I18n.t('action.create')}</button></div></form></div>`);
    const clientSel = document.getElementById('proj-client');
    const fillClient = () => {
      const c = Store.getClient(clientSel.value);
      if (c) {
        document.getElementById('proj-client-name').value = c.name;
        document.getElementById('proj-client-email').value = c.email || '';
      }
    };
    clientSel?.addEventListener('change', fillClient);
    if (presetClientId && !isEdit) fillClient();
    document.getElementById('project-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      data.clientId = data.clientId || null;
      data.estimatedHours = parseFloat(data.estimatedHours) || 0;
      if (isEdit) Store.updateProject(projectId, data);
      else Store.addProject(data);
      this.closeModal();
      App.refresh();
    });
  },

  openClientModal(id = null) {
    const client = id ? Store.getClient(id) : null;
    this.openModal(`<div class="modal modal-lg"><div class="modal-header"><h2>${client ? 'Edit' : 'New'} client</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="client-form"><div class="modal-body">
        <div class="form-row"><div class="form-group"><label>Name *</label><input class="form-control" name="name" required value="${Utils.esc(client?.name || '')}"></div>
        <div class="form-group"><label>Company</label><input class="form-control" name="company" value="${Utils.esc(client?.company || '')}"></div></div>
        <div class="form-row"><div class="form-group"><label>Email</label><input class="form-control" type="email" name="email" value="${Utils.esc(client?.email || '')}"></div>
        <div class="form-group"><label>Phone</label><input class="form-control" name="phone" value="${Utils.esc(client?.phone || '')}"></div></div>
        <div class="form-row"><div class="form-group"><label>Website</label><input class="form-control" name="website" value="${Utils.esc(client?.website || '')}"></div>
        <div class="form-group"><label>NIF</label><input class="form-control" name="nif" value="${Utils.esc(client?.nif || '')}"></div></div>
        <div class="form-group"><label>Address</label><input class="form-control" name="address" value="${Utils.esc(client?.address || '')}"></div>
        <div class="form-row"><div class="form-group"><label>Status</label><select class="form-control" name="status">${Store.getClientStatuses().map((s) => `<option ${client?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="form-group"><label>Tags</label><input class="form-control" name="tags" value="${Utils.esc(client?.tags?.join(', ') || '')}" placeholder="website, wordpress"></div></div>
        <div class="form-group"><label>Notes</label><textarea class="form-control" name="notes" rows="3">${Utils.esc(client?.notes || '')}</textarea></div>
      </div><div class="modal-footer">
        ${client ? `<button type="button" class="btn btn-ghost danger-left" data-action="delete-client-modal" data-id="${client.id}">Delete</button>` : ''}
        <button type="button" class="btn" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button></div></form></div>`);
    document.getElementById('client-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      data.tags = Utils.parseTags(data.tags);
      if (client) Store.updateClient(client.id, data);
      else Store.addClient(data);
      this.closeModal();
      App.refresh();
    });
  },

  openClientContactModal(clientId, contactId = null) {
    const client = Store.getClient(clientId);
    const contact = contactId ? client?.contacts.find((c) => c.id === contactId) : null;
    this.openModal(`<div class="modal"><div class="modal-header"><h2>${contact ? 'Edit' : 'New'} contact</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="contact-form"><div class="modal-body">
        <p class="muted mb">Client: <strong>${Utils.esc(client?.name)}</strong></p>
        <div class="form-group"><label>Name *</label><input class="form-control" name="name" required value="${Utils.esc(contact?.name || '')}"></div>
        <div class="form-group"><label>Role / Title</label><input class="form-control" name="role" value="${Utils.esc(contact?.role || '')}" placeholder="Manager, Marketing, IT..."></div>
        <div class="form-row"><div class="form-group"><label>Email</label><input class="form-control" name="email" value="${Utils.esc(contact?.email || '')}"></div>
        <div class="form-group"><label>Phone</label><input class="form-control" name="phone" value="${Utils.esc(contact?.phone || '')}"></div></div>
        <label class="checkbox-row"><input type="checkbox" name="isPrimary" ${contact?.isPrimary ? 'checked' : ''}> Primary contact</label>
      </div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn btn-primary">Save</button></div></form></div>`);
    document.getElementById('contact-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = { name: fd.get('name'), role: fd.get('role'), email: fd.get('email'), phone: fd.get('phone'), isPrimary: !!fd.get('isPrimary') };
      if (data.isPrimary) client.contacts.forEach((c) => { c.isPrimary = false; });
      if (contact) Store.updateClientContact(clientId, contactId, data);
      else Store.addClientContact(clientId, data);
      this.closeModal();
      App.refresh();
    });
  },

  openAreaModal(areaId = null) {
    const area = areaId ? Store.getArea(areaId) : null;
    this.openModal(`<div class="modal"><div class="modal-header"><h2>${area ? 'Edit' : 'New'} area</h2><button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="area-form"><div class="modal-body"><div class="form-row"><div class="form-group"><label>Name</label><input class="form-control" name="name" required value="${Utils.esc(area?.name || '')}"></div>
      <div class="form-group"><label>Icon</label><input class="form-control" name="icon" value="${Utils.esc(area?.icon || '📁')}" maxlength="4"></div></div>
      <div class="form-group"><label>Color</label><input class="form-control" type="color" name="color" value="${area?.color || '#00d26a'}"></div>
      </div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">${area ? 'Save' : 'Create'}</button></div></form></div>`);
    document.getElementById('area-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      if (area) Store.updateArea(areaId, data);
      else Store.addArea(data);
      this.closeModal();
      App.refresh();
    });
  },

  openLinkCategoryModal(catId = null) {
    const c = catId ? Store.getLinkCategory(catId) : null;
    this.openModal(`<div class="modal"><div class="modal-header"><h2>${c ? 'Edit' : 'New'} link category</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="link-cat-form"><div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label>Icon</label><input class="form-control" name="icon" value="${Utils.esc(c?.icon || '🔗')}" maxlength="4"></div>
          <div class="form-group"><label>Color</label><input class="form-control" type="color" name="color" value="${c?.color || '#00d26a'}"></div>
        </div>
        <div class="form-group"><label>Name *</label><input class="form-control" name="name" required value="${Utils.esc(c?.name || '')}"></div>
      </div><div class="modal-footer">
        <button type="button" class="btn" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div></form></div>`);
    document.getElementById('link-cat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      if (c) Store.updateLinkCategory(catId, data);
      else Store.addLinkCategory(data);
      this.closeModal();
      App.refresh();
    });
  },

  openDisciplineModal(discId = null) {
    const d = discId ? Store.getDiscipline(discId) : null;
    this.openModal(`<div class="modal"><div class="modal-header"><h2>${d ? 'Edit' : 'New'} subject</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="disc-form"><div class="modal-body">
        <div class="form-group"><label>Name *</label><input class="form-control" name="name" required value="${Utils.esc(d?.name || '')}"></div>
        <div class="form-group"><label>Default weight (%)</label><input class="form-control" type="number" name="defaultWeight" value="${d?.defaultWeight ?? 30}"></div>
      </div><div class="modal-footer">
        <button type="button" class="btn" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div></form></div>`);
    document.getElementById('disc-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      if (d) Store.updateDiscipline(discId, data);
      else Store.addDiscipline(data);
      this.closeModal();
      App.refresh();
    });
  },

  openCustomTemplateModal() {
    this.openModal(`<div class="modal"><div class="modal-header"><h2>New template</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="custom-tpl-form"><div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label>Icon</label><input class="form-control" name="icon" value="📝" maxlength="4"></div>
          <div class="form-group"><label>Tipo</label><select class="form-control" name="type"><option value="note">Note</option><option value="checklist">Checklist</option></select></div>
        </div>
        <div class="form-group"><label>Name *</label><input class="form-control" name="name" required placeholder="e.g. Monthly report"></div>
        <div class="form-group"><label>Item title</label><input class="form-control" name="title" placeholder="Same as name if empty"></div>
        <div class="form-group"><label>Content</label><textarea class="form-control" name="body" rows="5" placeholder="Text or checklist items (1 per line)"></textarea></div>
        <div class="form-group"><label>Tags</label><input class="form-control" name="tags" placeholder="dev, cliente"></div>
      </div><div class="modal-footer">
        <button type="button" class="btn" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">Create</button>
      </div></form></div>`);
    document.getElementById('custom-tpl-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      data.tags = Utils.parseTags(data.tags);
      if (data.type === 'checklist') {
        data.checklistItems = data.body.split('\n').filter(Boolean).map((text) => ({ text: text.trim(), done: false }));
        data.body = '';
      }
      Store.addCustomTemplate(data);
      this.closeModal();
      App.refresh();
    });
  },

  async openVaultModal(id = null, presetClientId = null) {
    const entry = id ? Store.state.vaultEntries.find((e) => e.id === id) : null;
    const client = presetClientId ? Store.getClient(presetClientId) : null;
    let secrets = { password: '', notes: '' };
    if (entry && Vault.sessionPassword) secrets = await Vault.loadEntrySecrets(entry, Vault.sessionPassword);
    this.openModal(`<div class="modal"><div class="modal-header"><h2>${entry ? 'Edit' : 'New'} entry</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="vault-form"><div class="modal-body">
        <div class="form-group"><label>Service</label><input class="form-control" name="service" required value="${Utils.esc(entry?.service || (client ? client.name + ' — hosting' : ''))}"></div>
        <div class="form-row"><div class="form-group"><label>Folder</label><select class="form-control" name="folder">
          ${Store.getVaultFolders().map((vf) => `<option ${(entry?.folder || (client ? 'Clients' : 'Personal')) === vf.name ? 'selected' : ''}>${vf.icon} ${Utils.esc(vf.name)}</option>`).join('')}</select></div>
        <div class="form-group"><label>Client</label><select class="form-control" name="clientId">
          <option value="">— None —</option>
          ${Store.getClients().map((c) => `<option value="${c.id}" ${(entry?.clientId || presetClientId) === c.id ? 'selected' : ''}>${Utils.esc(c.name)}</option>`).join('')}
        </select></div></div>
        <div class="form-row"><div class="form-group"><label>Email</label><input class="form-control" name="email" value="${Utils.esc(entry?.email || '')}"></div>
        <div class="form-group"><label>Username</label><input class="form-control" name="username" value="${Utils.esc(entry?.username || '')}"></div></div>
        <div class="form-group"><label>Password</label><div class="flex-row"><input class="form-control mono" name="password" value="${Utils.esc(secrets.password)}" id="vault-pw">
        <button type="button" class="btn btn-sm" id="gen-pw">Generate</button></div><span class="muted" id="pw-strength"></span></div>
        <div class="form-group"><label>URL</label><input class="form-control" name="url" value="${Utils.esc(entry?.url || '')}"></div>
        <div class="form-row"><div class="form-group"><label>2FA</label><input class="form-control" name="twoFA" value="${Utils.esc(entry?.twoFA || '')}"></div>
        <div class="form-group"><label>API Key</label><input class="form-control" name="apiKey" value="${Utils.esc(entry?.apiKey || '')}"></div></div>
        <div class="form-group"><label>Expires</label><input class="form-control" type="date" name="expiryDate" value="${entry?.expiryDate || ''}"></div>
        <div class="form-group"><label>Notes</label><textarea class="form-control" name="notes">${Utils.esc(secrets.notes)}</textarea></div>
      </div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Save</button></div></form></div>`);
    document.getElementById('gen-pw')?.addEventListener('click', () => {
      const pw = Vault.generatePassword();
      document.getElementById('vault-pw').value = pw;
      document.getElementById('pw-strength').textContent = 'Strength: ' + Utils.passwordStrength(pw).label;
    });
    document.getElementById('vault-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      data.clientId = data.clientId || null;
      if (Vault.sessionPassword) {
        if (entry) { await Vault.saveEntrySecrets({ ...entry, ...data }, Vault.sessionPassword); Store.updateVaultEntry(entry.id, data); }
        else { const e2 = Store.addVaultEntry(data); await Vault.saveEntrySecrets(e2, Vault.sessionPassword); Store.save(); }
      } else Store.addVaultEntry(data);
      this.closeModal();
      App.refresh();
    });
  },

  openCommandPalette() {
    this.openModal(`<div class="modal cmd-palette"><input type="text" id="cmd-input" placeholder="Search..." autofocus><div class="cmd-results" id="cmd-results"></div></div>`);
    const input = document.getElementById('cmd-input');
    const results = document.getElementById('cmd-results');
    const search = (q) => {
      if (!q) {
        results.innerHTML = ['AI Assistant|ai', 'Quick note|quick', 'Ultra-fast|ultra', 'Tools|tools', 'New item|item', 'Clients|clients', 'Inbox|inbox', 'Overdue|overdue', 'Vault|vault', 'Statistics|stats', 'Settings|settings']
          .map(([l, a]) => `<div class="cmd-item" data-cmd-action="${a}"><span class="cmd-item-type">Action</span> ${l}</div>`).join('');
      } else {
        const items = Store.getItems({ search: q }).slice(0, 8);
        const projects = Store.state.projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 4);
        results.innerHTML = [...projects.map((p) => `<div class="cmd-item" data-cmd="project" data-id="${p.id}"><span class="cmd-item-type">Project</span> ${Utils.esc(p.name)}</div>`),
          ...items.map((i) => `<div class="cmd-item" data-cmd="item" data-id="${i.id}"><span class="cmd-item-type">${i.type}</span> ${Utils.esc(i.title)}</div>`)].join('') || '<div class="cmd-item muted">No results</div>';
      }
      results.querySelectorAll('.cmd-item[data-cmd]').forEach((el) => el.addEventListener('click', () => {
        this.closeModal();
        if (el.dataset.cmd === 'item') this.openItemModal(el.dataset.id);
        if (el.dataset.cmd === 'project') { App.projectDetailId = el.dataset.id; App.navigate('projects'); }
      }));
      results.querySelectorAll('[data-cmd-action]').forEach((el) => el.addEventListener('click', () => {
        this.closeModal();
        const a = el.dataset.cmdAction;
        if (a === 'quick') this.openQuickCapture();
        if (a === 'ai') this.openAiAssistant();
        if (a === 'tools') App.navigate('tools');
        if (a === 'ultra') this.openQuickCapture(null, true);
        if (a === 'item') this.openItemModal();
        if (a === 'clients') App.navigate('clients');
        if (a === 'inbox') App.navigate('inbox');
        if (a === 'overdue') App.navigate('overdue');
        if (a === 'vault') App.navigate('vault');
        if (a === 'stats') App.navigate('stats');
        if (a === 'settings') App.navigate('settings');
      }));
    };
    input.addEventListener('input', () => search(input.value));
    search('');
    input.focus();
  },

  openSchoolScheduleModal() {
    const schedule = Store.state.settings.schoolSchedule || SchoolSchedule.defaultSchedule();
    const renderSlot = (day, slot, idx) => `
      <div class="school-slot-row" data-day="${day}" data-idx="${idx}">
        <div class="time-pair">
          <input class="form-control sm" type="time" value="${slot.startTime || '09:00'}" data-field="startTime">
          <input class="form-control sm" type="time" value="${slot.endTime || '10:00'}" data-field="endTime">
        </div>
        <input class="form-control" placeholder="Subject" value="${Utils.esc(slot.subject || '')}" data-field="subject">
        <div class="slot-actions">
          <input class="form-control sm" placeholder="Room" value="${Utils.esc(slot.room || '')}" data-field="room">
          <button type="button" class="btn btn-ghost btn-icon sm" data-action="remove-school-slot" title="Remove">✕</button>
        </div>
      </div>`;

    const columns = SCHOOL_WEEKDAYS.map((wd) => {
      const slots = SchoolSchedule.getSlotsForDay(schedule, wd.id);
      const rows = slots.length
        ? slots.map((s, i) => renderSlot(wd.id, s, i)).join('')
        : renderSlot(wd.id, { startTime: '09:00', endTime: '10:00', subject: '', room: '' }, 0);
      return `<div class="school-day-col" data-day-col="${wd.id}">
        <div class="school-day-head">${wd.label}</div>
        <div class="school-slots" id="school-slots-${wd.id}">${rows}</div>
        <button type="button" class="btn btn-sm btn-ghost school-add-slot" data-day-add="${wd.id}">+ Class</button>
      </div>`;
    }).join('');

    this.openModal(`<div class="modal modal-wide"><div class="modal-header"><h2>🏫 School Schedule</h2>
      <button class="btn btn-ghost btn-icon" data-action="close-modal">✕</button></div>
      <form id="school-schedule-form"><div class="modal-body">
        <p class="muted mb">Fill top to bottom (Monday to Friday). Repeats automatically every week.</p>
        <label class="checkbox-row mb"><input type="checkbox" name="enabled" ${schedule.enabled ? 'checked' : ''}> Schedule active on calendar</label>
        <label class="checkbox-row mb"><input type="checkbox" name="showInCalendar" ${schedule.showInCalendar !== false ? 'checked' : ''}> Show in «Both» on calendar</label>
        <div class="school-grid">${columns}</div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">Save schedule</button>
      </div></form></div>`);

    document.querySelectorAll('[data-day-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const day = btn.dataset.dayAdd;
        const container = document.getElementById(`school-slots-${day}`);
        const idx = container.querySelectorAll('.school-slot-row').length;
        container.insertAdjacentHTML('beforeend', `
          <div class="school-slot-row" data-day="${day}" data-idx="${idx}">
            <div class="time-pair">
              <input class="form-control sm" type="time" value="09:00" data-field="startTime">
              <input class="form-control sm" type="time" value="10:00" data-field="endTime">
            </div>
            <input class="form-control" placeholder="Subject" value="" data-field="subject">
            <div class="slot-actions">
              <input class="form-control sm" placeholder="Room" value="" data-field="room">
              <button type="button" class="btn btn-ghost btn-icon sm" data-action="remove-school-slot" title="Remove">✕</button>
            </div>
          </div>`);
        this.bindSchoolSlotRemove();
      });
    });

    this.bindSchoolSlotRemove();

    document.getElementById('school-schedule-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const daysData = {};
      for (let d = 0; d < 5; d++) {
        daysData[d] = [];
        document.querySelectorAll(`.school-slot-row[data-day="${d}"]`).forEach((row) => {
          const slot = {};
          row.querySelectorAll('[data-field]').forEach((inp) => { slot[inp.dataset.field] = inp.value; });
          daysData[d].push(slot);
        });
      }
      Store.state.settings.schoolSchedule = {
        enabled: form.enabled.checked,
        showInCalendar: form.showInCalendar.checked,
        days: SchoolSchedule.normalizeFromForm(daysData),
      };
      Store.save();
      this.closeModal();
      App.refresh();
    });
  },

  bindSchoolSlotRemove() {
    document.querySelectorAll('[data-action="remove-school-slot"]').forEach((btn) => {
      btn.onclick = () => btn.closest('.school-slot-row')?.remove();
    });
  },

  useTemplate(name) {
    const custom = Store.getCustomTemplates().find((t) => t.id === name);
    if (custom) {
      Store.addItem({ ...custom, id: undefined });
      App.refresh();
      return;
    }
    const templates = {
      'field-sheet': { type: 'checklist', title: 'Folha de obra / vistoria', areaId: 'area-work', tags: ['obra', 'RTIEBT'],
        checklistItems: [
          { text: 'Identificação do quadro / local', done: false },
          { text: 'Ensaio de isolamento', done: false },
          { text: 'Verificação de ligações e torque', done: false },
          { text: 'Continuidade PE', done: false },
          { text: 'Teste de disparo diferencial', done: false },
          { text: 'Fotos / esquema actualizado', done: false },
          { text: 'Assinatura responsável técnico', done: false },
        ] },
      meeting: { type: 'note', title: 'Ata de reunião', body: MEETING_TEMPLATE, tags: ['reunião'], areaId: 'area-work' },
      'checklist-delivery': { type: 'checklist', title: 'Checklist entrega painel', checklistItems: [{ text: 'Validar BOM', done: false }, { text: 'Testar cablagem', done: false }, { text: 'Documentação', done: false }], areaId: 'area-work' },
      'client-brief': { type: 'note', title: 'Brief cliente', body: 'Objetivos:\n\nPáginas:\n\nReferências:\n\nPrazo:\n\nOrçamento:', areaId: 'area-freelance', tags: ['cliente'] },
      concert: { type: 'checklist', title: 'Pack concerto', checklistItems: [{ text: 'Bilhetes', done: false }, { text: 'Transporte', done: false }, { text: 'Jantar antes', done: false }], areaId: 'area-personal', subContextId: 'ctx-concerts', tags: ['concerto'] },
    };
    const t = templates[name];
    if (t) { Store.addItem(t); App.refresh(); }
  },
};
