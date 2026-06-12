function buildDemoData() {
  const today = Utils.todayStr();
  const yesterday = Utils.addDays(today, -1);
  const tomorrow = Utils.addDays(today, 1);
  const nextWeek = Utils.addDays(today, 7);
  const lastWeek = Utils.addDays(today, -5);

  const clients = [
    clientDefaults({
      id: 'client-demo', name: 'Cliente Demo', company: 'Demo Lda',
      email: 'cliente@demo.pt', phone: '+351 912 000 000', website: 'https://demo.pt',
      nif: '500123456', address: 'Rua Example 123, Lisboa', status: 'Active',
      notes: 'Cliente biscate — site em desenvolvimento. Pagamento após entrega.',
      tags: ['website', 'react'],
      contacts: [
        { id: 'cc-1', name: 'João Silva', role: 'Gerente', email: 'joao@demo.pt', phone: '+351 912 000 001', isPrimary: true },
        { id: 'cc-2', name: 'Maria Costa', role: 'Marketing', email: 'maria@demo.pt', phone: '+351 912 000 002', isPrimary: false },
      ],
    }),
    clientDefaults({
      id: 'client-lead', name: 'Restaurante Silva', company: 'Silva & Filhos',
      email: 'geral@restaurantesilva.pt', phone: '+351 913 111 222', status: 'Lead',
      notes: 'Interessados em website + menu digital. Enviar orçamento até sexta.',
      tags: ['lead', 'wordpress'],
      contacts: [
        { id: 'cc-3', name: 'António Silva', role: 'Proprietário', email: 'antonio@restaurantesilva.pt', phone: '+351 913 111 222', isPrimary: true },
      ],
    }),
    clientDefaults({
      id: 'client-done', name: 'Loja Tech PT', company: 'Tech PT Unipessoal',
      email: 'info@techpt.pt', phone: '+351 914 222 333', website: 'https://techpt.pt',
      status: 'Manutenção', tags: ['manutenção', 'wordpress'],
      notes: 'Site entregue em março. Manutenção mensal.',
      contacts: [
        { id: 'cc-4', name: 'Pedro Santos', role: 'CEO', email: 'pedro@techpt.pt', phone: '+351 914 222 333', isPrimary: true },
      ],
    }),
  ];

  const projects = [
    projectDefaults({
      id: 'proj-siemens-1', areaId: 'area-work', name: 'Modernização Painel X',
      description: 'Projeto principal — quadro de distribuição', client: 'Siemens', color: '#00d26a',
      estimatedHours: 120, loggedHours: 45,
    }),
    projectDefaults({
      id: 'proj-siemens-2', areaId: 'area-work', name: 'Auditoria Quadro Y',
      description: 'Revisão de cablagem e BOM', client: 'Siemens', color: '#00d26a',
      pipeline: null, estimatedHours: 24, loggedHours: 8,
    }),
    projectDefaults({
      id: 'proj-freelance-1', areaId: 'area-freelance', name: 'Site Cliente Demo',
      description: 'Website corporativo responsivo', pipeline: 'In development',
      stack: 'React, Python', url: 'https://demo.pt', client: 'Cliente Demo', clientId: 'client-demo',
      clientEmail: 'cliente@demo.pt', paymentStatus: 'To invoice', estimatedHours: 40, loggedHours: 12,
      color: '#00ff88',
      versions: [
        { version: '1.0', date: Utils.addDays(today, -14), notes: 'Versão inicial' },
        { version: '1.1', date: today, notes: 'Hero section + contactos' },
      ],
    }),
    projectDefaults({
      id: 'proj-freelance-2', areaId: 'area-freelance', name: 'App Orçamentos Silva',
      description: 'Proposta WordPress — aguarda aprovação', pipeline: 'Proposal',
      stack: 'WordPress', client: 'Restaurante Silva', clientId: 'client-lead',
      clientEmail: 'geral@restaurantesilva.pt', paymentStatus: 'To invoice',
      estimatedHours: 25, color: '#00ff88',
    }),
    projectDefaults({
      id: 'proj-freelance-3', areaId: 'area-freelance', name: 'Site Tech PT',
      description: 'Manutenção e updates', pipeline: 'Maintenance',
      stack: 'WordPress', url: 'https://techpt.pt', client: 'Loja Tech PT', clientId: 'client-done',
      paymentStatus: 'Paid', estimatedHours: 4, loggedHours: 2, color: '#34d399',
    }),
    projectDefaults({
      id: 'proj-uni-1', areaId: 'area-uni', name: 'Trabalho Base de Dados',
      description: 'UC Bases de Dados — projeto final', client: 'Faculdade', color: '#10b981',
      estimatedHours: 30, loggedHours: 10,
    }),
    projectDefaults({
      id: 'proj-archived', areaId: 'area-freelance', name: 'Landing Page 2025',
      description: 'Projeto concluído', pipeline: 'Delivered', client: 'Cliente Antigo',
      stack: 'HTML/CSS', paymentStatus: 'Paid', archived: true, color: '#666',
    }),
  ];

  const subscriptions = [
    { id: 'sub-1', name: 'Spotify', amount: 10.99, renewalDate: Utils.addDays(today, 20), category: 'Pessoal', url: 'https://spotify.com' },
    { id: 'sub-2', name: 'Hosting candeias.dev', amount: 5.00, renewalDate: Utils.addDays(today, 60), category: 'candeias.dev', url: '' },
    { id: 'sub-3', name: 'GitHub Pro', amount: 4.00, renewalDate: Utils.addDays(today, 45), category: 'candeias.dev', url: 'https://github.com' },
    { id: 'sub-4', name: 'Ginásio', amount: 29.99, renewalDate: Utils.addDays(today, 5), category: 'Pessoal', url: '' },
    { id: 'sub-5', name: 'Domínio demo.pt', amount: 12.00, renewalDate: Utils.addDays(today, 90), category: 'Clientes', url: '' },
  ];

  const vaultEntries = [
    {
      id: 'vault-1', service: 'GitHub — candeias.dev', folder: 'Hosting',
      email: 'tiago@candeias.dev', username: 'candeiasdev', password: 'demo_NAO_usar_real',
      url: 'https://github.com', favorite: true,
      notes: '2FA activo no telemóvel', twoFA: 'App Authenticator',
    },
    {
      id: 'vault-2', service: 'Hosting Cliente Demo', folder: 'Clientes', clientId: 'client-demo',
      email: 'admin@demo.pt', username: 'admin', password: 'demo_hosting_123',
      url: 'https://cpanel.demo.pt', expiryDate: Utils.addDays(today, 180),
    },
    {
      id: 'vault-3', service: 'Siemens VPN', folder: 'Siemens',
      email: 'z005027j@siemens.com', username: 'z005027j', password: 'demo_vpn',
      url: 'https://vpn.siemens.com', twoFA: 'Token corporativo',
    },
    {
      id: 'vault-4', service: 'Cloudflare API', folder: 'API Keys',
      email: '', username: 'api', password: '', apiKey: 'demo_cf_key_xxxxx',
      url: 'https://cloudflare.com', notes: 'DNS candeias.dev',
    },
  ];

  const items = [
    // ── SIEMENS ──
    itemDefaults({ id: 'ex-event-1', type: 'event', areaId: 'area-work', projectId: 'proj-siemens-1',
      title: 'Reunião de projeto — Painel X', tags: ['reunião'], pinned: true,
      body: 'Rever cronograma, BOM e action items.', startDate: `${today}T10:00`, endDate: `${today}T11:00`, duration: 60, location: 'Teams' }),
    itemDefaults({ id: 'ex-note-1', type: 'note', areaId: 'area-work', projectId: 'proj-siemens-1',
      title: 'Notas da reunião', tags: ['reunião', 'BOM'], linkedNoteId: null,
      body: MEETING_TEMPLATE + '\nDecisões:\n- Validar BOM até sexta\n- Usar cabo X\n\nAction items:\n- [ ] Falar com fornecedor\n- [ ] Revisar cablagem quadro Y\n- [ ] Enviar diagrama atualizado' }),
    itemDefaults({ id: 'ex-task-1', type: 'task', areaId: 'area-work', projectId: 'proj-siemens-1',
      title: 'Enviar diagrama atualizado', tags: ['urgente', 'diagrama'], duration: 120,
      dueDate: tomorrow, priority: 'high', kanbanStatus: 'Today', linkedNoteId: 'ex-note-1', equipmentRef: 'Quadro Y', pinned: true }),
    itemDefaults({ id: 'ex-task-overdue', type: 'task', areaId: 'area-work', projectId: 'proj-siemens-2',
      title: 'Validar BOM — Quadro Y', tags: ['BOM', 'urgente'], dueDate: yesterday, priority: 'urgent', equipmentRef: 'Quadro Y', partNumbers: 'PN-12345, PN-67890' }),
    itemDefaults({ id: 'ex-task-blocked', type: 'task', areaId: 'area-work', projectId: 'proj-siemens-1',
      title: 'Aguardar resposta fornecedor', tags: ['espera-resposta'], kanbanStatus: 'Blocked', workStatus: 'Blocked', dueDate: nextWeek,
      body: 'Email enviado dia 10 — à espera cotação cabo X' }),
    itemDefaults({ id: 'ex-contact-1', type: 'contact', areaId: 'area-work', projectId: 'proj-siemens-1',
      title: 'Fornecedor ABC', tags: ['fornecedor', 'BOM'], contactGroupId: 'cg-fornecedores',
      contactInfo: { email: 'vendas@abc-fornecedor.pt', phone: '+351 900 000 000', company: 'ABC Cabos Lda' } }),
    itemDefaults({ id: 'ex-contact-2', type: 'contact', areaId: 'area-work', contactGroupId: 'cg-siemens',
      title: 'João — Responsável técnico', body: 'Equipa BT · Painéis',
      contactInfo: { email: 'joao.siemens@example.com', phone: '+351 911 111 111', company: 'Siemens' } }),
    itemDefaults({ id: 'ex-contact-3', type: 'contact', areaId: 'area-uni', contactGroupId: 'cg-faculdade',
      title: 'Prof. Martins — Circuitos', body: 'Horário de dúvidas: Quinta 14h–16h',
      contactInfo: { email: 'martins@faculdade.pt', phone: '', company: 'DEEC' } }),
    itemDefaults({ id: 'ex-contact-4', type: 'contact', areaId: 'area-freelance', contactGroupId: 'cg-clientes',
      title: 'João Silva — Cliente Demo', contactInfo: { email: 'joao@clientedemo.pt', phone: '+351 922 222 222', company: 'Cliente Demo Lda' } }),
    itemDefaults({ id: 'ex-check-1', type: 'checklist', areaId: 'area-work', projectId: 'proj-siemens-1',
      title: 'Checklist entrega painel X', tags: ['cablagem'],
      checklistItems: [
        { text: 'Validar BOM', done: false }, { text: 'Testar cablagem', done: false },
        { text: 'Documentação final', done: true }, { text: 'Etiquetas equipamento', done: false },
      ] }),
    itemDefaults({ id: 'ex-decision-1', type: 'decision', areaId: 'area-work', projectId: 'proj-siemens-1',
      title: 'Usar cabo X no quadro Y', body: 'Decidido na reunião de hoje. Aprovado pelo responsável técnico.', tags: ['decisão', 'cablagem'] }),
    itemDefaults({ id: 'ex-doc-1', type: 'document', areaId: 'area-work', projectId: 'proj-siemens-1',
      title: 'Esquema unifilar — Quadro X', body: 'Referência: DWG-2026-0142. Última revisão: v3.', tags: ['diagrama'], url: 'file://esquema-quadro-x.pdf' }),
    itemDefaults({ id: 'ex-task-done', type: 'task', areaId: 'area-work', projectId: 'proj-siemens-2',
      title: 'Inspeção visual quadro Y', completed: true, kanbanStatus: 'Done', dueDate: yesterday, hoursLogged: 2 }),

    // ── CANDEIAS.DEV / FREELANCE ──
    itemDefaults({ id: 'ex-task-k1', type: 'task', areaId: 'area-freelance', projectId: 'proj-freelance-1',
      title: 'Implementar homepage', body: 'Layout responsivo + hero section', tags: ['dev'],
      duration: 240, dueDate: tomorrow, kanbanStatus: 'In progress', hoursLogged: 6, priority: 'high' }),
    itemDefaults({ id: 'ex-task-k2', type: 'task', areaId: 'area-freelance', projectId: 'proj-freelance-1',
      title: 'Configurar formulário contacto', tags: ['dev'], kanbanStatus: 'To do', dueDate: nextWeek }),
    itemDefaults({ id: 'ex-task-k3', type: 'task', areaId: 'area-freelance', projectId: 'proj-freelance-1',
      title: 'Deploy produção', tags: ['deploy'], kanbanStatus: 'To do', dueDate: nextWeek }),
    itemDefaults({ id: 'ex-task-k4', type: 'task', areaId: 'area-freelance', projectId: 'proj-freelance-1',
      title: 'Revisão com cliente', kanbanStatus: 'Today', dueDate: today, duration: 60 }),
    itemDefaults({ id: 'ex-task-k5', type: 'task', areaId: 'area-freelance', projectId: 'proj-freelance-2',
      title: 'Preparar orçamento WordPress', tags: ['cliente'], kanbanStatus: 'In progress', dueDate: tomorrow }),
    itemDefaults({ id: 'ex-reminder-1', type: 'reminder', areaId: 'area-freelance', projectId: 'proj-freelance-1',
      title: 'Ligar ao João (Cliente Demo)', startDate: `${today}T15:00`, duration: 15, tags: ['cliente'] }),
    itemDefaults({ id: 'ex-link-1', type: 'link', areaId: 'area-freelance', projectId: 'proj-freelance-1',
      title: 'Portfolio candeias.dev', url: 'https://candeias.dev', tags: ['dev'], pinned: true }),
    itemDefaults({ id: 'ex-link-2', type: 'link', areaId: 'area-freelance',
      title: 'Figma — mockup Cliente Demo', url: 'https://figma.com/demo', tags: ['dev'] }),
    itemDefaults({ id: 'ex-note-freelance', type: 'note', areaId: 'area-freelance', projectId: 'proj-freelance-2',
      title: 'Brief Restaurante Silva', tags: ['cliente'],
      body: 'Objetivos:\n- Website com menu digital\n- Reservas online\n\nPáginas: Home, Menu, Sobre, Contactos\n\nOrçamento: ~800€\nPrazo: 6 semanas' }),

    // ── PESSOAL — todos sub-contextos ──
    itemDefaults({ id: 'ex-gf-1', type: 'task', areaId: 'area-personal', subContextId: 'ctx-gf',
      title: 'Reservar jantar romântico', body: 'Restaurante italiano que ela gostou', dueDate: tomorrow, tags: ['namorada'] }),
    itemDefaults({ id: 'ex-gf-2', type: 'note', areaId: 'area-personal', subContextId: 'ctx-gf',
      title: 'Ideias presente aniversário', body: 'Relógio\nLivro de fotos\nJantar surpresa', tags: ['namorada', 'presente'] }),
    itemDefaults({ id: 'ex-family-1', type: 'event', areaId: 'area-personal', subContextId: 'ctx-family',
      title: 'Almoço de família', startDate: `${nextWeek}T13:00`, endDate: `${nextWeek}T16:00`, location: 'Casa dos pais', tags: ['família'] }),
    itemDefaults({ id: 'ex-family-2', type: 'task', areaId: 'area-personal', subContextId: 'ctx-family',
      title: 'Comprar prenda mãe', dueDate: Utils.addDays(today, 14), tags: ['família', 'presente'] }),
    itemDefaults({ id: 'ex-concert-1', type: 'event', areaId: 'area-personal', subContextId: 'ctx-concerts',
      title: 'Concerto — Artist Demo', tags: ['concerto'],
      startDate: `${tomorrow}T21:00`, endDate: `${tomorrow}T23:30`, duration: 150, location: 'Altice Arena' }),
    itemDefaults({ id: 'ex-concert-2', type: 'checklist', areaId: 'area-personal', subContextId: 'ctx-concerts',
      title: 'Pack concerto', tags: ['concerto'],
      checklistItems: [{ text: 'Bilhetes', done: true }, { text: 'Transporte', done: false }, { text: 'Jantar antes', done: false }] }),
    itemDefaults({ id: 'ex-travel-1', type: 'note', areaId: 'area-personal', subContextId: 'ctx-travel',
      title: 'Viagem Porto — verão', body: 'Hotel: TBD\nTransporte: comboio\nDias: 15-17 Agosto', tags: ['viagem'] }),
    itemDefaults({ id: 'ex-home-1', type: 'task', areaId: 'area-personal', subContextId: 'ctx-home',
      title: 'Pagar conta luz', dueDate: Utils.addDays(today, 3), tags: ['casa'] }),
    itemDefaults({ id: 'ex-home-2', type: 'task', areaId: 'area-personal', subContextId: 'ctx-home',
      title: 'Compras supermercado', dueDate: today, tags: ['casa', 'compras'] }),
    itemDefaults({ id: 'ex-health-1', type: 'event', areaId: 'area-personal', subContextId: 'ctx-health',
      title: 'Consulta médica', startDate: `${Utils.addDays(today, 10)}T09:30`, endDate: `${Utils.addDays(today, 10)}T10:00`, location: 'Centro Saúde', tags: ['saúde'] }),
    itemDefaults({ id: 'ex-car-1', type: 'reminder', areaId: 'area-personal', subContextId: 'ctx-car',
      title: 'Renovar inspeção carro', startDate: `${Utils.addDays(today, 30)}T09:00`, tags: ['carro'] }),

    // ── FACULDADE ──
    itemDefaults({ id: 'ex-uni-1', type: 'task', areaId: 'area-uni', projectId: 'proj-uni-1',
      title: 'Entregar projeto BD', dueDate: Utils.addDays(today, 21), priority: 'high', tags: ['faculdade'], duration: 480 }),
    itemDefaults({ id: 'ex-uni-2', type: 'event', areaId: 'area-uni', projectId: 'proj-uni-1',
      title: 'Apresentação projeto BD', startDate: `${Utils.addDays(today, 21)}T14:00`, endDate: `${Utils.addDays(today, 21)}T15:30`, location: 'Sala B2', tags: ['faculdade'] }),
    itemDefaults({ id: 'ex-uni-3', type: 'note', areaId: 'area-uni', projectId: 'proj-uni-1',
      title: 'Notas aula BD', body: 'Normalização 3FN\nÍndices B-tree\nQueries JOIN', tags: ['faculdade'] }),

    // ── INBOX & IDEIAS ──
    itemDefaults({ id: 'ex-inbox-1', type: 'idea', title: 'Ideia — ligar app finanças à Candeias',
      body: 'Sincronizar categorias de gastos com tags', inbox: true, tags: ['ideia'] }),
    itemDefaults({ id: 'ex-inbox-2', type: 'note', title: 'Ligar ao electricista', body: 'Pedir orçamento tomada extra', inbox: true }),
    itemDefaults({ id: 'ex-inbox-snooze', type: 'task', title: 'Verificar email cliente Silva', inbox: true, snoozedUntil: tomorrow }),

    // ── ARQUIVO ──
    itemDefaults({ id: 'ex-archived-1', type: 'task', areaId: 'area-freelance', projectId: 'proj-archived',
      title: 'Entrega landing page 2025', completed: true, archived: true, kanbanStatus: 'Done' }),
  ];

  return { clients, projects, subscriptions, vaultEntries, items, today };
}

