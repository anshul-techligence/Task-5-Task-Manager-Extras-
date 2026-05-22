const jwt = require('jsonwebtoken');

function logger(req, res, next) {
  const start = Date.now();
  if (process.env.DEBUG === 'true' && req.method !== 'GET' && req.body && Object.keys(req.body).length) {
    const safe = { ...req.body };
    if (safe.password) safe.password = '[HIDDEN]';
    console.log(`\x1b[90m  body: ${JSON.stringify(safe)}\x1b[0m`);
  }
  res.on('finish', () => {
    const ms = Date.now() - start;
    const color = res.statusCode >= 500 ? '\x1b[31m'
                : res.statusCode >= 400 ? '\x1b[33m'
                : res.statusCode >= 300 ? '\x1b[36m' : '\x1b[32m';
    console.log(`${color}[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)\x1b[0m`);
  });
  next();
}

const rateLimitMap = new Map();
function rateLimit({ windowMs = 60000, max = 20 } = {}) {
  return (req, res, next) => {
    const ip  = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = rateLimitMap.get(ip) || { count: 0, start: now };
    if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
    entry.count++;
    rateLimitMap.set(ip, entry);
    if (entry.count > max) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    next();
  };
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    res.status(401).json({ error: msg });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    next();
  };
}

module.exports = { logger, authenticate, requireRole, rateLimit };
