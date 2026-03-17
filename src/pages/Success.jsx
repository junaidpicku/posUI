import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE from '../config';
import Sidebar from '../components/Sidebar';
import ThemeLangBar from '../components/ThemeLangBar';
import { useLang } from '../context/LangContext';
import './Success.css';

const safeJSONParse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };

async function authenticatedFetch(url, options = {}) {
  const userData = safeJSONParse(localStorage.getItem('userData'), {});
  const token = userData.token;
  if (!token) throw new Error('No authentication token found');
  return fetch(url, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
}

function groupItemsByPosId(items) {
  // Get pos_id from stored outlet as fallback
  const outletRaw = (() => { try { return JSON.parse(localStorage.getItem('outlet') || '{}'); } catch { return {}; } })();
  const fallbackPosId = outletRaw?.pos_id || '';

  const grouped = {};
  items.forEach(item => {
    // Use item's pos_id, then outlet's pos_id — never "unknown"
    const posId = (item.pos_id && item.pos_id !== 'unknown' && item.pos_id !== '')
      ? item.pos_id
      : fallbackPosId || String(item.outlet || '');
    if (!grouped[posId]) grouped[posId] = { pos_id: posId, outletName: item.outletName || `Outlet`, items: [] };
    grouped[posId].items.push(item);
  });
  return Object.values(grouped);
}

function getEstimatedDeliveryTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + Math.floor(Math.random() * 15) + 30);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function saveToOrderHistory(order) {
  try {
    let history = safeJSONParse(localStorage.getItem('orderHistory'), []);
    if (!Array.isArray(history)) history = [];
    history.unshift({ ...order, pmsOrderIds: order.pmsOrderIds || [] });
    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem('orderHistory', JSON.stringify(history));
  } catch (e) { console.error('Error saving history:', e); }
}

function cleanupOrderData() {
  ['currentOrder', 'neworder', 'cart', 'cartData'].forEach(k => localStorage.removeItem(k));
}

function createConfetti() {
  const colors = ['#4A90E2', '#28a745', '#ffd700', '#ff6b6b', '#6c5ce7'];
  for (let i = 0; i < 50; i++) {
    const c = document.createElement('div');
    c.style.cssText = `position:fixed;width:10px;height:10px;background:${colors[i % colors.length]};top:-10px;left:${Math.random() * 100}vw;z-index:9999;border-radius:50%;animation:confetti-fall ${Math.random() * 3 + 2}s linear forwards;`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }
}

