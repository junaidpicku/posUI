import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeLangBar from '../components/ThemeLangBar';
import { useTheme } from '../context/ThemeContext';
import { getCurrencySymbol } from '../utils/session';
import './Cart.css';

/* ─── helpers ──────────────────────────────── */
const safeJSON  = (s,fb) => { try{return JSON.parse(s);}catch{return fb;} };
const currency  = () => getCurrencySymbol();
const fmt       = n  => `${currency()} ${Number(n||0).toFixed(2)}`;

function getCartData() {
  for (const k of ['cartData','CartData','cart']) {
    const r = localStorage.getItem(k)?.trim();
    if (r && r!=='null') { const p=safeJSON(r,[]); if(Array.isArray(p)) return p; }
  }
  return [];
}
function saveCartData(arr) { localStorage.setItem('cartData', JSON.stringify(arr)); }

function sanitize(items) {
  if (!Array.isArray(items)) return [];
  return items.map(it => ({
    id: it?.id??'', name: it?.name??'Item', image: it?.image??'',
    category: it?.category??'', quantity: Number(it?.quantity)||1,
    price: Number(it?.price)||0, customization: it?.customization||{},
    outlet: it?.outlet??'', outletName: it?.outletName??'',
    pos_id: it?.pos_id??'', requiresAdvancePayment: !!it?.requiresAdvancePayment,
    taxes: Array.isArray(it?.taxes)?it.taxes:[]
  }));
}

function computeTotals(cart) {
  let subtotal = 0;
  const taxMap = new Map();
  cart.forEach(item => {
    const qty = Number(item.quantity)||1;
    subtotal += (Number(item.price)||0)*qty;
    (item.taxes||[]).forEach(t => {
      const rate = Number(t?.modifiedTaxRate??t?.taxRate)||0;
      const name = t?.taxName||t?.taxShortName||'Tax';
      const key  = `${name}|${rate}`;
      const amt  = +((Number(item.price)||0)*rate/100*qty).toFixed(2);
      taxMap.set(key, +((taxMap.get(key)||0)+amt).toFixed(2));
    });
  });
  const taxBreakdown = [...taxMap.entries()].map(([k,a])=>{const[n,r]=k.split('|');return{name:n,rate:Number(r),amount:a};});
  const taxTotal = +taxBreakdown.reduce((s,x)=>s+x.amount,0).toFixed(2);
  return { subtotal:+subtotal.toFixed(2), taxBreakdown, taxTotal, total:+(subtotal+taxTotal).toFixed(2) };
}

