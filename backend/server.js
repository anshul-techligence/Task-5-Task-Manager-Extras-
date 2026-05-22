require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDb } = require('./db');
const { logger } = require('./middleware/auth');
const { isBlacklisted } = require('./controllers/authController');
const authRoutes  = require('./routes/auth');
const taskRoutes  = require('./routes/tasks');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(express.json());
app.use(logger);

// Block blacklisted tokens
app.use((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token && isBlacklisted(token)) return res.status(401).json({ error: 'Token invalidated. Please log in again.' });
  next();
});

app.use('/api/auth',  authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => res.status(404).json({ error: 'API route not found' }));

app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));

// Global error handler
app.use((err, req, res, next) => {
  console.error('\x1b[31mUnhandled error:\x1b[0m', err);
  res.status(500).json({ error: 'Internal server error' });
});

initDb().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\x1b[36m\u2713 Server running at http://localhost:${PORT}\x1b[0m`);
    console.log(`\x1b[90m  Debug mode: ${process.env.DEBUG === 'true' ? 'ON' : 'OFF'}\x1b[0m`);
    console.log(`\x1b[90m  Environment: ${process.env.NODE_ENV || 'development'}\x1b[0m`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
