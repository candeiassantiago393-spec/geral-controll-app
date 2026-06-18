const STORAGE_KEY = 'candeias_app_v3';
const _metaVersion = document.querySelector('meta[name="app-version"]')?.content?.trim();
const APP_VERSION = (_metaVersion && !_metaVersion.includes('__CANDEIAS')) ? _metaVersion : '3.5.1';

const ITEM_TYPES = {
  note: { label: 'Note', icon: '📝' },
  task: { label: 'Task', icon: '✓' },
  event: { label: 'Event', icon: '📅' },
  reminder: { label: 'Reminder', icon: '⏰' },
  contact: { label: 'Contact', icon: '👤' },
  link: { label: 'Link', icon: '🔗' },
  checklist: { label: 'Checklist', icon: '☑' },
  decision: { label: 'Decision', icon: '⚖' },
  idea: { label: 'Idea', icon: '💡' },
  document: { label: 'Document', icon: '📄' },
};

const PIPELINE_STAGES = [
  'Lead', 'Quote', 'Proposal', 'Contract', 'In development',
  'Testing', 'Client review', 'Delivered', 'Maintenance',
];

const PAYMENT_STATUSES = ['To invoice', 'Invoiced', 'Paid', 'Partial'];

const CLIENT_STATUSES = ['Lead', 'Active', 'Inactive', 'Maintenance'];

const FINCONTROL_DEFAULT_URL = 'http://localhost:5173';

const WORKSPACES = {
  work: { label: 'Work', icon: '⚡', areaIds: ['area-work', 'area-freelance'] },
  school: { label: 'School', icon: '📚', areaIds: ['area-uni'] },
  personal: { label: 'Personal', icon: '✦', areaIds: ['area-personal'] },
};

function defaultContactGroups() {
  return [
    { id: 'cg-work', name: 'Work', icon: '⚡', color: '#00d26a' },
    { id: 'cg-faculdade', name: 'University', icon: '📚', color: '#10b981' },
    { id: 'cg-clientes', name: 'Clients', icon: '🤝', color: '#00ff88' },
    { id: 'cg-fornecedores', name: 'Suppliers', icon: '🏭', color: '#ffa502' },
    { id: 'cg-pessoal', name: 'Personal', icon: '✦', color: '#34d399' },
  ];
}

function defaultVaultFolders() {
  return [
    { id: 'vf-work', name: 'Work', icon: '⚡', color: '#00d26a' },
    { id: 'vf-clientes', name: 'Clients', icon: '🤝', color: '#00ff88' },
    { id: 'vf-hosting', name: 'Hosting', icon: '🌐', color: '#34d399' },
    { id: 'vf-faculdade', name: 'University', icon: '📚', color: '#10b981' },
    { id: 'vf-pessoal', name: 'Personal', icon: '✦', color: '#a78bfa' },
    { id: 'vf-redes', name: 'Social media', icon: '📱', color: '#f472b6' },
    { id: 'vf-api', name: 'API Keys', icon: '🔑', color: '#ffa502' },
  ];
}

/** @deprecated use Store.getVaultFolders() */
const VAULT_FOLDERS = defaultVaultFolders().map((f) => f.name);

const SCHOOL_WEEKDAYS = [
  { id: 0, label: 'Monday', short: 'Mon' },
  { id: 1, label: 'Tuesday', short: 'Tue' },
  { id: 2, label: 'Wednesday', short: 'Wed' },
  { id: 3, label: 'Thursday', short: 'Thu' },
  { id: 4, label: 'Friday', short: 'Fri' },
];

const DEFAULT_ACCESSIBILITY = {
  largerText: false,
  highContrast: false,
  reduceMotion: false,
  focusIndicators: false,
  readableFont: false,
  boldLabels: false,
  keyboardHints: false,
  simplifiedUI: false,
  underlineLinks: false,
};

const ACCESSIBILITY_OPTIONS = [
  { key: 'largerText', label: 'Larger text', desc: 'Increases font size across the app.' },
  { key: 'highContrast', label: 'High contrast', desc: 'Makes borders and text more visible.' },
  { key: 'reduceMotion', label: 'Reduce animations', desc: 'Turns off transitions and visual effects.' },
  { key: 'focusIndicators', label: 'Focus indicators', desc: 'Clear highlight when navigating with the keyboard.' },
  { key: 'readableFont', label: 'Readable font', desc: 'More spacing between letters and lines.' },
  { key: 'boldLabels', label: 'Bold labels', desc: 'Thicker titles and form labels.' },
  { key: 'keyboardHints', label: 'Keyboard hints', desc: 'Shows useful shortcuts in the top bar.' },
  { key: 'simplifiedUI', label: 'Simplified interface', desc: 'Fewer glows and decorative effects.' },
  { key: 'underlineLinks', label: 'Underline links', desc: 'Links always underlined for easy identification.' },
];

const PROJECT_STAGES = [
  'Planning', 'Assembly', 'Wiring', 'Commissioning', 'Testing', 'Delivery',
];

const KANBAN_COLUMNS = ['To do', 'Today', 'In progress', 'Blocked', 'Done'];

