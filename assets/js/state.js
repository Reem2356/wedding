/* =========================================================
   state.js
   - إدارة الحالة (State) في الذاكرة + الحفظ التلقائي
   - كل عمليات الإضافة/التعديل/الحذف (CRUD) تمر من هنا
   ========================================================= */

const STATUS_LABELS = {
  not_started: 'لم تبدأ',
  in_progress: 'قيد التنفيذ',
  booked: 'تم الحجز',
  partial_paid: 'تم الدفع جزئيًا',
  completed: 'مكتملة'
};

const STATUS_ORDER = ['not_started', 'in_progress', 'booked', 'partial_paid', 'completed'];

const AppState = {
  data: null,
  store: LocalStorageAdapter,
  isShared: false,
  syncMode: 'local', // 'claude' | 'firebase' | 'local'

  async load() {
    let sharedStore = await createSharedDbAdapter();
    this.syncMode = sharedStore ? 'claude' : null;
    if (!sharedStore) {
      sharedStore = await createFirebaseAdapter();
      if (sharedStore) this.syncMode = 'firebase';
    }
    if (!sharedStore) this.syncMode = 'local';

    this.isShared = !!sharedStore;
    this.store = sharedStore || LocalStorageAdapter;

    const saved = await this.store.getAll();
    if (saved && saved.tasks) {
      this.data = migrateData(saved);
    } else {
      this.data = getDefaultData();
      await this.store.setAll(this.data);
    }
    await LocalStorageAdapter.setAll(this.data);

    if (this.isShared && this.store.subscribe) {
      this.store.subscribe((remote) => {
        this.data = migrateData(remote);
        LocalStorageAdapter.setAll(this.data);
        window.dispatchEvent(new CustomEvent('state:changed'));
      });
    }
    window.dispatchEvent(new CustomEvent('state:changed'));
  },

  async save() {
    LocalStorageAdapter.setAll(this.data);
    try {
      await this.store.setAll(this.data);
    } catch (e) {
      console.error('تعذر حفظ التعديل في النسخة المشتركة', e);
      if (typeof showToast === 'function') {
        showToast('⚠️ لم يتم حفظ آخر تعديل بشكل مشترك، تحققي من اتصالك');
      }
    }
    window.dispatchEvent(new CustomEvent('state:changed'));
  },

  /* ---------------- Settings ---------------- */
  async updateSettings(patch) {
    Object.assign(this.data.settings, patch);
    await this.save();
  },

  /* ---------------- Tasks CRUD ---------------- */
  getTask(id) {
    return this.data.tasks.find(t => t.id === id);
  },
  getTasksBySection(sectionId) {
    return this.data.tasks.filter(t => t.sectionId === sectionId);
  },
  async addTask(task) {
    const now = new Date().toISOString();
    const newTask = {
      id: genId('task'),
      sectionId: task.sectionId || this.data.sections[0].id,
      title: task.title || 'مهمة جديدة',
      assignee: task.assignee || '',
      phone: task.phone || '',
      vendor: task.vendor || '',
      date: task.date || '',
      budgetExpected: Number(task.budgetExpected) || 0,
      actualAmount: Number(task.actualAmount) || 0,
      paidAmount: Number(task.paidAmount) || 0,
      notes: task.notes || '',
      status: task.status || 'not_started',
      createdAt: now,
      updatedAt: now
    };
    this.data.tasks.push(newTask);
    await this.save();
    return newTask;
  },
  async updateTask(id, patch) {
    const task = this.getTask(id);
    if (!task) return;
    Object.assign(task, patch, { updatedAt: new Date().toISOString() });
    ['budgetExpected', 'actualAmount', 'paidAmount'].forEach(k => {
      task[k] = Number(task[k]) || 0;
    });
    await this.save();
    return task;
  },
  async deleteTask(id) {
    this.data.tasks = this.data.tasks.filter(t => t.id !== id);
    await this.save();
  },
  async toggleComplete(id) {
    const task = this.getTask(id);
    if (!task) return;
    task.status = task.status === 'completed' ? 'in_progress' : 'completed';
    task.updatedAt = new Date().toISOString();
    await this.save();
  },

  /* ---------------- People ---------------- */
  async addPerson(name) {
    name = (name || '').trim();
    if (!name || this.data.people.includes(name)) return;
    this.data.people.push(name);
    await this.save();
  },
  async deletePerson(name) {
    this.data.people = this.data.people.filter(p => p !== name);
    await this.save();
  },

  /* ---------------- Timeline ---------------- */
  async addTimelineItem(item) {
    this.data.timeline.push({ id: genId('tl'), time: item.time || '00:00', title: item.title || '' });
    await this.save();
  },
  async updateTimelineItem(id, patch) {
    const item = this.data.timeline.find(t => t.id === id);
    if (!item) return;
    Object.assign(item, patch);
    await this.save();
  },
  async deleteTimelineItem(id) {
    this.data.timeline = this.data.timeline.filter(t => t.id !== id);
    await this.save();
  },

  /* ---------------- Emergency Kit ---------------- */
  async addKitItem(name) {
    name = (name || '').trim();
    if (!name) return;
    this.data.emergencyKit.push({ id: genId('kit'), name, checked: false });
    await this.save();
  },
  async toggleKitItem(id) {
    const item = this.data.emergencyKit.find(k => k.id === id);
    if (!item) return;
    item.checked = !item.checked;
    await this.save();
  },
  async deleteKitItem(id) {
    this.data.emergencyKit = this.data.emergencyKit.filter(k => k.id !== id);
    await this.save();
  },

  /* ---------------- Import / Export / Reset ---------------- */
  async importData(obj) {
    this.data = migrateData(obj);
    await this.save();
  },
  async resetAll() {
    this.data = getDefaultData();
    await this.save();
  },

  /* ---------------- Computed / Stats ---------------- */
  taskAmount(task) {
    return task.actualAmount > 0 ? task.actualAmount : task.budgetExpected;
  },
  taskRemaining(task) {
    return Math.max(this.taskAmount(task) - (task.paidAmount || 0), 0);
  },
  stats() {
    const tasks = this.data.tasks;
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const remainingTasks = total - completed;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;

    const totalExpenses = tasks.reduce((s, t) => s + this.taskAmount(t), 0);
    const totalPaid = tasks.reduce((s, t) => s + (Number(t.paidAmount) || 0), 0);
    const totalRemaining = Math.max(totalExpenses - totalPaid, 0);
    const totalBudget = Number(this.data.settings.totalBudget) || 0;
    const budgetUsagePct = totalBudget ? Math.min(Math.round((totalExpenses / totalBudget) * 100), 999) : 0;

    return {
      total, completed, remainingTasks, completionRate,
      totalExpenses, totalPaid, totalRemaining, totalBudget, budgetUsagePct
    };
  },
  personStats(name) {
    const tasks = this.data.tasks.filter(t => t.assignee === name);
    const completed = tasks.filter(t => t.status === 'completed').length;
    return { total: tasks.length, completed, remaining: tasks.length - completed };
  },
  isOverdue(task) {
    if (!task.date || task.status === 'completed') return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(task.date) < today;
  },
  isDueSoon(task, days = 7) {
    if (!task.date || task.status === 'completed') return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(task.date);
    const diff = (target - today) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= days;
  },
  urgentTasks() {
    return this.data.tasks.filter(t => {
      if (t.status === 'completed') return false;
      const overdue = this.isOverdue(t);
      const dueSoon = this.isDueSoon(t, 7);
      const unpaid = this.taskRemaining(t) > 0 && (t.actualAmount > 0 || t.budgetExpected > 0);
      const notStartedImportant = t.status === 'not_started' && t.date;
      return overdue || dueSoon || unpaid || notStartedImportant;
    }).sort((a, b) => {
      const ao = this.isOverdue(a) ? 0 : 1;
      const bo = this.isOverdue(b) ? 0 : 1;
      return ao - bo;
    });
  }
};

function migrateData(obj) {
  const def = getDefaultData();
  return {
    settings: { ...def.settings, ...(obj.settings || {}) },
    sections: obj.sections && obj.sections.length ? obj.sections : def.sections,
    tasks: Array.isArray(obj.tasks) ? obj.tasks : def.tasks,
    people: Array.isArray(obj.people) ? obj.people : def.people,
    timeline: Array.isArray(obj.timeline) ? obj.timeline : def.timeline,
    emergencyKit: Array.isArray(obj.emergencyKit) ? obj.emergencyKit : def.emergencyKit
  };
}
