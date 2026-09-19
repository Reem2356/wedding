/* =========================================================
   render.js — كل دوال العرض/الرسم على الشاشة
   ========================================================= */

function fmtMoney(n) {
  n = Number(n) || 0;
  return n.toLocaleString('en-US') + ' ر.س';
}
function fmtMoneyPlain(n) {
  return (Number(n) || 0).toLocaleString('en-US');
}
function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' });
}
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
function sectionOf(id) {
  return AppState.data.sections.find(s => s.id === id) || { icon: '📌', name: 'أخرى' };
}

function dateBadgeClass(task) {
  if (AppState.isOverdue(task)) return 'overdue';
  if (AppState.isDueSoon(task, 7)) return 'due-soon';
  return '';
}

/* ---------------- Home Tab ---------------- */
function renderHome() {
  const s = AppState.stats();
  document.getElementById('statTotal').textContent = s.total;
  document.getElementById('statCompleted').textContent = s.completed;
  document.getElementById('statRemaining').textContent = s.remainingTasks;
  document.getElementById('statBudget').textContent = fmtMoneyPlain(s.totalBudget);
  document.getElementById('statPaid').textContent = fmtMoneyPlain(s.totalPaid);
  document.getElementById('statLeft').textContent = fmtMoneyPlain(s.totalRemaining);

  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (s.completionRate / 100) * circumference;
  const fg = document.getElementById('progressCircleFg');
  fg.style.strokeDasharray = circumference;
  fg.style.strokeDashoffset = offset;
  document.getElementById('progressPct').textContent = s.completionRate + '%';
  document.getElementById('progressLinearPct').textContent = s.completionRate + '%';
  document.getElementById('progressLinearFill').style.width = s.completionRate + '%';

  renderUrgent();
}

function renderUrgent() {
  const list = AppState.urgentTasks().slice(0, 8);
  const box = document.getElementById('urgentList');
  if (!list.length) {
    box.innerHTML = '<div class="empty-state">لا توجد مهام تحتاج انتباه حاليًا 🌿 كل شي تمام</div>';
    return;
  }
  box.innerHTML = list.map(t => {
    const overdue = AppState.isOverdue(t);
    const dueSoon = AppState.isDueSoon(t, 7);
    const remaining = AppState.taskRemaining(t);
    let metaParts = [sectionOf(t.sectionId).icon + ' ' + sectionOf(t.sectionId).name];
    if (t.date) metaParts.push(fmtDate(t.date));
    if (remaining > 0) metaParts.push('متبقي ' + fmtMoney(remaining));
    const badgeText = overdue ? 'متأخرة' : dueSoon ? 'قريبة' : remaining > 0 ? 'غير مدفوعة' : 'لم تبدأ';
    return `
      <div class="urgent-item ${overdue ? 'overdue' : ''}" data-task-id="${t.id}">
        <div>
          <div class="urgent-item-title">${esc(t.title)}</div>
          <div class="urgent-item-meta">${esc(metaParts.join(' · '))}</div>
        </div>
        <span class="urgent-badge">${badgeText}</span>
      </div>`;
  }).join('');
  box.querySelectorAll('.urgent-item').forEach(el => {
    el.addEventListener('click', () => openTaskModal(el.dataset.taskId));
  });
}

/* ---------------- Tasks Tab ---------------- */
let currentFilter = 'all';
let currentSearch = '';
let currentAssigneeFilter = '';

function taskMatchesFilters(t) {
  if (currentSearch) {
    const hay = [t.title, t.assignee, t.vendor, t.notes].join(' ').toLowerCase();
    if (!hay.includes(currentSearch.toLowerCase())) return false;
  }
  if (currentAssigneeFilter && t.assignee !== currentAssigneeFilter) return false;
  switch (currentFilter) {
    case 'remaining': return t.status !== 'completed';
    case 'completed': return t.status === 'completed';
    case 'urgent': return AppState.urgentTasks().some(u => u.id === t.id);
    case 'unpaid': return AppState.taskRemaining(t) > 0;
    default: return true;
  }
}

