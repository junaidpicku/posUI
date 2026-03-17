import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ThemeLangBar from '../components/ThemeLangBar';
import { useLang } from '../context/LangContext';
import './OrderStatus.css';

const safeJSONParse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };
function formatCurrency(n) {
  try { const c = safeJSONParse(localStorage.getItem('userData'), {})?.guest?.currency_symbol || '₹'; return `${c} ${Number(n || 0).toFixed(2)}`; }
  catch { return `₹ ${Number(n || 0).toFixed(2)}`; }
}

const STATUS_ORDER = ['received', 'preparing', 'packing', 'out_for_delivery', 'delivered'];

function buildStages(currentStatus) {
  return [
    { id: 'received',          title: 'Order Received',    description: 'Your order has been confirmed and payment processed',   icon: '✓'  },
    { id: 'preparing',         title: 'In Preparation',    description: 'Our chefs are preparing your delicious meal',            icon: '👨‍🍳' },
    { id: 'packing',           title: 'In Packing',        description: 'Your order is being carefully packed for delivery',       icon: '📦' },
    { id: 'out_for_delivery',  title: 'Out for Delivery',  description: 'Your order is on its way to your room',                  icon: '🚴‍♂️' },
    { id: 'delivered',         title: 'Delivered',         description: 'Your order has been delivered to your room',             icon: '🎉' },
  ].map(stage => {
    const ci = STATUS_ORDER.indexOf(currentStatus);
    const si = STATUS_ORDER.indexOf(stage.id);
    return { ...stage, completed: si < ci, active: stage.id === currentStatus };
  });
}

function getStatusTime(stage, orderData) {
  if (!orderData) return '';
  const orderTime = new Date(orderData.timestamp);
  const addMin = m => new Date(orderTime.getTime() + m * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const map = { received: () => orderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), preparing: () => addMin(5), packing: () => addMin(20), out_for_delivery: () => addMin(25), delivered: () => addMin(40) };
  const fn = map[stage.id];
  if (!fn) return '';
  const time = fn();
  if (!stage.completed && !stage.active) return stage.id === 'delivered' ? `Expected: ${time}` : 'Pending';
  return time;
}