function defaultState() {
  return {
    version: 3,
    cloudUpdatedAt: null,
    areas: structuredClone(DEFAULT_AREAS),
    clients: [],
    projects: [],
    subscriptions: [],
    items: [],
    vaultEntries: [],
    vaultUnlocked: false,
    settings: {
      theme: 'dark',
      fullDemoLoaded: false,
      lastQuickCapture: { areaId: 'area-work', projectId: null, subContextId: null },
      focusProjectId: null,
      vaultAutoLockMinutes: 5,
      recentItems: [],
      savedSearches: [],
      inboxStreak: 0,
      lastWeeklyReview: null,
      dashboardWidgets: ['banners', 'stats', 'pinned', 'recent', 'dev', 'overdue', 'review'],
      fincontrolUrl: FINCONTROL_DEFAULT_URL,
      schoolSchedule: SchoolSchedule.defaultSchedule(),
      accessibility: { ...DEFAULT_ACCESSIBILITY },
      openaiApiKey: '',
      openaiModel: 'gpt-4o-mini',
      useAiParser: true,
      pomodoro: { running: false, phase: 'work', endsAt: null, sessions: 0 },
      activeTimer: null,
      contactGroups: defaultContactGroups(),
      vaultFolders: defaultVaultFolders(),
      quickTags: [...QUICK_TAGS],
      kanbanColumns: defaultKanbanColumns(),
      pipelineStages: defaultPipelineStages(),
      workStatuses: defaultWorkStatuses(),
      clientStatuses: defaultClientStatuses(),
      priorities: defaultPriorities(),
      paymentStatuses: defaultPaymentStatuses(),
      workspaces: defaultWorkspaces(),
      linkCategories: defaultLinkCategories(),
      subscriptionCategories: defaultSubscriptionCategories(),
      emailAccounts: defaultEmailAccounts(),
      googleClientId: '',
      firebaseConfig: null,
      cloudEmail: '',
      lastCloudSync: null,
      disciplines: defaultDisciplines(),
      customTemplates: [],
      areaFiltersCollapsed: false,
    },
    grades: [],
  };
}