function renderTasks() {
  const container = document.getElementById('sectionsList');
  container.innerHTML = '';
  AppState.data.sections.forEach(section => {
    const tasks = AppState.getTasksBySection(section.id).filter(taskMatchesFilters);
    if (!tasks.length && (currentSearch || currentFilter !== 'all' || currentAssigneeFilter)) return;

    const allTasks = AppState.getTasksBySection(section.id);
    const completedCount = allTasks.filter(t => t.status === 'completed').length;

    const card = document.createElement('div');
    card.className = 'section-card';
    card.innerHTML = `
      <div class="section-card-header">
        <span class="section-card-title">${section.icon} ${esc(section.name)}</span>
        <span class="section-card-count">${completedCount}/${allTasks.length} <span class="section-card-toggle">▾</span></span>
      </div>
      <div class="section-card-body"></div>`;
    const body = card.querySelector('.section-card-body');

    if (!tasks.length) {
      body.innerHTML = '<div class="empty-state">لا توجد مهام مطابقة</div>';
    } else {
      tasks.forEach(t => body.appendChild(buildTaskRow(t)));
    }

    card.querySelector('.section-card-header').addEventListener('click', () => {
      card.classList.toggle('collapsed');
    });
    container.appendChild(card);
  });

  if (!container.children.length) {
    container.innerHTML = '<div class="empty-state">لا توجد نتائج مطابقة لبحثك 🔍</div>';
  }
}

function buildTaskRow(t) {
  const row = document.createElement('div');
  row.className = 'task-row';
  const remaining = AppState.taskRemaining(t);
  const amount = AppState.taskAmount(t);
  const done = t.status === 'completed';

  let badges = `<span class="badge badge-status ${t.status}">${STATUS_LABELS[t.status]}</span>`;
  if (t.assignee) badges += `<span class="badge badge-assignee">👤 ${esc(t.assignee)}</span>`;
  if (t.date) badges += `<span class="badge badge-date ${dateBadgeClass(t)}">📅 ${fmtDate(t.date)}</span>`;
  if (amount > 0) {
    badges += `<span class="badge badge-amount ${remaining <= 0 ? 'paid-full' : ''}">${remaining > 0 ? 'متبقي ' + fmtMoney(remaining) : 'مدفوع بالكامل'}</span>`;
  }

  row.innerHTML = `
    <div class="task-checkbox ${done ? 'checked' : ''}">✓</div>
    <div class="task-main">
      <div class="task-title ${done ? 'done' : ''}">${esc(t.title)}</div>
      <div class="task-meta">${badges}</div>
    </div>`;

  row.querySelector('.task-checkbox').addEventListener('click', async (e) => {
    e.stopPropagation();
    await AppState.toggleComplete(t.id);
  });
  row.querySelector('.task-main').addEventListener('click', () => openTaskModal(t.id));
  return row;
}

function renderAssigneeFilterOptions() {
  const sel = document.getElementById('filterAssignee');
  const current = sel.value;
  sel.innerHTML = '<option value="">المسؤول: الكل</option>' +
    AppState.data.people.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  sel.value = current;
}