const WORK_STATUSES = ['In progress', 'Waiting', 'Blocked', 'Completed'];

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const MEETING_TEMPLATE = `Participantes:
-
Data próxima reunião:

Decisões:
-

Action items:
- [ ]
- [ ]

Notas:
`;

const QUICK_TAGS = [
  'urgente', 'reunião', 'BOM', 'dev', 'cliente', 'concerto', 'família',
  'namorada', 'ideia', 'bloqueado', 'espera-resposta', 'PLC', 'cablagem',
];

const DEFAULT_AREAS = [
  { id: 'area-work', name: 'Work', icon: '⚡', color: '#00d26a', subContexts: [] },
  { id: 'area-freelance', name: 'Projects', icon: '💻', color: '#00ff88', subContexts: [] },
  {
    id: 'area-personal',
    name: 'Personal',
    icon: '✦',
    color: '#34d399',
    subContexts: [
      { id: 'ctx-gf', name: 'Partner', icon: '♥' },
      { id: 'ctx-family', name: 'Family', icon: '👨‍👩‍👧' },
      { id: 'ctx-concerts', name: 'Concerts', icon: '🎵' },
      { id: 'ctx-travel', name: 'Travel', icon: '✈' },
      { id: 'ctx-home', name: 'Home', icon: '🏠' },
      { id: 'ctx-health', name: 'Health', icon: '🩺' },
      { id: 'ctx-car', name: 'Car', icon: '🚗' },
    ],
  },
  { id: 'area-uni', name: 'University', icon: '📚', color: '#10b981', subContexts: [] },
];

function defaultProjectStages() {
  return [...PROJECT_STAGES];
}

function defaultKanbanColumns() {
  return [...KANBAN_COLUMNS];
}

function defaultPipelineStages() {
  return [...PIPELINE_STAGES];
}

function defaultWorkStatuses() {
  return [...WORK_STATUSES];
}

function defaultClientStatuses() {
  return [...CLIENT_STATUSES];
}

function defaultPriorities() {
  return [...PRIORITIES];
}

function defaultPaymentStatuses() {
  return [...PAYMENT_STATUSES];
}

function defaultWorkspaces() {
  return structuredClone(WORKSPACES);
}

function defaultLinkCategories() {
  return [
    { id: 'lc-dev', name: 'Dev', icon: '💻', color: '#00ff88' },
    { id: 'lc-tools', name: 'Tools', icon: '🔧', color: '#34d399' },
    { id: 'lc-docs', name: 'Docs', icon: '📄', color: '#10b981' },
    { id: 'lc-ref', name: 'Reference', icon: '📚', color: '#00d26a' },
    { id: 'lc-personal', name: 'Personal', icon: '✦', color: '#a78bfa' },
  ];
}

function defaultSubscriptionCategories() {
  return ['Personal', 'Work', 'Dev', 'Streaming', 'Cloud'];
}

function defaultEmailAccounts() {
  return [
    { id: 'ea-work', name: 'Work', email: 'you@siemens.com', icon: '⚡', color: '#00d26a', provider: 'gmail', gmailAuthIndex: 0 },
    { id: 'ea-school', name: 'School', email: 'you@university.edu', icon: '📚', color: '#10b981', provider: 'gmail', gmailAuthIndex: 1 },
    { id: 'ea-personal', name: 'Personal', email: 'you@gmail.com', icon: '✦', color: '#34d399', provider: 'gmail', gmailAuthIndex: 2 },
    { id: 'ea-freelance', name: 'candeias.dev', email: 'hello@candeias.dev', icon: '💻', color: '#00ff88', provider: 'gmail', gmailAuthIndex: 3 },
  ];
}

function defaultDisciplines() {
  return [
    { id: 'disc-ce', name: 'Circuitos Eléctricos', defaultWeight: 30 },
    { id: 'disc-me', name: 'Máquinas Eléctricas', defaultWeight: 30 },
    { id: 'disc-et', name: 'Electrotecnia', defaultWeight: 40 },
  ];
}

const DASHBOARD_WIDGETS = [
  { key: 'banners', label: 'Alerts', desc: 'Overdue, inbox, and demo banners' },
  { key: 'stats', label: 'Statistics', desc: 'Counter grid' },
  { key: 'pinned', label: 'Pinned', desc: 'Pinned items' },
  { key: 'recent', label: 'Recent', desc: 'Recent activity' },
  { key: 'dev', label: 'In dev', desc: 'candeias.dev projects in development' },
  { key: 'overdue', label: 'Overdue', desc: 'Overdue tasks' },
  { key: 'review', label: 'Review', desc: 'Weekly review summary' },
];

const BUILTIN_TEMPLATES = [
  { key: 'meeting', name: 'Meeting notes', icon: '📋' },
  { key: 'checklist-delivery', name: 'Panel delivery checklist', icon: '☑' },
  { key: 'client-brief', name: 'Website brief', icon: '💻' },
  { key: 'concert', name: 'Concert pack', icon: '🎵' },
  { key: 'field-sheet', name: 'Field sheet', icon: '📋' },
];
