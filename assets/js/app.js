/* =========================================================
   app.js — التهيئة + ربط الأحداث + المودال + الاستيراد/التصدير
   ========================================================= */

(async function init() {
  await AppState.load();
  updateSyncBadge();
  populateSectionSelect();
  renderAll();
  bindNav();
  bindHomeActions();
  bindTasksToolbar();
  bindSettingsInputs();
  bindBudgetInputs();
  bindTimelineAdd();
  bindPeopleAdd();
  bindKitAdd();
  bindModal();
  bindBackupActions();

  setInterval(updateCountdown, 1000);
  window.addEventListener('state:changed', renderAll);
})();

/* ---------------- Sync badge ---------------- */
function updateSyncBadge() {
  const badge = document.getElementById('syncBadge');
  if (AppState.syncMode === 'claude') {
    badge.textContent = '🟢 متزامن مباشرة مع كل من يفتح هذا الرابط';
    badge.className = 'sync-badge shared';
  } else if (AppState.syncMode === 'firebase') {
    badge.textContent = '🟢 متزامن ومحفوظ على السحابة (Firebase)';
    badge.className = 'sync-badge shared';
  } else {
    badge.textContent = '🟡 محفوظ على هذا الجهاز فقط';
    badge.className = 'sync-badge local';
  }
}

/* ---------------- Tabs / Navigation ---------------- */
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('tab-' + tabId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.bnav-btn').forEach(b => {
    const isMoreGroup = ['people', 'kit', 'backup'].includes(tabId) && b.dataset.tab === 'more';
    b.classList.toggle('active', b.dataset.tab === tabId || isMoreGroup);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindNav() {
  document.querySelectorAll('.nav-btn, .bnav-btn, .more-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

/* ---------------- Settings (groom name / date) ---------------- */
function bindSettingsInputs() {
  const nameInput = document.getElementById('groomNameInput');
  const dateInput = document.getElementById('weddingDateInput');
  nameInput.addEventListener('change', async () => {
    await AppState.updateSettings({ groomName: nameInput.value.trim() });
  });
  dateInput.addEventListener('change', async () => {
    await AppState.updateSettings({ weddingDate: dateInput.value });
    showToast('تم تحديث تاريخ الزواج');
  });
}

/* ---------------- Home actions ---------------- */
function bindHomeActions() {
  document.getElementById('btnPrintHome').addEventListener('click', doPrint);
  document.getElementById('btnShareHome').addEventListener('click', doShare);
  document.getElementById('btnCopyHome').addEventListener('click', doCopyRemaining);
}

/* ---------------- Tasks toolbar (search/filter/add) ---------------- */
function bindTasksToolbar() {
  const search = document.getElementById('searchInput');
  search.addEventListener('input', () => {
    currentSearch = search.value.trim();
    renderTasks();
  });

  document.querySelectorAll('#filterChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#filterChips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderTasks();
    });
  });

  document.getElementById('filterAssignee').addEventListener('change', (e) => {
    currentAssigneeFilter = e.target.value;
    renderTasks();
  });

  document.getElementById('btnAddTask').addEventListener('click', () => openTaskModal(null));
}

/* ---------------- Budget inputs ---------------- */
function bindBudgetInputs() {
  const input = document.getElementById('totalBudgetInput');
  input.addEventListener('change', async () => {
    await AppState.updateSettings({ totalBudget: Number(input.value) || 0 });
    showToast('تم تحديث الميزانية الإجمالية');
  });
}

/* ---------------- Timeline add ---------------- */
function bindTimelineAdd() {
  document.getElementById('btnAddTimeline').addEventListener('click', async () => {
    const title = prompt('عنوان الموعد (مثال: وصول المصورة):');
    if (!title) return;
    const time = prompt('الوقت (مثال 18:30):', '12:00');
    if (time === null) return;
    await AppState.addTimelineItem({ title: title.trim(), time: time.trim() });
    showToast('تمت إضافة الموعد');
  });
}

