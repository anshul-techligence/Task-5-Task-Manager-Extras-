//  DOM refs
const taskList    = document.getElementById('task-list');
const taskForm    = document.getElementById('task-form');
const taskInput   = document.getElementById('task-input');
const dueDateInput= document.getElementById('due-date-input');
const clearDueBtn = document.getElementById('clear-due');
const searchInput = document.getElementById('search-input');
const emptyState  = document.getElementById('empty-state');
const loadingEl   = document.getElementById('loading');
const toastEl     = document.getElementById('toast');
const filterBtns  = document.querySelectorAll('.filter-btn');
const pagination  = document.getElementById('pagination');

let allTasks      = [];   // in-memory source of truth
let currentFilter = 'all';
let currentPage   = 1;
let searchTimer   = null;
const LIMIT       = 10;


function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${window.getToken()}` };
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...options.headers } });
  if (res.status === 401) { window.showAuth(); return null; }
  return res.json();
}

const api = {
  getTasks: (params) => apiFetch(`/api/tasks?${new URLSearchParams(params)}`),
  post:     (body)   => apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),
  put:      (id, b)  => apiFetch(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  delete:   (id)     => apiFetch(`/api/tasks/${id}`, { method: 'DELETE' }),
};

let toastTimer;
function toast(msg, type = 'success') {
  toastEl.textContent = msg;
  toastEl.className = `toast toast-${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 3000);
}

function renderStats() {
  const total   = allTasks.length;
  const done    = allTasks.filter(t => t.completed).length;
  const pending = total - done;
  const bump = (id, val) => {
    const el = document.getElementById(id);
    if (el.textContent !== String(val)) {
      el.textContent = val;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
      setTimeout(() => el.classList.remove('bump'), 300);
    }
  };
  bump('stat-total', total);
  bump('stat-done', done);
  bump('stat-pending', pending);
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.querySelector('.progress-bar-fill').style.width = pct + '%';
}

// Filter , Search ,, paginate
function getVisible() {
  const search = searchInput.value.trim().toLowerCase();
  return allTasks.filter(t => {
    if (currentFilter === 'completed' && !t.completed) return false;
    if (currentFilter === 'pending'   &&  t.completed) return false;
    if (search && !t.title.toLowerCase().includes(search)) return false;
    return true;
  });
}


function formatDue(dateStr) {
  if (!dateStr) return null;
  const due  = new Date(dateStr);
  const diff = Math.ceil((due - new Date()) / 86400000);
  if (diff < 0)   return { label: `Overdue by ${Math.abs(diff)}d`, cls: 'due-overdue' };
  if (diff === 0) return { label: 'Due today',                      cls: 'due-today'   };
  if (diff <= 3)  return { label: `Due in ${diff}d`,                cls: 'due-soon'    };
  return { label: due.toLocaleDateString(), cls: 'due-normal' };
}

function render() {
  loadingEl.classList.add('hidden');
  taskList.querySelectorAll('.task-item').forEach(el => el.remove());
  pagination.classList.add('hidden');
  pagination.innerHTML = '';

  const visible = getVisible();
  const pages   = Math.ceil(visible.length / LIMIT);
  if (currentPage > pages && pages > 0) currentPage = pages;
  const paged   = visible.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  if (paged.length === 0) {
    emptyState.classList.remove('hidden');
    renderStats();
    return;
  }

  emptyState.classList.add('hidden');
  paged.forEach(task => taskList.appendChild(createTaskEl(task)));
  if (pages > 1) renderPagination(pages);
  renderStats();
}