export default function Success() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [phase, setPhase] = useState('loading'); // loading | success | failure | error | authError
  const [results, setResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('currentOrder');
    const orderData = safeJSONParse(raw, null);

    if (!orderData?.items?.length) { setPhase('error'); setErrorMsg('No order found'); return; }

    const userRaw   = safeJSONParse(localStorage.getItem('userData'), {});
    const outletRaw = safeJSONParse(localStorage.getItem('outlet'), {});

    // ── roomId: use the ENCODED guestRoomId from guest object (e.g. "TWNuTzNZNmpPWXc9")
    // NOT the plain room number "301"
    const roomNum = userRaw?.guest?.guestRoomId
                 || userRaw?.guest?.room
                 || orderData?.userData?.roomId
                 || orderData?.userData?.roomNumber;

    const hotelId   = orderData?.userData?.hotelId || localStorage.getItem('hotel_id') || '1';
    const tableType = userRaw?.guest?.type || 'room';

    // ── shiftStatusId: prod sends "" — match exactly
    const shiftStatusId = '';

    // ── pos_id: get from stored outlet (most reliable source)
    const outletPosId = outletRaw?.pos_id
                     || orderData?.items?.[0]?.pos_id
                     || '';

    const groups = groupItemsByPosId(orderData.items);

    const promises = groups.map(group => {
      // Use outlet pos_id if group.pos_id is "unknown" or empty
      const resolvedPosId = (group.pos_id && group.pos_id !== 'unknown')
        ? group.pos_id
        : outletPosId;

      let payload = {
        hotel_id: hotelId,
        pos_id: resolvedPosId,           // ← fixed: uses real pos_id not "unknown"
        suggestion: '',
        shiftStatusId: shiftStatusId,    // ← fixed: matches prod "" 
        items: group.items.map((it, idx) => ({
          productId: String(it.id ?? idx + 1),
          productName: it.name || `Item ${idx + 1}`,
          outlet: it.outlet || '',
          outletName: it.outletName || '',
          pos_id: it.pos_id || resolvedPosId,
          unit: Number(it.quantity) || 1,
          suggestion: it.customization?.notes || it.customization?.specialInstructions || '',
          servingOrder: idx + 1
        })),
        roomId: roomNum,                 // ← fixed: uses encoded guestRoomId
        type: tableType
      };
      if (tableType === 'table') { payload.roomId = ''; payload.tableId = roomNum; }

      return authenticatedFetch(`${API_BASE}/api/pms/orders`, { method: 'POST', body: JSON.stringify(payload) })
        .then(r => r.json().then(data => ({ success: r.ok, pos_id: group.pos_id, outletName: group.outletName, orderId: data.orderId, data })))
        .catch(err => {
          if (err.message.includes('authentication') || err.message.includes('token')) { setPhase('authError'); return null; }
          return { success: false, pos_id: group.pos_id, outletName: group.outletName, error: err.message };
        });
    });

    Promise.all(promises).then(res => {
      const filtered = res.filter(r => r !== null);
      if (!filtered.length) return;
      setResults(filtered);
      const allOk = filtered.every(r => r.success);
      if (allOk) {
        orderData.status = 'confirmed';
        orderData.pmsOrderIds = filtered.map(r => r.orderId);
        saveToOrderHistory(orderData);
        cleanupOrderData();
        createConfetti();
        setPhase('success');
      } else {
        setPhase('failure');
      }
    }).catch(err => {
      if (err.message?.includes('authentication') || err.message?.includes('token')) { setPhase('authError'); }
      else { setPhase('error'); setErrorMsg('Failed to place order. Please contact the front desk.'); }
    });
  }, []);

  function handleSessionExpired() {
    const hotelId = localStorage.getItem('hotel_id');
    const roomNumber = localStorage.getItem('roomNumber');
    localStorage.clear();
    if (hotelId) localStorage.setItem('hotel_id', hotelId);
    if (roomNumber) localStorage.setItem('roomNumber', roomNumber);
    navigate(`/preferences?hotel_id=${hotelId}&room=${roomNumber}`);
  }

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="pms-loader-overlay">
        <div className="pms-loader-box">
          <div className="pms-spinner" />
          <h3>Confirming your order...</h3>
          <p>Please wait while we process your request</p>
        </div>
      </div>
    );
  }

  // ── AUTH ERROR ────────────────────────────────────────────────────────────
  if (phase === 'authError') {
    return (
      <div className="success-modal-overlay">
        <div className="success-modal-box">
          <div className="success-modal-icon">🔒</div>
          <h2 style={{ color: '#dc3545' }}>Session Expired</h2>
          <p>Your session has expired. Please login again to continue.</p>
          <div className="success-warning-box">You will be redirected to the login page</div>
          <button className="success-primary-btn" onClick={handleSessionExpired}>Login Again</button>
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="success-modal-overlay">
        <div className="success-modal-box">
          <div className="success-modal-icon">❌</div>
          <h2 style={{ color: '#dc3545' }}>Order Failed</h2>
          <p>{errorMsg || 'Something went wrong.'}</p>
          <div className="success-warning-box">Please contact the front desk for more information</div>
          <button className="success-primary-btn" onClick={() => navigate('/menu')}>Back to Menu</button>
        </div>
      </div>
    );
  }

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <div className="container">
        <div className="header">
          <button className="back-btn" onClick={() => navigate('/menu')}>🏠</button>
          <img src="https://www.hotelogix.com/wp-content/themes/hotelogix/images/hotelogix-logo.svg" alt="HotelOGIX Logo" className="header-logo" style={{ width: 50 }} />
          <div className="nav-icons"><ThemeLangBar compact={true} /></div>
        </div>

        <div className="success-modal-overlay">
          <div className="success-modal-box" style={{ maxWidth: 500 }}>
            <div className="success-modal-icon">✅</div>
            <h2 style={{ color: '#28a745' }}>Order Successful!</h2>
            <p>Your orders have been placed successfully</p>

            <div className="success-orders-list">
              {results.map((r, i) => (
                <div key={i} className="success-order-row">
                  <span>📍 {r.outletName}</span>
                  <span style={{ color: '#28a745', fontWeight: 600 }}>✓ Order #{r.orderId}</span>
                </div>
              ))}
            </div>

            <div className="success-delivery-box">
              <strong>Estimated Delivery:</strong> {getEstimatedDeliveryTime()}
            </div>

            <button className="success-primary-btn" onClick={() => navigate('/menu')}>Back to Menu</button>
            <button className="success-secondary-btn" onClick={() => navigate('/history')}>View Order History</button>
          </div>
        </div>
      </div>
    );
  }

  // ── FAILURE ───────────────────────────────────────────────────────────────
  const failedOrders = results.filter(r => !r.success);
  const successOrders = results.filter(r => r.success);

  return (
    <div className="success-modal-overlay">
      <div className="success-modal-box">
        <div className="success-modal-icon">⚠️</div>
        <h2 style={{ color: '#dc3545' }}>Order Failed</h2>
        <p>Some orders could not be processed</p>

        <div className="success-orders-list">
          {failedOrders.map((r, i) => (
            <div key={i} className="success-failed-row">
              <div style={{ fontWeight: 600 }}>❌ {r.outletName}</div>
              <div style={{ fontSize: '0.9rem', marginTop: 5 }}>Failed to place order</div>
            </div>
          ))}
          {successOrders.length > 0 && (
            <>
              <h4 style={{ color: '#28a745', margin: '16px 0 8px' }}>✓ Successful Orders:</h4>
              {successOrders.map((r, i) => (
                <div key={i} className="success-order-row">
                  <span>{r.outletName}</span>
                  <span>Order #{r.orderId}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="success-warning-box" style={{ background: '#f8d7da', color: '#721c24', borderColor: '#dc3545' }}>
          Please contact the front desk for more information
        </div>

        <button className="success-secondary-btn" onClick={() => navigate('/menu')}>Close</button>
        <button className="success-primary-btn" onClick={() => navigate('/menu')}>Back to Menu</button>
      </div>
    </div>
  );
}