/* ---------------- People add ---------------- */
function bindPeopleAdd() {
  const input = document.getElementById('newPersonInput');
  const add = async () => {
    if (!input.value.trim()) return;
    await AppState.addPerson(input.value.trim());
    input.value = '';
    showToast('تمت الإضافة');
  };
  document.getElementById('btnAddPerson').addEventListener('click', add);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
}

/* ---------------- Kit add ---------------- */
function bindKitAdd() {
  const input = document.getElementById('newKitInput');
  const add = async () => {
    if (!input.value.trim()) return;
    await AppState.addKitItem(input.value.trim());
    input.value = '';
    showToast('تمت الإضافة');
  };
  document.getElementById('btnAddKit').addEventListener('click', add);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
}

/* ---------------- Task Modal ---------------- */
function populateSectionSelect() {
  const sel = document.getElementById('fSection');
  sel.innerHTML = AppState.data.sections.map(s => `<option value="${s.id}">${s.icon} ${esc(s.name)}</option>`).join('');
}

let editingTaskId = null;

function openTaskModal(taskId) {
  editingTaskId = taskId;
  const overlay = document.getElementById('taskModalOverlay');
  const title = document.getElementById('modalTitle');
  const delBtn = document.getElementById('btnDeleteTask');

  if (taskId) {
    const t = AppState.getTask(taskId);
    if (!t) return;
    title.textContent = 'تعديل المهمة';
    delBtn.style.display = '';
    document.getElementById('taskId').value = t.id;
    document.getElementById('fTitle').value = t.title;
    document.getElementById('fSection').value = t.sectionId;
    document.getElementById('fStatus').value = t.status;
    document.getElementById('fAssignee').value = t.assignee;
    document.getElementById('fPhone').value = t.phone;
    document.getElementById('fVendor').value = t.vendor;
    document.getElementById('fDate').value = t.date;
    document.getElementById('fBudgetExpected').value = t.budgetExpected || '';
    document.getElementById('fActualAmount').value = t.actualAmount || '';
    document.getElementById('fPaidAmount').value = t.paidAmount || '';
    document.getElementById('fNotes').value = t.notes;
  } else {
    title.textContent = 'إضافة مهمة';
    delBtn.style.display = 'none';
    document.getElementById('taskId').value = '';
    ['fTitle', 'fAssignee', 'fPhone', 'fVendor', 'fDate', 'fNotes'].forEach(id => document.getElementById(id).value = '');
    ['fBudgetExpected', 'fActualAmount', 'fPaidAmount'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fSection').value = AppState.data.sections[0].id;
    document.getElementById('fStatus').value = 'not_started';
  }
  updateRemainingDisplay();
  overlay.classList.add('open');
}

function closeTaskModal() {
  document.getElementById('taskModalOverlay').classList.remove('open');
  editingTaskId = null;
}

function updateRemainingDisplay() {
  const actual = Number(document.getElementById('fActualAmount').value) || 0;
  const expected = Number(document.getElementById('fBudgetExpected').value) || 0;
  const paid = Number(document.getElementById('fPaidAmount').value) || 0;
  const amount = actual > 0 ? actual : expected;
  const remaining = Math.max(amount - paid, 0);
  document.getElementById('fRemainingDisplay').textContent = fmtMoney(remaining);
}

function bindModal() {
  document.getElementById('modalClose').addEventListener('click', closeTaskModal);
  document.getElementById('taskModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'taskModalOverlay') closeTaskModal();
  });
  ['fActualAmount', 'fBudgetExpected', 'fPaidAmount'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateRemainingDisplay);
  });

  document.getElementById('btnSaveTask').addEventListener('click', async () => {
    const titleVal = document.getElementById('fTitle').value.trim();
    if (!titleVal) { showToast('الرجاء إدخال اسم المهمة'); return; }
    const payload = {
      title: titleVal,
      sectionId: document.getElementById('fSection').value,
      status: document.getElementById('fStatus').value,
      assignee: document.getElementById('fAssignee').value.trim(),
      phone: document.getElementById('fPhone').value.trim(),
      vendor: document.getElementById('fVendor').value.trim(),
      date: document.getElementById('fDate').value,
      budgetExpected: Number(document.getElementById('fBudgetExpected').value) || 0,
      actualAmount: Number(document.getElementById('fActualAmount').value) || 0,
      paidAmount: Number(document.getElementById('fPaidAmount').value) || 0,
      notes: document.getElementById('fNotes').value.trim()
    };

    if (editingTaskId) {
      await AppState.updateTask(editingTaskId, payload);
      showToast('تم حفظ التعديلات');
    } else {
      await AppState.addTask(payload);
      showToast('تمت إضافة المهمة');
    }
    closeTaskModal();
  });

  document.getElementById('btnDeleteTask').addEventListener('click', async () => {
    if (!editingTaskId) return;
    if (!confirm('هل تريدين حذف هذه المهمة؟')) return;
    await AppState.deleteTask(editingTaskId);
    showToast('تم حذف المهمة');
    closeTaskModal();
  });
}