function generateOrderId() {
  return `HX${Date.now().toString().slice(-6)}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
}

/* ─── Recommendation Card ──────────────────── */
function RecommendationCard({ item, onAdd, inCart }) {
  const cur = currency();
  return (
    <div className="rec-card">
      <div className="rec-card__img" style={{ backgroundImage: item.image?`url('${item.image}')`:'' }}>
        {!item.image && <span>🍽️</span>}
        {inCart && <span className="rec-card__badge">✓</span>}
      </div>
      <div className="rec-card__body">
        <div className="rec-card__name">{item.name}</div>
        <div className="rec-card__price">{cur}{item.price}</div>
      </div>
      <button className="rec-card__btn" onClick={() => onAdd(item)} disabled={inCart}>
        {inCart ? '✓' : '+'}
      </button>
    </div>
  );
}

/* ─── CART PAGE ────────────────────────────── */
export default function Cart() {
  const navigate    = useNavigate();
  const { isDark }  = useTheme();
  const [cart, setCart]         = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    document.title = 'Cart — POS';
    setCart(sanitize(getCartData()));
    // Load menu items for recommendations
    const outlet = safeJSON(localStorage.getItem('outlet'),{});
    if (outlet?.menuItems) setMenuItems(outlet.menuItems);
  }, []);

  function sync(nc) { setCart(nc); saveCartData(nc); }

  function updateQty(idx, delta) {
    const nc = cart.map((c,i) => i===idx ? {...c, quantity: c.quantity+delta} : c).filter(c=>c.quantity>0);
    sync(nc);
  }

  function remove(idx) { sync(cart.filter((_,i)=>i!==idx)); }

  function clearCart() {
    if (!cart.length) return;
    if (window.confirm('Clear all items?')) sync([]);
  }

  function addRecommendation(item) {
    const nc = [...cart];
    const ex = nc.find(c => String(c.id)===String(item.id));
    if (ex) { ex.quantity++; } else {
      const o = safeJSON(localStorage.getItem('outlet'),{});
      nc.push({
        id:item.id, name:item.name, price:item.price, image:item.image,
        category:item.category||'', quantity:1, customization:{},
        outlet:localStorage.getItem('selectedOutlet')||'',
        outletName:o.name||'', pos_id:o.pos_id||'',
        requiresAdvancePayment:item.requiresAdvancePayment||false,
        taxes:item.taxes||[]
      });
    }
    sync(nc);
  }

  function placeOrder() {
    if (!cart.length) return;
    const userRaw = safeJSON(localStorage.getItem('userData'),{});
    const totals  = computeTotals(cart);
    const order   = {
      orderId: generateOrderId(), items:[...cart],
      subtotal: totals.subtotal, taxes: totals.taxTotal,
      taxesBreakdown: totals.taxBreakdown, deliveryFee: 0,
      total: totals.total, paymentMethod:'none',
      payLaterAmount:0, paidAmount:totals.total,
      timestamp: new Date().toISOString(), status:'pending',
      userData: {
        ...userRaw,
        selectedShift:  localStorage.getItem('selectedShift')||'',
        selectedOutlet: localStorage.getItem('selectedOutlet')||'',
        hotelId:        localStorage.getItem('hotel_id')||'',
        roomNumber:     localStorage.getItem('roomNumber')||'',
        roomId:         userRaw?.guest?.guestRoomId||localStorage.getItem('roomNumber')||'',
      }
    };
    localStorage.setItem('currentOrder', JSON.stringify(order));
    navigate('/success');
  }

  const totals = computeTotals(cart);
  const cartIds = new Set(cart.map(c => String(c.id)));
  // Recommendations: items not in cart, from same outlet
  const recommendations = menuItems.filter(m => !cartIds.has(String(m.id))).slice(0, 8);

  return (
    <div className={`cart-page-wrap ${isDark?'dark':''}`}>
      {/* ── HEADER ── */}
      <header className="cart-hdr">
        <button className="cart-hdr__back" onClick={() => navigate('/menu')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6"/></svg>
        </button>
        <img src="https://www.hotelogix.com/wp-content/themes/hotelogix/images/hotelogix-logo.svg" alt="HotelOGIX" className="cart-hdr__logo" onError={e=>e.target.style.display='none'} />
        <h1 className="cart-hdr__title">My Cart</h1>
        <div className="cart-hdr__right">
          <ThemeLangBar compact={true} />
          <button className="cart-hdr__hist" onClick={() => navigate('/history')} title="Order History">📋</button>
        </div>
      </header>

      <div className="cart-body">
        {/* ── CART ITEMS ── */}
        {cart.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty__icon">🛒</div>
            <h3>Your cart is empty</h3>
            <p>Go back to the menu and add some items</p>
            <button className="cart-empty__btn" onClick={() => navigate('/menu')}>← Back to Menu</button>
          </div>
        ) : (
          <>
            <div className="cart-section-title">
              <span>🛒 Your Items</span>
              <span className="cart-item-count">{cart.reduce((s,i)=>s+i.quantity,0)} items</span>
            </div>

            <div className="cart-items">
              {cart.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="cart-item">
                  <div className="cart-item__img" style={{ backgroundImage: item.image?`url('${item.image}')`:'' }}>
                    {!item.image && <span>🍽️</span>}
                  </div>
                  <div className="cart-item__info">
                    <div className="cart-item__name">{item.name}</div>
                    {item.category && <div className="cart-item__cat">📂 {item.category}</div>}
                    {item.outletName && <div className="cart-item__outlet">📍 {item.outletName}</div>}
                    {(item.customization?.notes||item.customization?.spice) && (
                      <div className="cart-item__custom">
                        {item.customization.spice && <span>🌶 {item.customization.spice}</span>}
                        {item.customization.notes && <span>📝 {item.customization.notes}</span>}
                      </div>
                    )}
                    {/* Taxes per item */}
                    {item.taxes?.length > 0 && (
                      <div className="cart-item__taxes">
                        {item.taxes.map((tx,ti) => {
                          const rate = Number(tx?.modifiedTaxRate??tx?.taxRate)||0;
                          const amt  = (Number(item.price)||0)*rate/100*item.quantity;
                          return <span key={ti} className="cart-item__tax-pill">{tx.taxName} {rate}% = {currency()}{amt.toFixed(2)}</span>;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="cart-item__right">
                    <div className="cart-item__price">{fmt(item.price * item.quantity)}</div>
                    <div className="cart-item__each">{fmt(item.price)} each</div>
                    <div className="cart-item__qty">
                      <button onClick={() => updateQty(idx,-1)}>−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQty(idx,1)}>+</button>
                    </div>
                    <button className="cart-item__remove" onClick={() => remove(idx)}>✕ Remove</button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── ORDER SUMMARY ── */}
            <div className="cart-summary">
              <h3 className="cart-summary__title">💰 Order Summary</h3>
              <div className="cart-summary__row"><span>Subtotal ({cart.reduce((s,i)=>s+i.quantity,0)} items)</span><span>{fmt(totals.subtotal)}</span></div>
              {totals.taxBreakdown.map((tb,i) => (
                <div key={i} className="cart-summary__row cart-summary__row--tax">
                  <span>{tb.name} ({tb.rate}%)</span><span>{fmt(tb.amount)}</span>
                </div>
              ))}
              {!totals.taxBreakdown.length && <div className="cart-summary__row cart-summary__row--tax"><span>Taxes</span><span>{fmt(0)}</span></div>}
              <div className="cart-summary__row"><span>Delivery Fee</span><span>{fmt(0)}</span></div>
              <div className="cart-summary__row cart-summary__row--tax-total"><span>Total Taxes</span><span>{fmt(totals.taxTotal)}</span></div>
              <div className="cart-summary__row cart-summary__row--total"><span>Total Amount</span><span>{fmt(totals.total)}</span></div>

              <button className="cart-place-btn" onClick={placeOrder}>
                Place Order — {fmt(totals.total)}
              </button>
              <button className="cart-clear-btn" onClick={clearCart}>🗑 Clear Cart</button>
            </div>
          </>
        )}

        {/* ── RECOMMENDATIONS ── */}
        {recommendations.length > 0 && (
          <div className="cart-recs">
            <div className="cart-recs__title">
              <span>✨ You Might Also Like</span>
              <button className="cart-recs__menu-btn" onClick={() => navigate('/menu')}>View Full Menu →</button>
            </div>
            <div className="cart-recs__grid">
              {recommendations.map(item => (
                <RecommendationCard key={item.id} item={item}
                  inCart={cartIds.has(String(item.id))}
                  onAdd={addRecommendation}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}