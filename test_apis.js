const BASE = 'http://localhost:3000/api';

const TS = Date.now();
const TEST_EMAIL = `test${TS}@test.com`;
const TEST_USER  = `testuser${TS}`;
const ADMIN_EMAIL = `admin${TS}@test.com`;
const ADMIN_USER  = `adminuser${TS}`;

let token, adminToken, userId, taskId;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function req(method, url, body, auth) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = `Bearer ${auth}`;
  const res = await fetch(`${BASE}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function log(name, status, expected, data) {
  const ok = status === expected;
  console.log(`${ok ? '✅' : '❌'} [${status}] ${name}${ok ? '' : ` (expected ${expected})\n   → ${JSON.stringify(data)}`}`);
  return ok;
}

async function run() {
  console.log('\n=== Auth APIs ===');

  // Register
  let r = await req('POST', '/auth/register', { username: TEST_USER, email: TEST_EMAIL, password: 'pass123' });
  log('POST /auth/register', r.status, 201, r.data);
  token = r.data.token;
  userId = r.data.user?.id;
  await sleep(200);

  // Register duplicate
  r = await req('POST', '/auth/register', { username: TEST_USER, email: TEST_EMAIL, password: 'pass123' });
  log('POST /auth/register (duplicate → 409)', r.status, 409, r.data);
  await sleep(200);

  // Register validation
  r = await req('POST', '/auth/register', { username: 'ab', email: 'bad', password: '123' });
  log('POST /auth/register (invalid → 400)', r.status, 400, r.data);
  await sleep(200);

  // Login
  r = await req('POST', '/auth/login', { email: TEST_EMAIL, password: 'pass123' });
  log('POST /auth/login', r.status, 200, r.data);
  token = r.data.token;
  await sleep(200);

  // Login wrong password
  r = await req('POST', '/auth/login', { email: TEST_EMAIL, password: 'wrong' });
  log('POST /auth/login (wrong password → 401)', r.status, 401, r.data);
  await sleep(200);

  // Get me
  r = await req('GET', '/auth/me', null, token);
  log('GET /auth/me', r.status, 200, r.data);

  // Get me no token
  r = await req('GET', '/auth/me');
  log('GET /auth/me (no token → 401)', r.status, 401, r.data);

  // Change password
  r = await req('PUT', '/auth/password', { currentPassword: 'pass123', newPassword: 'newpass123' }, token);
  log('PUT /auth/password', r.status, 200, r.data);
  await sleep(200);

  // Re-login with new password
  r = await req('POST', '/auth/login', { email: TEST_EMAIL, password: 'newpass123' });
  log('POST /auth/login (after password change)', r.status, 200, r.data);
  token = r.data.token;
  await sleep(200);

  // Logout
  const tokenToBlacklist = token;
  r = await req('POST', '/auth/logout', null, tokenToBlacklist);
  log('POST /auth/logout', r.status, 200, r.data);

  // Use blacklisted token
  r = await req('GET', '/auth/me', null, tokenToBlacklist);
  log('GET /auth/me (blacklisted token → 401)', r.status, 401, r.data);
  await sleep(200);

  // Re-login with fresh token for remaining tests
  r = await req('POST', '/auth/login', { email: TEST_EMAIL, password: 'newpass123' });
  log('POST /auth/login (re-login for task tests)', r.status, 200, r.data);
  token = r.data.token;

  console.log('\n=== Task APIs ===');

  // Create task
  r = await req('POST', '/tasks', { title: 'Test Task', due_date: '2025-12-31' }, token);
  log('POST /tasks', r.status, 201, r.data);
  taskId = r.data.id;

  // Create task no title
  r = await req('POST', '/tasks', { title: '' }, token);
  log('POST /tasks (no title → 400)', r.status, 400, r.data);

  // Get tasks
  r = await req('GET', '/tasks', null, token);
  log('GET /tasks', r.status, 200, r.data);

  // Get tasks with filter
  r = await req('GET', '/tasks?filter=pending', null, token);
  log('GET /tasks?filter=pending', r.status, 200, r.data);

  // Get tasks with search
  r = await req('GET', '/tasks?search=Test', null, token);
  log('GET /tasks?search=Test', r.status, 200, r.data);

  // Update task
  r = await req('PUT', `/tasks/${taskId}`, { completed: true, title: 'Updated Task' }, token);
  log('PUT /tasks/:id', r.status, 200, r.data);

  // Update non-existent task
  r = await req('PUT', '/tasks/99999', { title: 'x' }, token);
  log('PUT /tasks/:id (not found → 404)', r.status, 404, r.data);

  // Delete task
  r = await req('DELETE', `/tasks/${taskId}`, null, token);
  log('DELETE /tasks/:id', r.status, 200, r.data);

  // Delete already deleted
  r = await req('DELETE', `/tasks/${taskId}`, null, token);
  log('DELETE /tasks/:id (not found → 404)', r.status, 404, r.data);

  console.log('\n=== Admin APIs (setup: register admin) ===');

  // Register admin user
  await sleep(200);
  r = await req('POST', '/auth/register', { username: ADMIN_USER, email: ADMIN_EMAIL, password: 'admin123' });
  const adminId = r.data.user?.id;
  adminToken = r.data.token;

  // Manually promote via DB not possible here; use existing token as regular user to test 403
  r = await req('GET', '/admin/stats', null, token);
  log('GET /admin/stats (non-admin → 403)', r.status, 403, r.data);

  r = await req('GET', '/admin/users', null, token);
  log('GET /admin/users (non-admin → 403)', r.status, 403, r.data);

  r = await req('PUT', `/admin/users/${adminId}/role`, { role: 'admin' }, token);
  log('PUT /admin/users/:id/role (non-admin → 403)', r.status, 403, r.data);

  r = await req('DELETE', `/admin/users/${adminId}`, null, token);
  log('DELETE /admin/users/:id (non-admin → 403)', r.status, 403, r.data);

  console.log('\n=== Unknown Route ===');
  r = await req('GET', '/unknown');
  log('GET /api/unknown (→ 404)', r.status, 404, r.data);

  console.log('\n=== Cleanup ===');
  // Delete test users via admin — need an actual admin token
  // Since we can't promote via API without an existing admin, we skip DB-level cleanup
  console.log('ℹ️  Cleanup: manually remove test users (testuser, adminuser) from tasks.db if needed\n');
}

run().catch(err => console.error('Fatal:', err));