/* ---------------- Backup: export / import / reset / print / share / copy ---------------- */
function bindBackupActions() {
  document.getElementById('btnExport').addEventListener('click', exportBackup);
  document.getElementById('importFile').addEventListener('change', importBackup);
  document.getElementById('btnPrintBackup').addEventListener('click', doPrint);
  document.getElementById('btnShareBackup').addEventListener('click', doShare);
  document.getElementById('btnCopyBackup').addEventListener('click', doCopyRemaining);
  document.getElementById('btnResetAll').addEventListener('click', async () => {
    if (!confirm('سيتم حذف كل البيانات الحالية والعودة للحالة الافتراضية. متابعة؟')) return;
    await AppState.resetAll();
    showToast('تمت إعادة التعيين');
  });
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(AppState.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `تجهيزات-العرس-نسخة-احتياطية-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('تم تصدير النسخة الاحتياطية');
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const obj = JSON.parse(ev.target.result);
      if (!confirm('سيتم استبدال البيانات الحالية بالنسخة المستوردة. متابعة؟')) return;
      await AppState.importData(obj);
      populateSectionSelect();
      showToast('تم استيراد النسخة الاحتياطية بنجاح');
    } catch (err) {
      alert('تعذر قراءة الملف، تأكدي أنه ملف JSON صحيح صادر من هذا التطبيق.');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
}

function doPrint() {
  switchTab('tasks');
  currentFilter = 'all'; currentSearch = ''; currentAssigneeFilter = '';
  document.getElementById('searchInput').value = '';
  document.querySelectorAll('#filterChips .chip').forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
  renderTasks();
  setTimeout(() => window.print(), 150);
}

function buildRemainingText() {
  const remaining = AppState.data.tasks.filter(t => t.status !== 'completed');
  const lines = ['تجهيزات العرس المتبقية 💍', ''];
  if (!remaining.length) {
    lines.push('كل المهام مكتملة 🎉');
  } else {
    remaining.forEach(t => lines.push('☐ ' + t.title));
  }
  return lines.join('\n');
}

async function doCopyRemaining() {
  const text = buildRemainingText();
  try {
    await navigator.clipboard.writeText(text);
    showToast('تم نسخ المهام المتبقية 📋');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('تم نسخ المهام المتبقية 📋'); }
    catch (err) { alert('تعذر النسخ التلقائي، يمكنك نسخ النص يدويًا:\n\n' + text); }
    ta.remove();
  }
}

async function doShare() {
  const text = buildRemainingText();
  if (navigator.share) {
    try { await navigator.share({ title: 'تجهيزات عرس أخوي 💍', text }); }
    catch (e) { /* المستخدم ألغى المشاركة */ }
  } else {
    await doCopyRemaining();
  }
}
