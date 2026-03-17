import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeLangBar from '../components/ThemeLangBar';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import './History.css';

const safeParse = (s, fb = []) => { try { return JSON.parse(s); } catch { return fb; } };

function fc(n) {
  try { const c = safeParse(localStorage.getItem('userData'), {})?.guest?.currency_symbol || '₹'; return `${c}${(Number(n) || 0).toFixed(2)}`; }
  catch { return `₹${(Number(n) || 0).toFixed(2)}`; }
}
function dt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d)) return '—';
  const now = new Date();
  const diff = now - d;
  if (diff < 60000)   return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000)return `${Math.floor(diff/3600000)}h ago`;
  return d.toLocaleDateString([], { day:'2-digit', month:'short' }) + ' ' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}
function statusColor(s) {
  const st = (s||'').toLowerCase();
  if (st==='delivered') return { bg:'rgba(34,197,94,0.12)',  color:'#16a34a', label:'✓ Delivered' };
  if (st==='confirmed') return { bg:'rgba(59,130,246,0.12)', color:'#2563eb', label:'✓ Confirmed' };
  if (st==='preparing') return { bg:'rgba(245,166,35,0.15)', color:'#d97706', label:'🍳 Preparing' };
  if (st==='cancelled') return { bg:'rgba(239,68,68,0.12)',  color:'#dc2626', label:'✕ Cancelled' };
  return { bg:'rgba(107,114,128,0.12)', color:'#6b7280', label: s || 'Pending' };
}