// task element
function createTaskEl(task) {
  const item = document.createElement('div');
  item.className = `task-item${task.completed ? ' completed' : ''}`;
  item.dataset.id = task.id;

  const checkbox = document.createElement('div');
  checkbox.className = `task-checkbox${task.completed ? ' checked' : ''}`;
  checkbox.addEventListener('click', () => toggleTask(task));

  const content  = document.createElement('div');
  content.className = 'flex-1 min-w-0';

  const titleRow = document.createElement('div');
  titleRow.className = 'flex items-center gap-2 flex-wrap';

  const titleEl  = document.createElement('span');
  titleEl.className = 'task-title';
  titleEl.textContent = task.title;
  titleRow.appendChild(titleEl);

  const due = formatDue(task.due_date);
  if (due) {
    const badge = document.createElement('span');
    badge.className = `due-badge ${due.cls}`;
    badge.textContent = due.label;
    titleRow.appendChild(badge);
  }

  content.appendChild(titleRow);

  const actions = document.createElement('div');
  actions.className = 'flex gap-1 flex-shrink-0';

  const editBtn = makeBtn('edit', iconEdit);
  editBtn.addEventListener('click', () => startEdit(task, item, titleEl, editBtn));

  const delBtn = makeBtn('delete', iconDelete);
  delBtn.addEventListener('click', () => deleteTask(task.id, item));

  actions.append(editBtn, delBtn);
  item.append(checkbox, content, actions);
  return item;
}

function makeBtn(cls, html) {
  const btn = document.createElement('button');
  btn.className = `action-btn ${cls}`;
  btn.innerHTML = html;
  return btn;
}

const iconEdit   = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z"/></svg>`;
const iconDelete = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4M3 7h18"/></svg>`;
const iconSave   = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;

function renderPagination(pages) {
  pagination.classList.remove('hidden');
  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement('button');
    btn.className = `page-btn${i === currentPage ? ' active' : ''}`;
    btn.textContent = i;
    btn.addEventListener('click', () => { currentPage = i; render(); });
    pagination.appendChild(btn);
  }
}


function startEdit(task, item, titleEl, editBtn) {
  const input = document.createElement('input');
  input.className = 'edit-input';
  input.value = task.title;
  titleEl.replaceWith(input);
  input.focus();

  const saveBtn = makeBtn('save', iconSave);
  editBtn.replaceWith(saveBtn);

  const save = async () => {
    const newTitle = input.value.trim();
    if (!newTitle) return;
    if (newTitle === task.title) { render(); return; }
    const updated = await api.put(task.id, { title: newTitle });
    if (!updated || updated.error) { toast(updated?.error || 'Error', 'error'); render(); return; }
    // Update in-memory array and re-render
    allTasks = allTasks.map(t => t.id === task.id ? { ...t, title: newTitle } : t);
    toast('Task updated');
    render();
  };

  saveBtn.addEventListener('click', save);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') render(); });
}


async function toggleTask(task) {
  const newCompleted = !task.completed;
  // Optimistic update
  allTasks = allTasks.map(t => t.id === task.id ? { ...t, completed: newCompleted ? 1 : 0 } : t);
  render();
  const updated = await api.put(task.id, { completed: newCompleted });
  if (!updated || updated.error) {
    // Revert on failure
    allTasks = allTasks.map(t => t.id === task.id ? { ...t, completed: task.completed } : t);
    toast(updated?.error || 'Error', 'error');
    render();
    return;
  }
  toast(newCompleted ? '✓ Task completed!' : 'Task marked pending');
}

async function deleteTask(id, item) {
  item.classList.add('removing');
  await new Promise(r => setTimeout(r, 280));
  const res = await api.delete(id);
  if (!res || res.error) { toast(res?.error || 'Error', 'error'); item.classList.remove('removing'); return; }
  allTasks = allTasks.filter(t => t.id !== id);
  toast('Task deleted', 'info');
  render();
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = taskInput.value.trim();
  if (!title) return;

  const addBtn = document.getElementById('add-btn');
  addBtn.disabled = true;
  const task = await api.post({ title, due_date: dueDateInput.value || null });
  addBtn.disabled = false;

  if (!task || task.error) { toast(task?.error || 'Failed to add task', 'error'); return; }

  taskInput.value = '';
  dueDateInput.value = '';

  allTasks.unshift(task);
  currentFilter = 'all';
  currentPage   = 1;
  searchInput.value = '';
  filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
  render();
  toast('Task added ✓');
});