export default function OrderStatus() {
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState(null);
  const [currentStatus, setCurrentStatus] = useState('preparing');
  const [showTracking, setShowTracking] = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const { t } = useLang();
  const intervalRef = useRef(null);

  // ── mirrors DOMContentLoaded ──────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('currentOrder');
    if (!stored) {
      // No active order — redirect to history page to show past orders
      navigate('/history');
      return;
    }
    const order = safeJSONParse(stored, null);
    if (!order) { navigate('/history'); return; }

    const orderTime = new Date(order.timestamp);
    const hoursDiff = (new Date() - orderTime) / 3600000;
    if (hoursDiff > 2) setCurrentStatus('delivered');

    setOrderData(order);
  }, [navigate]);

  // ── mirrors startStatusUpdates ────────────────────────────────────────
  useEffect(() => {
    if (!orderData) return;
    intervalRef.current = setInterval(() => {
      const orderTime = new Date(orderData.timestamp);
      const mins = Math.floor((new Date() - orderTime) / 60000);
      setCurrentStatus(prev => {
        if (prev === 'delivered') { clearInterval(intervalRef.current); return prev; }
        if (mins >= 35) return 'delivered';
        if (mins >= 25 && prev === 'preparing') return 'packing';
        if (mins >= 20 && prev === 'packing') return 'out_for_delivery';
        return prev;
      });
    }, 10000);
    return () => clearInterval(intervalRef.current);
  }, [orderData]);

  function refreshStatus() { /* triggers re-render via state */ setCurrentStatus(s => s); }

  function confirmDelivery() {
    const updated = { ...orderData, deliveryConfirmed: true };
    localStorage.setItem('currentOrder', JSON.stringify(updated));
    setOrderData(updated);
    setTimeout(() => navigate('/success'), 2000);
  }

  function viewReceipt() {
    if (!orderData) return;
    const lines = [`HotelOGIX Receipt\n${'='.repeat(40)}`, `Order #: ${orderData.orderId}`, `Date: ${new Date(orderData.timestamp).toLocaleString()}`];
    orderData.items?.forEach(it => lines.push(`${it.name} x${it.quantity} - ${formatCurrency(it.price * it.quantity)}`));
    lines.push(`\nTotal: ${formatCurrency(orderData.total)}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `receipt-${orderData.orderId}.txt`; a.click();
  }

  function contactSupport() {
    const msg = encodeURIComponent(`Hi, I need help with my order #${orderData?.orderId}.`);
    window.open(`https://wa.me/919876543210?text=${msg}`, '_blank');
  }

  function getEstimated() {
    if (!orderData) return null;
    const est = new Date(new Date(orderData.timestamp).getTime() + 40 * 60000);
    const remaining = Math.max(0, Math.ceil((est - new Date()) / 60000));
    return { time: est.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), remaining };
  }

  if (!orderData) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div className="os-spinner" /></div>;

  const stages = buildStages(currentStatus);
  const estimation = getEstimated();
  const userData = safeJSONParse(localStorage.getItem('userData'), {});

  return (
    <div className="container">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {/* Header */}
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button className="page-hamburger" onClick={() => setSidebarOpen(true)}><span /><span /><span /></button>
          <button className="back-btn" onClick={() => navigate('/success')}>←</button>
        </div>
        <img src="https://www.hotelogix.com/wp-content/themes/hotelogix/images/hotelogix-logo.svg" alt="HotelOGIX Logo" className="header-logo" style={{ width: 50 }} />
        <div className="nav-icons">
          <ThemeLangBar compact={true} />
          <button className="nav-icon" onClick={refreshStatus} title="Refresh">🔄</button>
          <button className="nav-icon" onClick={() => navigate('/menu')} title="Home">🏠</button>
        </div>
      </div>

      <div className="order-status-page">

        {/* Order Info Card */}
        <div className="order-info">
          <div className="order-id-badge">Order #{orderData.orderId}</div>
          <div className="order-meta">
            <span>Room {userData?.guest?.guestRoomId || userData?.roomNumber || '—'}</span>
            <span>•</span>
            <span>{new Date(orderData.timestamp).toLocaleString()}</span>
          </div>
          <div className="order-total-display">
            Total: <strong>{formatCurrency(orderData.total)}</strong>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="status-timeline">
          <div className="timeline-list">
            {stages.map(stage => (
              <div key={stage.id} className={`timeline-item ${stage.completed ? 'completed' : ''} ${stage.active ? 'active' : ''}`}>
                <div className="timeline-icon">{stage.completed ? '✓' : stage.icon}</div>
                <div className="status-details">
                  <div className="status-title">{stage.title}</div>
                  <div className="status-time">{getStatusTime(stage, orderData)}</div>
                  <div className="status-description">{stage.description}</div>
                  {stage.id === 'out_for_delivery' && stage.active && (
                    <button className="view-map-btn" onClick={() => setShowTracking(true)}>View Live Tracking</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Estimation */}
        <div className={`delivery-estimation ${currentStatus === 'delivered' ? 'delivered' : ''}`}>
          {currentStatus === 'delivered' ? (
            <div>✅ <strong>Order Delivered Successfully!</strong><div>Thank you for choosing HotelOGIX. Enjoy your meal! 🎉</div></div>
          ) : estimation && estimation.remaining > 0 ? (
            <div>⏰ <strong>Estimated delivery in {estimation.remaining} minutes</strong><div className="countdown">Arriving by {estimation.time}</div></div>
          ) : (
            <div>🚀 <strong>Your order should arrive any moment now!</strong><div className="countdown">Please be ready to receive your order</div></div>
          )}
        </div>

        {/* Order Items */}
        <div className="order-items-summary">
          <h3>🍽️ Your Order ({orderData.items?.length || 0} items)</h3>
          {orderData.items?.map((item, i) => (
            <div key={i} className="order-item">
              <div className="item-details">
                <div className="item-name">{item.name}</div>
                {item.customization && Object.keys(item.customization).length > 0 && (
                  <div className="item-customization">
                    {[item.customization.spiceLevel && `Spice: ${item.customization.spiceLevel}`, item.customization.specialInstructions].filter(Boolean).join(' • ')}
                  </div>
                )}
              </div>
              <div className="item-quantity-price">
                <div>Qty: {item.quantity}</div>
                <div><strong>{formatCurrency(item.price * item.quantity)}</strong></div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button className="secondary-btn" onClick={contactSupport}>Contact Support</button>
          <button className="secondary-btn" onClick={viewReceipt}>View Receipt</button>
        </div>

        {/* Confirm Delivery */}
        {currentStatus === 'delivered' && (
          <button className="confirm-delivery-btn" onClick={confirmDelivery}>Confirm Delivery Received</button>
        )}
      </div>

      {/* Tracking Popup */}
      {showTracking && (
        <div className="popup-overlay show" onClick={e => { if (e.target.className.includes('popup-overlay')) setShowTracking(false); }}>
          <div className="popup tracking-popup">
            <h3>Live Order Tracking</h3>
            <div className="tracking-map">
              <div className="map-placeholder">
                <div className="delivery-icon">🚴‍♂️</div>
                <div className="location-pins">
                  <div className="pin restaurant-pin">🏨</div>
                  <div className="pin customer-pin">📍</div>
                </div>
              </div>
              <div className="tracking-info">
                <p><strong>Delivery Partner:</strong> John D.</p>
                <p><strong>Contact:</strong> +91 98765 43210</p>
                <p><strong>ETA:</strong> {estimation?.remaining ? `${estimation.remaining} minutes` : 'Any moment now'}</p>
              </div>
            </div>
            <div className="popup-buttons">
              <button className="popup-btn primary" onClick={() => setShowTracking(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
