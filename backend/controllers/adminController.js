const { query, run, getOne } = require('../db');

function getAllUsers(req, res) {
  const users = query('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC');
  const taskCounts = query('SELECT user_id, COUNT(*) as count FROM tasks GROUP BY user_id');
  const countMap = Object.fromEntries(taskCounts.map(r => [r.user_id, r.count]));
  res.json(users.map(u => ({ ...u, task_count: countMap[u.id] || 0 })));
}

function updateUserRole(req, res) {
  const id = Number(req.params.id);
  const { role } = req.body;
  if (!['user', 'admin'].includes(role))
    return res.status(400).json({ error: 'Role must be "user" or "admin"' });
  if (id === req.user.id)
    return res.status(400).json({ error: 'Cannot change your own role' });
  const user = getOne('SELECT id FROM users WHERE id = ?', [id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  res.json({ success: true, message: `User ${id} role updated to ${role}` });
}

function deleteUser(req, res) {
  const id = Number(req.params.id);
  if (id === req.user.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  const user = getOne('SELECT id FROM users WHERE id = ?', [id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  run('DELETE FROM tasks WHERE user_id = ?', [id]);
  run('DELETE FROM users WHERE id = ?', [id]);
  res.json({ success: true });
}

function getStats(req, res) {
  const totalUsers = query('SELECT COUNT(*) as count FROM users')[0]?.count || 0;
  const totalTasks = query('SELECT COUNT(*) as count FROM tasks')[0]?.count || 0;
  const completedTasks = query('SELECT COUNT(*) as count FROM tasks WHERE completed = 1')[0]?.count || 0;
  const recentUsers = query('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5');
  res.json({ totalUsers, totalTasks, completedTasks, pendingTasks: totalTasks - completedTasks, recentUsers });
}

module.exports = { getAllUsers, updateUserRole, deleteUser, getStats };