clearDueBtn.addEventListener('click', () => { dueDateInput.value = ''; });


searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { currentPage = 1; render(); }, 250);
});

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    currentPage   = 1;
    filterBtns.forEach(b => b.classList.toggle('active', b === btn));
    render();
  });
});

async function loadAdminPanel() {
  const user = window.getUser();
  if (user?.role !== 'admin') return;
  document.getElementById('admin-panel').classList.remove('hidden');

  const data = await apiFetch('/api/admin/stats');
  if (!data) return;

  const statsEl = document.getElementById('admin-stats');
  statsEl.innerHTML = [
    { label: 'Total Users',      val: data.totalUsers,      color: 'text-orange-400' },
    { label: 'Total Tasks',      val: data.totalTasks,      color: 'text-white' },
    { label: 'Completed Tasks',  val: data.completedTasks,  color: 'text-green-400' },
    { label: 'Pending Tasks',    val: data.pendingTasks,    color: 'text-rose-400' },
  ].map(s => `
    <div class="stat-card text-center">
      <div class="text-xl font-bold ${s.color}">${s.val}</div>
      <div class="text-xs text-slate-500 mt-1">${s.label}</div>
    </div>`).join('');

  await loadUsersTable();
}

async function loadUsersTable() {
  const users = await apiFetch('/api/admin/users');
  if (!users) return;
  const me = window.getUser();
  const table = document.getElementById('users-table');
  if (!users.length) { table.innerHTML = '<p class="text-slate-600 text-sm">No users found.</p>'; return; }
  table.innerHTML = users.map(u => `
    <div class="user-row">
      <div class="flex-1 min-w-0">
        <span class="text-slate-200 text-sm font-medium">${u.username}</span>
        <span class="text-slate-500 text-xs ml-2">${u.email}</span>
        <span class="ml-2 role-badge role-${u.role}">${u.role}</span>
      </div>
      <span class="text-slate-600 text-xs">${u.task_count} tasks</span>
      ${u.id !== me.id ? `
        <button onclick="toggleRole(${u.id}, '${u.role}')"
          class="action-btn edit" title="Toggle role">&#8645;</button>
        <button onclick="adminDeleteUser(${u.id})"
          class="action-btn delete" title="Delete user">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4M3 7h18"/></svg>
        </button>` : '<span class="text-xs text-slate-600">(you)</span>'}
    </div>`).join('');
}

window.toggleRole = async (id, currentRole) => {
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  const res = await apiFetch(`/api/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
  if (res?.error) { toast(res.error, 'error'); return; }
  toast(`Role updated to ${newRole}`);
  loadUsersTable();
};

window.adminDeleteUser = async (id) => {
  if (!confirm('Delete this user and all their tasks?')) return;
  const res = await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  if (res?.error) { toast(res.error, 'error'); return; }
  toast('User deleted', 'info');
  loadUsersTable();
  loadAdminPanel();
};

document.getElementById('refresh-users')?.addEventListener('click', loadUsersTable);

window.initApp = async () => {
  const user = window.getUser();
  if (user) {
    document.getElementById('welcome-msg').textContent = `Welcome back, ${user.username} 👋`;
    if (user.role === 'admin') {
      const badge = document.createElement('span');
      badge.className = 'admin-badge ml-2';
      badge.textContent = 'ADMIN';
      document.getElementById('welcome-msg').appendChild(badge);
    }
  }

  currentPage   = 1;
  currentFilter = 'all';
  searchInput.value = '';
  filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));

  loadingEl.classList.remove('hidden');
  const data = await api.getTasks({ filter: 'all', page: 1, limit: 9999 });
  if (data) {
    allTasks = data.tasks;
    render();
  }

  loadAdminPanel();
};
