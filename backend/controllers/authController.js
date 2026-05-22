const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, getOne } = require('../db');


const blacklist = new Set();

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    if (!username?.trim() || !email?.trim() || !password)
      return res.status(400).json({ error: 'Username, email and password are required' });

    if (username.trim().length < 3)
      return res.status(400).json({ error: 'Username must be at least 3 characters' });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Invalid email address' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = getOne('SELECT id FROM users WHERE email = ? OR username = ?', [email.trim(), username.trim()]);
    if (existing) return res.status(409).json({ error: 'Username or email already taken' });

    const hashed = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS));
    const id = run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username.trim(), email.trim(), hashed]);

    const user = getOne('SELECT id, username, email, role, created_at FROM users WHERE id = ?', [id]);
    const token = signToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const user = getOne('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const { password: _, ...safeUser } = user;
    const token = signToken(safeUser);

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

function logout(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) blacklist.add(token);
  res.json({ message: 'Logged out successfully' });
}

function getMe(req, res) {
  const user = getOne('SELECT id, username, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Current and new password are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const user = getOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, Number(process.env.BCRYPT_ROUNDS));
    run('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

function isBlacklisted(token) {
  return blacklist.has(token);
}

module.exports = { register, login, logout, getMe, changePassword, isBlacklisted };
