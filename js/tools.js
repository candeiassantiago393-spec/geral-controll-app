const EngCalc = {
  awgToMm2(awg) {
    const table = { 10: 5.26, 12: 3.31, 14: 2.08, 16: 1.31, 18: 0.823, 20: 0.519, 22: 0.326, 24: 0.205 };
    return table[awg] ?? null;
  },

  voltageDrop(current, resistancePerKm, lengthM) {
    return (2 * current * resistancePerKm * (lengthM / 1000)).toFixed(2);
  },

  kwToCv(kw) {
    return (kw * 1.35962).toFixed(2);
  },

  cvToKw(cv) {
    return (cv / 1.35962).toFixed(2);
  },

  powerFactor(apparentKva, activeKw) {
    if (!apparentKva) return '—';
    return (activeKw / apparentKva).toFixed(3);
  },
};

const Pomodoro = {
  WORK_SEC: 25 * 60,
  BREAK_SEC: 5 * 60,

  state() {
    return Store.state.settings.pomodoro || { running: false, phase: 'work', endsAt: null, sessions: 0 };
  },

  save(s) {
    Store.state.settings.pomodoro = s;
    Store.save();
  },

  start(phase = 'work') {
    const sec = phase === 'work' ? this.WORK_SEC : this.BREAK_SEC;
    this.save({ running: true, phase, endsAt: Date.now() + sec * 1000, sessions: this.state().sessions });
  },

  stop() {
    const s = this.state();
    this.save({ ...s, running: false, endsAt: null });
  },

  tick() {
    const s = this.state();
    if (!s.running || !s.endsAt) return s;
    if (Date.now() >= s.endsAt) {
      if (s.phase === 'work') {
        this.save({ running: true, phase: 'break', endsAt: Date.now() + this.BREAK_SEC * 1000, sessions: s.sessions + 1 });
      } else {
        this.save({ running: false, phase: 'work', endsAt: null, sessions: s.sessions });
      }
    }
    return this.state();
  },

  remainingSec() {
    const s = this.state();
    if (!s.running || !s.endsAt) return 0;
    return Math.max(0, Math.ceil((s.endsAt - Date.now()) / 1000));
  },

  fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },
};

const Grades = {
  weightedAverage(grades) {
    if (!grades.length) return 0;
    let sum = 0;
    let w = 0;
    for (const g of grades) {
      const weight = parseFloat(g.weight) || 1;
      const grade = parseFloat(g.grade);
      if (isNaN(grade)) continue;
      sum += grade * weight;
      w += weight;
    }
    return w ? (sum / w).toFixed(2) : '—';
  },
};
