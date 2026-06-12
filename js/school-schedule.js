const SchoolSchedule = {
  defaultSchedule() {
    return {
      enabled: true,
      showInCalendar: true,
      days: {
        0: [
          { id: 's1', subject: 'Matemática', room: 'B204', startTime: '09:00', endTime: '10:30' },
          { id: 's2', subject: 'Programação', room: 'Lab 3', startTime: '11:00', endTime: '12:30' },
          { id: 's3', subject: 'Física', room: 'A101', startTime: '14:00', endTime: '15:30' },
        ],
        1: [
          { id: 's4', subject: 'Electrotecnia', room: 'C302', startTime: '09:00', endTime: '10:30' },
          { id: 's5', subject: 'Autómata', room: 'Lab 1', startTime: '11:00', endTime: '12:30' },
        ],
        2: [
          { id: 's6', subject: 'Matemática', room: 'B204', startTime: '09:00', endTime: '10:30' },
          { id: 's7', subject: 'Projecto', room: 'Lab 2', startTime: '14:00', endTime: '17:00' },
        ],
        3: [
          { id: 's8', subject: 'Programação', room: 'Lab 3', startTime: '09:00', endTime: '12:30' },
          { id: 's9', subject: 'Inglês', room: 'D105', startTime: '14:00', endTime: '15:30' },
        ],
        4: [
          { id: 's10', subject: 'Física', room: 'A101', startTime: '09:00', endTime: '10:30' },
          { id: 's11', subject: 'Seminário', room: 'Auditório', startTime: '11:00', endTime: '12:30' },
        ],
      },
    };
  },

  weekdayIndex(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return (d.getDay() + 6) % 7;
  },

  isWeekday(dateStr) {
    return this.weekdayIndex(dateStr) < 5;
  },

  getSlotsForDay(schedule, dayIndex) {
    if (!schedule?.days) return [];
    return (schedule.days[dayIndex] || []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
  },

  slotToItem(slot, dateStr) {
    return {
      id: `school-${dateStr}-${slot.id}`,
      type: 'event',
      isSchoolSchedule: true,
      areaId: 'area-uni',
      title: slot.subject,
      location: slot.room,
      startDate: `${dateStr}T${slot.startTime}`,
      endDate: `${dateStr}T${slot.endTime}`,
      body: slot.room ? `Sala ${slot.room}` : '',
    };
  },

  getForDate(dateStr, schedule = Store.state.settings.schoolSchedule) {
    if (!schedule?.enabled) return [];
    const dayIndex = this.weekdayIndex(dateStr);
    if (dayIndex > 4) return [];
    return this.getSlotsForDay(schedule, dayIndex).map((slot) => this.slotToItem(slot, dateStr));
  },

  getAllTimeRows(schedule) {
    const times = new Set();
    for (let d = 0; d < 5; d++) {
      this.getSlotsForDay(schedule, d).forEach((s) => {
        times.add(s.startTime);
        times.add(s.endTime);
      });
    }
    return [...times].sort();
  },

  normalizeFromForm(daysData) {
    const days = {};
    for (let d = 0; d < 5; d++) {
      days[d] = (daysData[d] || [])
        .filter((s) => s.subject?.trim())
        .map((s, i) => ({
          id: s.id || `slot-${d}-${i}-${Date.now()}`,
          subject: s.subject.trim(),
          room: (s.room || '').trim(),
          startTime: s.startTime || '09:00',
          endTime: s.endTime || '10:00',
        }));
    }
    return days;
  },
};
