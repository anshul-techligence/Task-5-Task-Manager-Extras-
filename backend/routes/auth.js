const router = require('express').Router();
const { register, login, logout, getMe, changePassword } = require('../controllers/authController');
const { authenticate, rateLimit } = require('../middleware/auth');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }); // 10 attempts per 15 min

router.post('/register', authLimiter, register);
router.post('/login',    authLimiter, login);
router.post('/logout',   authenticate, logout);
router.get('/me',        authenticate, getMe);
router.put('/password',  authenticate, changePassword);

module.exports = router;