function demoState() {
  const demo = buildDemoData();
  return {
    version: 3,
    cloudUpdatedAt: null,
    areas: structuredClone(DEFAULT_AREAS),
    clients: demo.clients,
    projects: demo.projects,
    subscriptions: demo.subscriptions,
    items: demo.items,
    vaultEntries: demo.vaultEntries,
    vaultUnlocked: false,
    settings: {
      theme: 'dark',
      fullDemoLoaded: true,
      lastQuickCapture: { areaId: 'area-work', projectId: 'proj-siemens-1', subContextId: null },
      focusProjectId: null,
      vaultAutoLockMinutes: 5,
      recentItems: ['ex-task-1', 'ex-event-1', 'ex-task-k1', 'ex-gf-1', 'ex-link-1'],
      savedSearches: [
        { id: 'ss-1', name: 'Tasks urgentes Siemens', filter: { tag: 'urgente', areaId: 'area-work' } },
        { id: 'ss-2', name: 'Dev candeias.dev', filter: { tag: 'dev', areaId: 'area-freelance' } },
      ],
      inboxStreak: 2,
      lastWeeklyReview: null,
      dashboardWidgets: ['banners', 'stats', 'pinned', 'recent', 'dev', 'overdue', 'review'],
      fincontrolUrl: FINCONTROL_DEFAULT_URL,
      schoolSchedule: SchoolSchedule.defaultSchedule(),
      accessibility: { ...DEFAULT_ACCESSIBILITY },
      openaiApiKey: '',
      openaiModel: 'gpt-4o-mini',
      useAiParser: true,
      pomodoro: { running: false, phase: 'work', endsAt: null, sessions: 0 },
      activeTimer: null,
      contactGroups: defaultContactGroups(),
      vaultFolders: defaultVaultFolders(),
      quickTags: [...QUICK_TAGS],
      kanbanColumns: defaultKanbanColumns(),
      pipelineStages: defaultPipelineStages(),
      workStatuses: defaultWorkStatuses(),
      clientStatuses: defaultClientStatuses(),
      priorities: defaultPriorities(),
      paymentStatuses: defaultPaymentStatuses(),
      workspaces: defaultWorkspaces(),
      linkCategories: defaultLinkCategories(),
      subscriptionCategories: defaultSubscriptionCategories(),
      emailAccounts: defaultEmailAccounts(),
      googleClientId: '',
      firebaseConfig: null,
      cloudEmail: '',
      lastCloudSync: null,
      disciplines: defaultDisciplines(),
      customTemplates: [],
      areaFiltersCollapsed: false,
    },
    grades: [
      { id: 'gr-1', subject: 'Circuitos Eléctricos', weight: 30, grade: 16, semester: '2025/26' },
      { id: 'gr-2', subject: 'Máquinas Eléctricas', weight: 30, grade: 14, semester: '2025/26' },
      { id: 'gr-3', subject: 'Electrotecnia', weight: 40, grade: 15, semester: '2025/26' },
    ],
  };
}