/* ---------------- Budget Tab ---------------- */
function renderBudget() {
  document.getElementById('totalBudgetInput').value = AppState.data.settings.totalBudget || '';
  const s = AppState.stats();
  document.getElementById('bTotalExpenses').textContent = fmtMoney(s.totalExpenses);
  document.getElementById('bTotalPaid').textContent = fmtMoney(s.totalPaid);
  document.getElementById('bTotalRemaining').textContent = fmtMoney(s.totalRemaining);
  const pct = Math.min(s.budgetUsagePct, 100);
  document.getElementById('budgetUsagePct').textContent = s.budgetUsagePct + '%';
  document.getElementById('budgetUsageFill').style.width = pct + '%';
  document.getElementById('budgetUsageFill').style.background = s.budgetUsagePct > 100
    ? 'linear-gradient(90deg,var(--danger),#e08277)'
    : '';

  const tbody = document.getElementById('budgetTableBody');
  const tasksWithAmount = AppState.data.tasks
    .filter(t => AppState.taskAmount(t) > 0)
    .sort((a, b) => AppState.taskAmount(b) - AppState.taskAmount(a));

  if (!tasksWithAmount.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">لا توجد بنود مالية مسجلة بعد</td></tr>`;
    return;
  }

  tbody.innerHTML = tasksWithAmount.map(t => {
    const amount = AppState.taskAmount(t);
    const remaining = AppState.taskRemaining(t);
    return `<tr data-task-id="${t.id}" style="cursor:pointer">
      <td>${esc(t.title)}</td>
      <td>${esc(t.vendor) || '—'}</td>
      <td>${fmtMoney(amount)}</td>
      <td>${fmtMoney(t.paidAmount)}</td>
      <td>${fmtMoney(remaining)}</td>
      <td><span class="badge badge-status ${t.status}">${STATUS_LABELS[t.status]}</span></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('tr[data-task-id]').forEach(row => {
    row.addEventListener('click', () => openTaskModal(row.dataset.taskId));
  });
}

/* ---------------- Wedding Day Tab ---------------- */
function renderTimeline() {
  const list = document.getElementById('timelineList');
  const items = [...AppState.data.timeline].sort((a, b) => a.time.localeCompare(b.time));
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">لم تتم إضافة أي مواعيد بعد</div>';
    return;
  }
  list.innerHTML = items.map(item => `
    <div class="timeline-item" data-id="${item.id}">
      <span class="timeline-time">${esc(item.time)}</span>
      <span class="timeline-title">${esc(item.title)}</span>
      <span class="timeline-actions">
        <button class="icon-btn edit-tl" title="تعديل">✏️</button>
        <button class="icon-btn danger del-tl" title="حذف">🗑️</button>
      </span>
    </div>`).join('');

  list.querySelectorAll('.edit-tl').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('.timeline-item').dataset.id;
      const item = AppState.data.timeline.find(t => t.id === id);
      const newTitle = prompt('عنوان الموعد:', item.title);
      if (newTitle === null) return;
      const newTime = prompt('الوقت (مثال 18:30):', item.time);
      if (newTime === null) return;
      await AppState.updateTimelineItem(id, { title: newTitle, time: newTime });
      showToast('تم تحديث الموعد');
    });
  });
  list.querySelectorAll('.del-tl').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('حذف هذا الموعد؟')) return;
      await AppState.deleteTimelineItem(btn.closest('.timeline-item').dataset.id);
      showToast('تم الحذف');
    });
  });
}

/* ---------------- People Tab ---------------- */
let expandedPerson = null;
function renderPeople() {
  const grid = document.getElementById('peopleGrid');
  grid.innerHTML = AppState.data.people.map(name => {
    const st = AppState.personStats(name);
    return `
      <div class="person-card" data-name="${esc(name)}">
        <button class="person-remove" data-remove="${esc(name)}">✕</button>
        <div class="person-avatar">${esc(name.trim()[0] || '?')}</div>
        <div class="person-name">${esc(name)}</div>
        <div class="person-stats">${st.total} مهام · ${st.completed} مكتملة · ${st.remaining} متبقية</div>
      </div>`;
  }).join('');

  if (expandedPerson && AppState.data.people.includes(expandedPerson)) {
    const panel = document.createElement('div');
    panel.className = 'person-tasks-panel';
    const tasks = AppState.data.tasks.filter(t => t.assignee === expandedPerson);
    panel.innerHTML = `<h3 style="margin-bottom:10px;font-size:15px;">مهام: ${esc(expandedPerson)}</h3>` +
      (tasks.length
        ? tasks.map(t => `<div class="task-row" data-task-id="${t.id}" style="cursor:pointer">
            <div class="task-checkbox ${t.status === 'completed' ? 'checked' : ''}">✓</div>
            <div class="task-main"><div class="task-title ${t.status === 'completed' ? 'done' : ''}">${esc(t.title)}</div>
            <div class="task-meta"><span class="badge badge-status ${t.status}">${STATUS_LABELS[t.status]}</span></div></div>
          </div>`).join('')
        : '<div class="empty-state">لا توجد مهام مسندة لهذا الشخص بعد</div>');
    grid.appendChild(panel);
    panel.querySelectorAll('[data-task-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('task-checkbox')) {
          AppState.toggleComplete(row.dataset.taskId);
        } else {
          openTaskModal(row.dataset.taskId);
        }
      });
    });
  }

  grid.querySelectorAll('.person-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.dataset.remove) return;
      const name = card.dataset.name;
      expandedPerson = expandedPerson === name ? null : name;
      renderPeople();
    });
  });
  grid.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const name = btn.dataset.remove;
      if (!confirm(`حذف "${name}" من قائمة المسؤولين؟`)) return;
      if (expandedPerson === name) expandedPerson = null;
      await AppState.deletePerson(name);
      showToast('تم الحذف');
    });
  });
}

/* ---------------- Emergency Kit Tab ---------------- */
function renderKit() {
  const list = document.getElementById('kitList');
  if (!AppState.data.emergencyKit.length) {
    list.innerHTML = '<div class="empty-state">القائمة فارغة</div>';
    return;
  }
  list.innerHTML = AppState.data.emergencyKit.map(item => `
    <div class="kit-item" data-id="${item.id}">
      <div class="task-checkbox ${item.checked ? 'checked' : ''}" style="width:22px;height:22px;font-size:12px;">✓</div>
      <span class="kit-name ${item.checked ? 'done' : ''}">${esc(item.name)}</span>
      <button class="icon-btn danger del-kit">🗑️</button>
    </div>`).join('');

  list.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('click', async () => {
      await AppState.toggleKitItem(cb.closest('.kit-item').dataset.id);
    });
  });
  list.querySelectorAll('.del-kit').forEach(btn => {
    btn.addEventListener('click', async () => {
      await AppState.deleteKitItem(btn.closest('.kit-item').dataset.id);
      showToast('تم الحذف');
    });
  });
}

/* ---------------- Countdown ---------------- */
function updateCountdown() {
  const date = AppState.data.settings.weddingDate;
  const box = document.getElementById('countdownBox');
  if (!date) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const target = new Date(date + 'T00:00:00');
  const now = new Date();
  let diff = target - now;
  if (diff < 0) diff = 0;
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / (1000 * 60)) % 60);
  const sec = Math.floor((diff / 1000) % 60);
  document.getElementById('cdDays').textContent = String(d).padStart(2, '0');
  document.getElementById('cdHours').textContent = String(h).padStart(2, '0');
  document.getElementById('cdMinutes').textContent = String(m).padStart(2, '0');
  document.getElementById('cdSeconds').textContent = String(sec).padStart(2, '0');
}

/* ---------------- Toast ---------------- */
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------------- Master render ---------------- */
function renderAll() {
  renderHome();
  renderAssigneeFilterOptions();
  renderTasks();
  renderBudget();
  renderTimeline();
  renderPeople();
  renderKit();
  renderPeopleDatalist();
  document.getElementById('groomNameInput').value = AppState.data.settings.groomName || '';
  document.getElementById('weddingDateInput').value = AppState.data.settings.weddingDate || '';
  updateCountdown();
}

function renderPeopleDatalist() {
  const dl = document.getElementById('peopleDatalist');
  dl.innerHTML = AppState.data.people.map(p => `<option value="${esc(p)}"></option>`).join('');
}
