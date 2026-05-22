const router = require('express').Router();
const { getTasks, createTask, updateTask, deleteTask } = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;
