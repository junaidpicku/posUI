// Enhanced Common JavaScript Functions - mirrors original common.js

// Session timeout: 5 minutes for room login, 20 minutes for table login
export function getSessionTimeoutMs() {
  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.isTableBased) return 20 * 60 * 1000; // 20 minutes for table
  } catch {}
  return 20 * 60 * 1000; // 5 minutes for room
}
export const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // default fallback
export const ACTIVITY_CHECK_INTERVAL = 10 * 1000; // Check every 10 seconds

export function updateLastActivity() {
  const sessionData = JSON.parse(localStorage.getItem('sessionData') || '{}');
  if (sessionData.loginTime) {
    sessionData.lastActivity = new Date().toISOString();
    localStorage.setItem('sessionData', JSON.stringify(sessionData));
  }
}

export function checkSessionTimeout() {
  if (window.isLoginInProgress) return true;

  const sessionData = JSON.parse(localStorage.getItem('sessionData') || '{}');

  if (!sessionData.loginTime || !sessionData.lastActivity) {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (!userData.token) return true;
    performAutoLogout('Session not found');
    return false;
  }

  const lastActivity = new Date(sessionData.lastActivity);
  const now = new Date();
  const inactiveTime = now - lastActivity;
  const timeout = getSessionTimeoutMs();

  if (inactiveTime > timeout) {
    performAutoLogout('Session expired due to inactivity');
    return false;
  }

  return true;
}

export function performAutoLogout(reason = 'Session expired') {
  console.log('Auto logout:', reason);
  const path = window.location.pathname;
  if (
    path.includes('login') ||
    path === '/' ||
    path.endsWith('index') ||
    window.isLoginInProgress
  ) return;

  localStorage.clear();
  showTimeoutModal(reason);
}

export function showTimeoutModal(reason) {
  const existing = document.getElementById('timeoutModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'timeoutModal';
  modal.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.8);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999;
  `;
  modal.innerHTML = `
    <div style="background: white; padding: 40px 30px; border-radius: 20px; text-align: center; max-width: 400px; width: 90%;">
      <div style="font-size: 3rem; margin-bottom: 15px;">⏰</div>
      <h2 style="color: #333; margin-bottom: 10px;">Session Expired</h2>
      <p style="color: #666; margin-bottom: 25px;">${reason}. Please login again to continue.</p>
      <button onclick="window.location.href='/'" style="
        background: #4A90E2; color: white; border: none;
        padding: 12px 30px; border-radius: 8px; font-size: 16px;
        font-weight: 600; cursor: pointer;
      ">Login Again</button>
    </div>
  `;
  document.body.appendChild(modal);
}

export function showNotification(message, type = 'info') {
  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    padding: 15px 20px; border-radius: 12px;
    z-index: 9999; box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    animation: slideInRight 0.3s ease;
    max-width: 350px; font-family: 'Segoe UI', sans-serif; font-size: 14px;
    color: white;
    background: ${
      type === 'success' ? 'linear-gradient(135deg, #28a745, #20c997)' :
      type === 'error'   ? 'linear-gradient(135deg, #dc3545, #c82333)' :
      type === 'warning' ? 'linear-gradient(135deg, #ffc107, #fd7e14)' :
                           'linear-gradient(135deg, #17a2b8, #138496)'
    };
  `;
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

export function startSessionWatcher(navigate) {
  const interval = setInterval(() => {
    const valid = checkSessionTimeout();
    if (!valid) clearInterval(interval);
  }, ACTIVITY_CHECK_INTERVAL);

  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  activityEvents.forEach(event =>
    document.addEventListener(event, updateLastActivity, true)
  );

  return () => {
    clearInterval(interval);
    activityEvents.forEach(event =>
      document.removeEventListener(event, updateLastActivity, true)
    );
  };
}