export default function History() {
  const navigate = useNavigate();
  const { t }    = useLang();
  const { isDark } = useTheme();
  const [orders, setOrders]           = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Reorder: load items from a past order into cart and go to cart page
  function reorderToCart(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) return;
    const cartItems = items.map(it => ({
      id: it.id || it.productId || `reorder-${Date.now()}-${Math.random()}`,
      name: it.name || it.productName || 'Item',
      price: Number(it.price) || 0,
      image: it.image || '',
      quantity: Number(it.quantity) || 1,
      customization: it.customization || {},
      outlet: it.outlet || localStorage.getItem('selectedOutlet') || '',
      outletName: it.outletName || '',
      pos_id: it.pos_id || '',
      requiresAdvancePayment: it.requiresAdvancePayment || false,
      taxes: it.taxes || []
    }));
    localStorage.setItem('cartData', JSON.stringify(cartItems));
    navigate('/cart');
  }

  useEffect(() => {
    const raw = safeParse(localStorage.getItem('orderHistory'), []);
    const parsed = Array.isArray(raw) ? raw : [];
    parsed.sort((a,b) => (Date.parse(b?.timestamp||'')||0) - (Date.parse(a?.timestamp||'')||0));
    setOrders(parsed);
  }, []);

  const total = orders.reduce((s,o) => s + (Number(o.total)||0), 0);

  return (
    <div className={`hist-page ${isDark?'dark':''}`}>

      {/* ── HEADER ── */}
      <header className="hist-hdr">
        <button className="hist-back" onClick={() => navigate('/menu')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6"/></svg>
        </button>
        <h1 className="hist-hdr-title">Order History</h1>
        <div className="hist-hdr-right">
          <ThemeLangBar compact={true} />
        </div>
      </header>

      {/* ── SUMMARY CARD ── */}
      {orders.length > 0 && (
        <div className="hist-summary-card">
          <div className="hist-sum-item">
            <span className="hist-sum-val">{orders.length}</span>
            <span className="hist-sum-lbl">Orders</span>
          </div>
          <div className="hist-sum-divider" />
          <div className="hist-sum-item">
            <span className="hist-sum-val">{fc(total)}</span>
            <span className="hist-sum-lbl">Total Spent</span>
          </div>
          <div className="hist-sum-divider" />
          <div className="hist-sum-item">
            <span className="hist-sum-val">
              {orders.filter(o => (o.status||'').toLowerCase() === 'confirmed').length}
            </span>
            <span className="hist-sum-lbl">Confirmed</span>
          </div>
        </div>
      )}

      {/* ── ORDERS LIST ── */}
      <div className="hist-list">
        {orders.length === 0 ? (
          <div className="hist-empty">
            <div className="hist-empty-icon">📋</div>
            <h3>No orders yet</h3>
            <p>Your order history will appear here</p>
            <button className="hist-empty-btn" onClick={() => navigate('/menu')}>
              Browse Menu
            </button>
          </div>
        ) : (
          orders.map((o, i) => {
            const items = Array.isArray(o.items) ? o.items : [];
            const firstItems = items.slice(0,2).map(it => it?.name||'Item').join(', ');
            const extra = items.length > 2 ? ` +${items.length-2} more` : '';
            const sc = statusColor(o.status);
            const pmsId = o.pmsOrderIds?.[0] || o.orderId || '—';
            return (
              <div key={i} className="hist-card" onClick={() => setSelectedOrder(o)}>
                <div className="hist-card-top">
                  <div className="hist-card-id">#{pmsId.length > 14 ? pmsId.slice(-12) : pmsId}</div>
                  <span className="hist-status-pill" style={{ background: sc.bg, color: sc.color }}>
                    {sc.label}
                  </span>
                </div>
                <div className="hist-card-items">{firstItems}{extra}</div>
                <div className="hist-card-bottom">
                  <span className="hist-card-time">{dt(o.timestamp)}</span>
                  <span className="hist-card-total">{fc(o.total)}</span>
                </div>
                <button className="hist-card-reorder" onClick={e => { e.stopPropagation(); reorderToCart(o); }}>
                  🔄 Reorder / Modify
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="hist-actions">
        <button className="hist-act-btn" onClick={() => navigate('/menu')}>
          🍴 Order Again
        </button>
        <button className="hist-act-btn hist-act-btn--ghost" onClick={() => alert('Support: +91 98765 43210')}>
          📞 Support
        </button>
      </div>

      {/* ── ORDER DETAIL BOTTOM SHEET ── */}
      {selectedOrder && (
        <>
          <div className="hist-sheet-backdrop" onClick={() => setSelectedOrder(null)} />
          <div className="hist-sheet">
            <div className="hist-sheet-handle"><div className="hist-sheet-bar" /></div>
            <div className="hist-sheet-header">
              <h2 className="hist-sheet-title">Order Details</h2>
              <button className="hist-sheet-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>
            <div className="hist-sheet-body">
              <OrderSheet order={selectedOrder} fc={fc} dt={dt} statusColor={statusColor} />
              <button className="hist-act-btn" style={{ width:'100%', marginTop: 12 }} onClick={() => { setSelectedOrder(null); reorderToCart(selectedOrder); }}>
                🔄 Reorder / Modify This Order
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function OrderSheet({ order, fc, dt, statusColor }) {
  const items   = Array.isArray(order.items) ? order.items : [];
  const subtotal = Number(order?.subtotal) || 0;
  const taxes    = Number(order?.taxes) || 0;
  const delivery = Number(order?.deliveryFee) || 0;
  const total    = Number(order?.total) || (subtotal + taxes + delivery);
  const sc       = statusColor(order.status);
  const pmsId    = order.pmsOrderIds?.[0] || order.orderId || '—';

  return (
    <div className="hist-sheet-content">
      {/* Order meta */}
      <div className="hist-sheet-meta">
        <div className="hist-sheet-meta-row">
          <span className="hist-sheet-meta-lbl">Order ID</span>
          <span className="hist-sheet-meta-val" style={{ fontFamily:'monospace', fontSize:12 }}>{pmsId}</span>
        </div>
        <div className="hist-sheet-meta-row">
          <span className="hist-sheet-meta-lbl">Date & Time</span>
          <span className="hist-sheet-meta-val">{dt(order.timestamp)}</span>
        </div>
        <div className="hist-sheet-meta-row">
          <span className="hist-sheet-meta-lbl">Status</span>
          <span className="hist-status-pill" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
        </div>
      </div>

      {/* Items */}
      <div className="hist-sheet-section">
        <h3 className="hist-sheet-section-title">Items Ordered</h3>
        {items.map((item, i) => (
          <div key={i} className="hist-sheet-item">
            <div className="hist-sheet-item-left">
              <div className="hist-sheet-item-name">{item?.name || 'Item'}</div>
              <div className="hist-sheet-item-price">{fc(item?.price)} × {item?.quantity || 1}</div>
            </div>
            <div className="hist-sheet-item-total">
              {fc((Number(item?.price)||0) * (Number(item?.quantity)||1))}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="hist-sheet-section hist-sheet-summary">
        <div className="hist-sheet-sum-row"><span>Subtotal</span><span>{fc(subtotal)}</span></div>
        {delivery > 0 && <div className="hist-sheet-sum-row"><span>Delivery Fee</span><span>{fc(delivery)}</span></div>}
        {taxes > 0 && <div className="hist-sheet-sum-row"><span>Taxes</span><span>{fc(taxes)}</span></div>}
        <div className="hist-sheet-sum-row hist-sheet-sum-total">
          <span>Total</span>
          <span>{fc(total)}</span>
        </div>
      </div>
    </div>
  );
}