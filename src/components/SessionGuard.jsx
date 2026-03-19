import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { isLoggedIn } from '../utils/session';
import { getSessionTimeoutMs, updateLastActivity, ACTIVITY_CHECK_INTERVAL } from '../utils/common';
import './SessionGuard.css';

/* ── Global session events ── */
export function triggerUnauthorized() {
  window.dispatchEvent(new CustomEvent('pos:unauthorized'));
}
export function triggerSessionExpired() {
  window.dispatchEvent(new CustomEvent('pos:session-expired'));
}

const PUBLIC_ROUTES = ['/', '/login', '/verify', '/preferences'];

/* ── Hard logout: clears storage + forces browser to / (survives refresh) ── */
function hardLogout() {
  localStorage.clear();
  window.location.replace('/');
}

/* ── Check idle time synchronously (used on page load/refresh) ── */
function isIdleExpired() {
  try {
    const sessionData = JSON.parse(localStorage.getItem('sessionData') || '{}');
    if (!sessionData.lastActivity) return false;
    const inactiveTime = Date.now() - new Date(sessionData.lastActivity).getTime();
    return inactiveTime > getSessionTimeoutMs();
  } catch { return false; }
}

/* ── SessionGuard wraps the whole app ── */
export default function SessionGuard({ children }) {
  const navigate = useNavigate();
  const [modal, setModal] = useState(null); // null | 'unauthorized' | 'expired' | 'timeout'
  const intervalRef = useRef(null);

  const handleUnauthorized = useCallback(() => setModal('unauthorized'), []);
  const handleExpired      = useCallback(() => setModal('expired'),      []);

  useEffect(() => {
    window.addEventListener('pos:unauthorized',   handleUnauthorized);
    window.addEventListener('pos:session-expired', handleExpired);
    return () => {
      window.removeEventListener('pos:unauthorized',   handleUnauthorized);
      window.removeEventListener('pos:session-expired', handleExpired);
    };
  }, [handleUnauthorized, handleExpired]);

  // ── On every mount/refresh: immediately check idle + auth ──────────────
  useEffect(() => {
    const path = window.location.pathname;
    if (PUBLIC_ROUTES.includes(path)) return;

    // Not logged in at all
    if (!isLoggedIn()) {
      hardLogout();
      return;
    }

    // Logged in but idle time already exceeded (e.g. user left tab open, came back)
    if (isIdleExpired()) {
      hardLogout();
      return;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inactivity interval watcher ────────────────────────────────────────
  useEffect(() => {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(evt =>
      document.addEventListener(evt, updateLastActivity, true)
    );

    intervalRef.current = setInterval(() => {
      if (window.isLoginInProgress) return;
      const path = window.location.pathname;
      if (PUBLIC_ROUTES.includes(path)) return;
      if (!isLoggedIn()) return;

      const sessionData = JSON.parse(localStorage.getItem('sessionData') || '{}');
      if (!sessionData.lastActivity) return;

      const inactiveTime = Date.now() - new Date(sessionData.lastActivity).getTime();
      const timeout = getSessionTimeoutMs();

      if (inactiveTime > timeout) {
        clearInterval(intervalRef.current);
        // Clear storage immediately, then show modal
        localStorage.clear();
        setModal('timeout');
      }
    }, ACTIVITY_CHECK_INTERVAL);

    return () => {
      clearInterval(intervalRef.current);
      activityEvents.forEach(evt =>
        document.removeEventListener(evt, updateLastActivity, true)
      );
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleGoToQR() {
    // Storage already cleared at timeout trigger; ensure cleared here too
    localStorage.clear();
    setModal(null);
    window.location.replace('/');
  }

  function handleContinue() {
    setModal(null);
    navigate(-1);
  }

  return (
    <>
      {children}
      {modal && (
        <div className="sg-overlay">
          <div className="sg-modal">
            {modal === 'timeout' && (
              <>
                <div className="sg-icon">⏱️</div>
                <h2 className="sg-title" style={{color:'#dc2626'}}>Session Timeout</h2>
                <p className="sg-msg">Session expired due to inactivity. You have been logged out for security reasons.</p>
                <div className="sg-qr-hint">Please scan the QR code again to continue</div>
                <div className="sg-actions">
                  <button className="sg-btn sg-btn--primary" onClick={handleGoToQR}>
                    Return to Scan QR
                  </button>
                </div>
              </>
            )}

            {modal === 'expired' && (
              <>
                <div className="sg-icon">⏱️</div>
                <h2 className="sg-title">Session Expired</h2>
                <p className="sg-msg">Your session has expired. Please scan the QR code again to continue.</p>
                <div className="sg-qr-hint">Please scan the QR code again to continue</div>
                <div className="sg-actions">
                  <button className="sg-btn sg-btn--primary" onClick={handleGoToQR}>
                    Return to Scan QR
                  </button>
                </div>
              </>
            )}

            {modal === 'unauthorized' && (
              <>
                <div className="sg-icon">🔒</div>
                <h2 className="sg-title">Access Denied</h2>
                <p className="sg-msg">You are not authorized to access this page.</p>
                <div className="sg-actions">
                  <button className="sg-btn sg-btn--primary" onClick={handleGoToQR}>
                    Return to Scan QR
                  </button>
                  <button className="sg-btn sg-btn--ghost" onClick={handleContinue}>
                    ← Go Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}