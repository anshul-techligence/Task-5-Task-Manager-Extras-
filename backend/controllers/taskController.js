const { query, run, getOne } = require('../db');

function getTasks(req, res) {
  const userId = req.user.id;
  const { filter, search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql = 'SELECT * FROM tasks WHERE user_id = ?';
  const params = [userId];

  if (filter === 'completed') { sql += ' AND completed = 1'; }
  else if (filter === 'pending') { sql += ' AND completed = 0'; }

  if (search?.trim()) {
    sql += ' AND title LIKE ?';
    params.push(`%${search.trim()}%`);
  }

  const totalResult = query(sql.replace('SELECT *', 'SELECT COUNT(*) as count'), params);
  const total = totalResult[0]?.count ?? 0;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);

  const tasks = query(sql, params);
  res.json({ tasks, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
}

function createTask(req, res) {
  const { title, due_date } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  if (title.trim().length > 200) return res.status(400).json({ error: 'Title too long (max 200 chars)' });
  if (due_date && isNaN(Date.parse(due_date)))
    return res.status(400).json({ error: 'Invalid due date' });

  const id = run(
    'INSERT INTO tasks (user_id, title, due_date) VALUES (?, ?, ?)',
    [req.user.id, title.trim(), due_date || null]
  );

  res.status(201).json({
    id,
    user_id: req.user.id,
    title: title.trim(),
    completed: 0,
    due_date: due_date || null,
    created_at: new Date().toISOString()
  });
}

function updateTask(req, res) {
  const id = Number(req.params.id);
  const task = getOne('SELECT * FROM tasks WHERE id = ?', [id]);

  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.user_id !== req.user.id) return res.status(403).json({ error: 'Not your task' });

  const { title, completed, due_date } = req.body;

  if (title !== undefined && !title.trim()) return res.status(400).json({ error: 'Title cannot be empty' });
  if (title !== undefined && title.trim().length > 200) return res.status(400).json({ error: 'Title too long' });
  if (due_date !== undefined && due_date !== null && isNaN(Date.parse(due_date)))
    return res.status(400).json({ error: 'Invalid due date' });

  const newTitle = title !== undefined ? title.trim() : task.title;
  const newCompleted = completed !== undefined ? (completed ? 1 : 0) : task.completed;
  const newDueDate = due_date !== undefined ? (due_date || null) : task.due_date;

  run('UPDATE tasks SET title = ?, completed = ?, due_date = ? WHERE id = ?',
    [newTitle, newCompleted, newDueDate, id]);

  res.json({ ...task, title: newTitle, completed: newCompleted, due_date: newDueDate });
}

function deleteTask(req, res) {
  const id = Number(req.params.id);
  const task = getOne('SELECT * FROM tasks WHERE id = ?', [id]);

  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.user_id !== req.user.id) return res.status(403).json({ error: 'Not your task' });

  run('DELETE FROM tasks WHERE id = ?', [id]);
  res.json({ success: true });
}

module.exports = { getTasks, createTask, updateTask, deleteTask };
