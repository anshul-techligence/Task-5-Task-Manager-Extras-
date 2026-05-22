//  routing
const authPage= document.getElementById('auth-page');
const appPage  = document.getElementById('app-page');

function showAuth(){
  authPage.classList.remove('hidden');
  appPage.classList.add('hidden');
}

function showApp() {
  authPage.classList.add('hidden');
  appPage.classList.remove('hidden');
}

function saveToken(token) { localStorage.setItem('tf_token', token); }
function getToken()  { return localStorage.getItem('tf_token'); }
function clearToken() { localStorage.removeItem('tf_token'); localStorage.removeItem('tf_user'); }
function saveUser(user){ localStorage.setItem('tf_user', JSON.stringify(user)); }
function getUser() { try{ return JSON.parse(localStorage.getItem('tf_user')); } catch { return null; } }

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('login-form').classList.toggle('hidden', target !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', target !== 'register');
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('register-error').classList.add('hidden');
  });
});

// password
document.querySelectorAll('.pwd-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  });
});

//auth api
async function authRequest(endpoint, body) {
  const res = await fetch(`/api/auth/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.querySelector('.btn-text').classList.toggle('hidden', loading);
  btn.querySelector('.btn-spinner').classList.toggle('hidden', !loading);
  btn.disabled = loading;
}

function showAuthError(formId, msg) {
  const el = document.getElementById(`${formId}-error`);
  el.textContent = msg;
  el.classList.remove('hidden');
}

// login
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('login-error').classList.add('hidden');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return showAuthError('login', 'All fields are required');

  setLoading('login-btn', true);
  const data = await authRequest('login', { email, password }).catch(() => ({ error: 'Network error' }));
  setLoading('login-btn', false);

  if (data.error) return showAuthError('login', data.error);
  saveToken(data.token);
  saveUser(data.user);
  showApp();
  window.initApp?.();
});

// register user
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('register-error').classList.add('hidden');
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!username || !email || !password) return showAuthError('register', 'All fields are required');

  setLoading('register-btn', true);
  const data = await authRequest('register', { username, email, password }).catch(() => ({ error: 'Network error' }));
  setLoading('register-btn', false);

  if (data.error) return showAuthError('register', data.error);
  saveToken(data.token);
  saveUser(data.user);
  showApp();
  window.initApp?.();
});

// logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  const token = getToken();
  if (token) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
  }
  clearToken();
  showAuth();
});


(async () => {
  const token = getToken();
  if (!token) return showAuth();


  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  }).catch(() => null);

  if (res?.ok) {
    const user = await res.json();
    saveUser(user);
    showApp();
    window.initApp?.();
  } else {
    clearToken();
    showAuth();
  }
})();

window.getToken = getToken;
window.getUser  = getUser;
window.showAuth = showAuth;
