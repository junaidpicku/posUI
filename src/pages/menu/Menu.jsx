import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import API_BASE from '../../config';
import ThemeLangBar from '../../components/ThemeLangBar';
import { useLang } from '../../context/LangContext';
import { useTheme } from '../../context/ThemeContext';
import './Menu.css';

/* ─── helpers ──────────────────────────────────────────────── */
const safeJSON = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };
const getCurrency = () => { try { const u = safeJSON(localStorage.getItem('userData'),{}); return u?.guest?.currency_symbol||u?.currency_symbol||'₹'; } catch { return '₹'; }};
const getCartRaw  = () => { for(const k of ['cartData','CartData','cart']){const r=localStorage.getItem(k)?.trim(); if(r&&r!=='null'){const p=safeJSON(r,[]); if(Array.isArray(p)) return p;}} return []; };
const saveCart    = arr => localStorage.setItem('cartData', JSON.stringify(arr));
const authFetch   = (url, opts={}) => { const t=safeJSON(localStorage.getItem('userData'),{}).token; if(!t) throw new Error('No authentication token found'); return fetch(url,{...opts,headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`,...(opts.headers||{})}}); };

/* ─── Remove-from-cart animation ────────────────────────────── */
function removeFromCartAnim(sourceEl, itemName, isFullRemove) {
  if (!sourceEl) return;
  const rect = sourceEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // 1. Red flash on the source element
  sourceEl.animate([
    { background: 'rgba(239,68,68,0.0)' },
    { background: 'rgba(239,68,68,0.15)' },
    { background: 'rgba(239,68,68,0.0)' },
  ], { duration: 400, easing: 'ease-out' });

  // 2. Floating text: "−1" or item name poof
  const floater = document.createElement('div');
  floater.textContent = isFullRemove ? '✕ Removed' : '−1';
  floater.style.cssText = `
    position:fixed; z-index:99999;
    left:${cx}px; top:${cy}px;
    transform:translate(-50%,-50%);
    font-size:${isFullRemove ? '13px' : '18px'}; font-weight:700;
    color:#ef4444;
    pointer-events:none;
    text-shadow:0 1px 8px rgba(239,68,68,0.3);
    font-family:'DM Sans',sans-serif;
    white-space:nowrap;
    background:rgba(255,255,255,0.92); border-radius:20px;
    padding:${isFullRemove ? '6px 14px' : '4px 12px'};
    border:1.5px solid rgba(239,68,68,0.3);
    box-shadow:0 4px 16px rgba(239,68,68,0.15);
  `;
  document.body.appendChild(floater);

  floater.animate([
    { opacity: 0, transform: 'translate(-50%,-50%) scale(0.5) translateY(0)' },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1) translateY(-8px)', offset: 0.2 },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1) translateY(-20px)', offset: 0.5 },
    { opacity: 0, transform: 'translate(-50%,-50%) scale(0.8) translateY(-50px)' },
  ], { duration: 800, easing: 'ease-out', fill: 'forwards' });

  setTimeout(() => floater.remove(), 850);

  // 3. Particle burst for full remove
  if (isFullRemove) {
    const colors = ['#ef4444','#f87171','#fca5a5','#fecaca','#dc2626'];
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      const angle = (i / 8) * Math.PI * 2;
      const dist = 30 + Math.random() * 25;
      p.style.cssText = `
        position:fixed; z-index:99998;
        width:6px; height:6px; border-radius:50%;
        background:${colors[i % colors.length]};
        left:${cx}px; top:${cy}px;
        pointer-events:none;
      `;
      document.body.appendChild(p);
      p.animate([
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
        { opacity: 0, transform: `translate(${Math.cos(angle)*dist - 3}px, ${Math.sin(angle)*dist - 3}px) scale(0)` }
      ], { duration: 500 + Math.random() * 200, easing: 'ease-out', fill: 'forwards' });
      setTimeout(() => p.remove(), 750);
    }
  }
}

/* ─── Nutrient chips ─────────────────────────────────────────── */
const NUTRI = [
  { key:'calories', keys:['calories','calorie','kcal'],                          emoji:'🔥', label:'cal',    bg:'#fef9c3', border:'#fde047', text:'#92400e' },
  { key:'protein',  keys:['protein_g','protein','proteins'],                     emoji:'💪', label:'protein',bg:'#dcfce7', border:'#86efac', text:'#166534' },
  { key:'carbs',    keys:['carbs_g','carbs','carbohydrates','carb'],             emoji:'🍞', label:'carbs',  bg:'#ffedd5', border:'#fdba74', text:'#9a3412' },
  { key:'fat',      keys:['fat_g','fat','fats','total_fat'],                     emoji:'🥑', label:'fat',    bg:'#f3e8ff', border:'#d8b4fe', text:'#6b21a8' },
  { key:'fiber',    keys:['fiber_g','fiber','dietary_fiber'],                    emoji:'🌿', label:'fiber',  bg:'#dcfce7', border:'#4ade80', text:'#14532d' },
  { key:'sodium',   keys:['sodium_mg','sodium'],                                 emoji:'🧂', label:'Na',     bg:'#e0f2fe', border:'#7dd3fc', text:'#0c4a6e' },
  { key:'sugar',    keys:['sugar_g','sugar'],                                    emoji:'🍬', label:'sugar',  bg:'#ffe4e6', border:'#fda4af', text:'#9f1239' },
];

// Gets nutrient value — checks top-level AND nested nutrition{} object
// Also strips trailing 'g'/'mg' from string values like "25g"
const getNV = (item, n) => {
  const src = [item, item?.nutrition, item?.nutritional_info, item?.nutrients].filter(Boolean);
  for (const obj of src) {
    for (const k of n.keys) {
      if (obj[k] != null) {
        const raw = obj[k];
        // Parse "25g" → 25, "500" → 500
        const num = typeof raw === 'string' ? parseFloat(raw) : raw;
        return isNaN(num) ? raw : num;
      }
    }
  }
  return null;
};

// Format display value — don't add 'g' if already a whole number for calories
const fmtNV = (val, label) => {
  if (val == null) return '';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (label === 'cal') return isNaN(num) ? val : Math.round(num);
  if (label === 'Na')  return isNaN(num) ? val : `${Math.round(num)}mg`;
  return isNaN(num) ? val : `${num}g`;
};

function NutriPills({ item, animate }) {
  const visible = NUTRI.filter(n => getNV(item,n) != null);
  if (!visible.length) return null;
  return (
    <div className={`nutri-row${animate?' nutri-row--anim':''}`}>
      {visible.map((n, i) => {
        const val = getNV(item, n);
        return (
          <div key={n.key} className="nutri-pill"
            style={{ background:n.bg, borderColor:n.border, animationDelay:`${i*55}ms` }}>
            <span>{n.emoji}</span>
            <span className="np__val" style={{color:n.text}}>{fmtNV(val, n.label)}</span>
            <span className="np__lbl" style={{color:n.text}}>{n.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Left Sidebar ───────────────────────────────────────────── */
const SBIcons = {
  Menu:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Cart:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  Track:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>,
  Hist:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>,
  Profile: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  Support: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  Star:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  Offer:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  Fire:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><path d="M12 12c2-2.96 0-7-1-8 0 3.04-4 6.5-4 8 0 2.97 2.24 5 5 5s5-2.03 5-5c0-1.06-.5-2-1-3-1 1-3 2-4 3z"/></svg>,
};

function LeftSidebar({ cart, navigate, t, userData, onProfile, isOpen, onToggle, currency, onSortOffers }) {
  const location  = useLocation();
  const guestName = userData?.guestName || userData?.guest?.guest_name || userData?.name || 'Guest';
  const room      = userData?.guest?.guestRoomId || userData?.guest?.room || userData?.roomNumber || 'N/A';
  const loginTime = safeJSON(localStorage.getItem('sessionData'),{})?.loginTime;
  const cartCount = cart.reduce((s,i) => s+i.quantity, 0);
  const subtotal  = cart.reduce((s,i) => s+i.price*i.quantity, 0);
  const tax       = Math.round(subtotal * 0.118);

  const fmtLogin = ts => {
    if (!ts) return '—';
    const d = new Date(ts);
    const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const h = d.getHours(), m = d.getMinutes();
    return `${days[d.getDay()]}. ${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()} (${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'})`;
  };

  const nav = [
    { label: t('browse_menu'),    path:'/menu',         icon: SBIcons.Menu,    section: 'MENU' },
    { label: t('my_cart'),        path:'/cart',          icon: SBIcons.Cart,    badge: cartCount||null },
    { label: t('recommendations'),path:null,             icon: SBIcons.Star,    section: 'DISCOVER', action:'recommend' },
    { label: 'Best Selling',      path:null,             icon: SBIcons.Fire,    action:'bestselling' },
    { label: 'Best Offers',       path:null,             icon: SBIcons.Offer,   action:'bestoffers' },
    { label: t('order_history'),  path:'/history',       icon: SBIcons.Hist,    section: 'ORDERS' },
    { label: t('my_profile'),     path:'PROFILE',        icon: SBIcons.Profile, section: 'ACCOUNT' },
    { label: t('support'),        path: null,            icon: SBIcons.Support },
  ];

  function handleNav(item) {
    if (item.path === 'PROFILE') { onProfile(); return; }
    if (item.action === 'recommend' || item.action === 'bestselling') { 
      // Scroll to recommendations section
      const el = document.querySelector('.scroll-area');
      if (el) {
        const recsSection = el.querySelector('.section-hdr:last-of-type');
        if (recsSection) recsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
      return;
    }
    if (item.action === 'bestoffers') {
      // Sort by discount/offers
      if (onSortOffers) onSortOffers();
      return;
    }
    if (!item.path) { alert('Support: +91 98765 43210'); return; }
    navigate(item.path);
  }

  return (
    <aside className={`lsb ${!isOpen ? 'lsb--collapsed' : ''}`}>
      {/* Toggle button */}
      <button className="lsb__toggle" onClick={onToggle} title={isOpen ? 'Collapse' : 'Expand'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
          {isOpen ? <polyline points="15,18 9,12 15,6"/> : <polyline points="9,18 15,12 9,6"/>}
        </svg>
      </button>
      <div className="lsb__inner">
      <div className="lsb__brand">
        <div className="lsb__brand-icon">🏨</div>
        <div>
          <div className="lsb__brand-name">HotelOGIX</div>
          <div className="lsb__brand-sub">ROOM DINING</div>
        </div>
      </div>

      <div className="lsb__guest">
        <div className="lsb__guest-av">{guestName.charAt(0).toUpperCase()}</div>
        <div>
          <div className="lsb__guest-name">{guestName}</div>
          <div className="lsb__guest-room">{t('room')} {room}</div>
        </div>
      </div>

      <nav className="lsb__nav">
        {nav.map((navItem) => {
          const {label, path, icon, badge, section, dot} = navItem;
          const active = path && path !== 'PROFILE' && location.pathname === path;
          return (
            <React.Fragment key={label}>
              {section && <div className="lsb__section">{section}</div>}
              <button className={`lsb__item ${active ? 'lsb__item--active' : ''}`} onClick={() => handleNav(navItem)}>
                {active && <span className="lsb__bar" />}
                <span className="lsb__icon">{icon}</span>
                <span className="lsb__label">{label}</span>
                {badge ? <span className="lsb__badge">{badge}</span> : null}
                {dot && !badge ? <span className="lsb__dot" /> : null}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="lsb__last-login">
        <span className="lsb__ll-icon">{SBIcons.Refresh}</span>
        <div>
          <p className="lsb__ll-title">Last Login:</p>
          <p className="lsb__ll-time">{fmtLogin(loginTime)}</p>
        </div>
      </div>

      <div className="lsb__summary">
        <div className="lsb__sum-row"><span>{t('items')}</span><span>{cartCount} {t('items')}</span></div>
        <div className="lsb__sum-row"><span>{t('subtotal')}</span><span>{currency} {subtotal.toLocaleString('en-IN')}</span></div>
        <div className="lsb__sum-row lsb__sum-total"><span>{t('total')}</span><span>{currency} {(subtotal+tax).toLocaleString('en-IN')}</span></div>
      </div>

      <button className="lsb__order-btn" onClick={() => navigate('/cart')}>
        <span className="lsb__order-icon">🛒</span>
        <span className="lsb__order-text">{t('place_order')} →</span>
      </button>
      </div>{/* end lsb__inner */}
    </aside>
  );
}

/* ─── Right Order Panel ──────────────────────────────────────── */
function RightCart({ cart, setCart, currency, navigate, t, isOpen, onToggle, cartCount: cartCountProp }) {
  const cartCount = cartCountProp ?? cart.reduce((s,i) => s+i.quantity, 0);
  const cartTotal = cart.reduce((s,i) => s+i.price*i.quantity, 0);

  function changeQty(id, delta, btnEl) {
    const idx = cart.findIndex(c => String(c.id) === String(id));
    if (idx === -1) return;
    if (delta < 0) {
      const item = cart[idx];
      const isFullRemove = item.quantity <= 1 || delta <= -999;
      removeFromCartAnim(btnEl || null, item.name, isFullRemove);
    }
    const nc = cart.map((c, i) =>
      i === idx ? { ...c, quantity: c.quantity + delta } : c
    ).filter(c => c.quantity > 0);
    setCart(nc);
    saveCart(nc);
  }

  return (
    <aside className={`rcp ${!isOpen ? 'rcp--hidden' : ''}`}>
      {/* Toggle button */}
      <button className="rcp__toggle" onClick={onToggle} title={isOpen ? 'Hide Order Panel' : 'Show Order Panel'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
          {isOpen ? <polyline points="9,18 15,12 9,6"/> : <polyline points="15,18 9,12 15,6"/>}
        </svg>
        {!isOpen && cartCount > 0 && <span className="rcp__toggle-badge">{cartCount}</span>}
      </button>
      <div className="rcp__header">
        <span className="rcp__title">{t('your_order')}</span>
        {cartCount > 0 && <span className="rcp__badge">{cartCount} {t('items')}</span>}
      </div>
      <div className="rcp__items">
        {cart.length === 0 ? (
          <div className="rcp__empty">
            <div className="rcp__empty-icon">🛒</div>
            <p>{t('cart_empty')}</p>
            <small>{t('add_something')}</small>
          </div>
        ) : (
          cart.map(item => {
            const dietType = (item.food_type||item.diet_type||'').toLowerCase();
            const isVeg = dietType === 'veg' || dietType === 'vegetarian' || (item.tags||[]).some(t=>(t.toLowerCase().includes('veg'))&&!t.toLowerCase().includes('non'));
            const isNonVeg = dietType === 'nonveg' || dietType === 'non-veg' || (item.tags||[]).some(t=>t.toLowerCase().includes('nonveg'));
            const lineTotal = (item.price * item.quantity);
            return (
              <div key={item.id} className="rcp__card">
                {/* Image + diet indicator */}
                <div className="rcp__card-img" style={{ backgroundImage: item.image ? `url('${item.image}')` : 'none' }}>
                  {!item.image && <span className="rcp__card-ph">🍽️</span>}
                  {(isVeg || isNonVeg) && (
                    <span className={`rcp__card-diet ${isVeg ? 'rcp__card-diet--veg' : 'rcp__card-diet--nv'}`}>
                      {isVeg ? '🟢' : '🔴'}
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="rcp__card-body">
                  <div className="rcp__card-name">{item.name}</div>
                  <div className="rcp__card-meta">
                    {item.nutrition?.protein && <span>💪 {item.nutrition.protein}</span>}
                    {item.nutrition?.carbs && <span>🍞 {item.nutrition.carbs}</span>}
                    {item.nutrition?.fat && <span>🥑 {item.nutrition.fat}</span>}
                    {item.nutrition?.calories != null && <span>🔥 {item.nutrition.calories}cal</span>}
                  </div>
                  {/* Allergens */}
                  {item.allergens?.length > 0 && (
                    <div className="rcp__card-allergens">
                      {item.allergens.slice(0,3).map(a => (
                        <span key={a.id} className="rcp__card-allergen" style={{background:a.color||'#ef4444'}} title={a.name}>
                          {a.icon}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Customization */}
                  {(item.customization?.notes || item.customization?.spice) && (
                    <div className="rcp__card-custom">
                      {item.customization.spice && <span>🌶 {item.customization.spice}</span>}
                      {item.customization.notes && <span>📝 {item.customization.notes}</span>}
                    </div>
                  )}
                  {/* Price + controls */}
                  <div className="rcp__card-bottom">
                    <div className="rcp__card-price">
                      <span className="rcp__card-total">{currency} {lineTotal}</span>
                      {item.quantity > 1 && <span className="rcp__card-each">{currency}{item.price} × {item.quantity}</span>}
                    </div>
                    <div className="rcp__card-ctrls">
                      <button className="rcp__ctrl" onClick={e => changeQty(item.id, -1, e.currentTarget)}>−</button>
                      <span className="rcp__qty">{item.quantity}</span>
                      <button className="rcp__ctrl" onClick={() => changeQty(item.id, 1)}>+</button>
                      <button className="rcp__del" onClick={e => changeQty(item.id, -999, e.currentTarget)}>✕</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {cart.length > 0 && (
        <div className="rcp__footer">
          <div className="rcp__total-row">
            <span>{t('total')}</span>
            <span className="rcp__total-val">{currency} {cartTotal.toLocaleString('en-IN')}</span>
          </div>
          <button className="rcp__place-btn" onClick={() => navigate('/cart')}>
            {t('place_order')}
          </button>
        </div>
      )}
    </aside>
  );
}

/* ─── Change Selection Modal ─────────────────────────────────── */
function ChangeSelectionModal({ onClose, onChangeOutlet, onChangeCategory }) {
  const { t } = useLang();
  return (
    <div className="co-overlay" onClick={e => { if(e.target.classList.contains('co-overlay')) onClose(); }}>
      <div className="co-modal">
        <button className="co-close" onClick={onClose}>✕</button>
        <h3 className="co-title">🔄 {t('change_selection')}</h3>
        <p style={{ fontSize: 13, color: 'var(--txt3)', margin: '0 0 16px', lineHeight: 1.5 }}>
          Switch to a different restaurant outlet or change your dining category/meal time.
        </p>
        <button className="co-btn co-btn--blue" onClick={onChangeOutlet}>
          <span>🏨</span> 
          <div style={{ textAlign:'left' }}>
            <strong>{t('change_outlet')}</strong>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>Switch to a different restaurant or bar</div>
          </div>
        </button>
        <button className="co-btn co-btn--green" onClick={onChangeCategory}>
          <span>📋</span>
          <div style={{ textAlign:'left' }}>
            <strong>{t('change_category')}</strong>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>Switch meal time (Breakfast, Lunch, Dinner…)</div>
          </div>
        </button>
      </div>
    </div>
  );
}

/* ─── Hero Carousel ──────────────────────────────────────────── */
function HeroCarousel({ outletData }) {
  const [slide, setSlide] = useState(0);
  const slides = outletData?.images?.length ? outletData.images
    : ['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&q=80',
       'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1400&q=80',
       'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1400&q=80'];
  const total = slides.length;
  useEffect(() => { const tm = setInterval(() => setSlide(s => (s+1)%total), 5000); return () => clearInterval(tm); }, [total]);
  const hotelName = safeJSON(localStorage.getItem('userData'),{})?.guest?.hotel_name || 'Hotel';
  return (
    <div className="hero">
      {slides.map((src, i) => (
        <div key={i} className={`hero__slide ${i===slide?'hero__slide--on':''}`}
          style={{ backgroundImage:`url('${typeof src==='string'?src:src.url||''}')` }} />
      ))}
      <div className="hero__overlay" />
      <div className="hero__content">
        <h1 className="hero__hotel">{hotelName}</h1>
        <p className="hero__outlet">{outletData?.name||'Restaurant'}</p>
        <p className="hero__timing">{outletData?.timing||'6:00 AM – 11:00 PM'}</p>
      </div>
      <button className="hero__arr hero__arr--l" onClick={() => setSlide(s=>(s-1+total)%total)}>‹</button>
      <button className="hero__arr hero__arr--r" onClick={() => setSlide(s=>(s+1)%total)}>›</button>
      <div className="hero__dots">
        {slides.map((_,i) => <span key={i} className={`hero__dot ${i===slide?'hero__dot--on':''}`} onClick={() => setSlide(i)} />)}
      </div>
    </div>
  );
}

/* ─── Item Modal — with inline customization ─────────────────── */
function ItemModal({ item, onClose, onAdd, inCart, currency }) {
  const [adding, setAdding] = useState(false);
  const [spice,  setSpice]  = useState('');
  const [notes,  setNotes]  = useState('');
  if (!item) return null;

  const spiceOptions = [
    { id:'mild',      label:'🟢 Mild'      },
    { id:'medium',    label:'🟡 Medium'    },
    { id:'hot',       label:'🔴 Hot'       },
    { id:'extra-hot', label:'🌶️ Extra Hot' },
  ];

  function handleAdd() {
    setAdding(true);
    // Toss animation from modal image to cart
    const modalImg = document.querySelector('.imdl__img');
    const isMobile = window.innerWidth <= 768;
    const cartEl = isMobile
      ? (document.querySelector('.mbn-item:nth-child(2)') || document.querySelector('.mobile-bottom-nav button:nth-child(2)'))
      : (document.querySelector('.tb-cart-btn') || document.querySelector('.rcp__toggle'));
    if (modalImg && cartEl) {
      const srcRect = modalImg.getBoundingClientRect();
      const tgtRect = cartEl.getBoundingClientRect();
      const flyer = document.createElement('div');
      const imgSrc = item.image || '';
      const sz = isMobile ? 50 : 70;
      const h = sz / 2;
      flyer.style.cssText = `
        position:fixed; z-index:99999; width:${sz}px; height:${sz}px; border-radius:50%;
        background:${imgSrc ? `url('${imgSrc}') center/cover` : 'var(--gold)'};
        box-shadow:0 8px 32px rgba(245,166,35,0.5), 0 0 0 3px var(--gold);
        left:${srcRect.left + srcRect.width/2 - h}px; top:${srcRect.top + srcRect.height/2 - h}px;
        pointer-events:none;
      `;
      document.body.appendChild(flyer);
      const dx = tgtRect.left + tgtRect.width/2 - h - (srcRect.left + srcRect.width/2 - h);
      const dy = tgtRect.top + tgtRect.height/2 - h - (srcRect.top + srcRect.height/2 - h);
      const goingDown = dy > 0;
      const arcX = goingDown ? (dx > 0 ? -50 : 50) : 0;
      const arcY = goingDown ? -30 : -80;
      const dur = isMobile ? 900 : 850;
      const anim = flyer.animate([
        { transform:'scale(1) rotate(0deg)', opacity:1 },
        { transform:`translate(${dx*0.3+arcX}px,${dy*0.3+arcY}px) scale(0.8) rotate(120deg)`, opacity:1, offset:0.35 },
        { transform:`translate(${dx*0.65+arcX*0.3}px,${dy*0.65}px) scale(0.5) rotate(300deg)`, opacity:0.9, offset:0.7 },
        { transform:`translate(${dx}px,${dy}px) scale(0.15) rotate(460deg)`, opacity:0.5 }
      ], { duration:dur, easing:'cubic-bezier(0.25,0.46,0.45,0.94)', fill:'forwards' });
      anim.onfinish = () => {
        flyer.remove();
        cartEl.animate([
          {transform:'scale(1)'},{transform:'scale(1.3)'},{transform:'scale(0.9)'},{transform:'scale(1)'}
        ], { duration:400, easing:'ease-out' });
      };
    }
    onAdd(item.id, { spice, notes });
    setTimeout(() => { setAdding(false); onClose(); }, 600);
  }

  return (
    <div className="imdl-overlay" onClick={e => { if(e.target.classList.contains('imdl-overlay')) onClose(); }}>
      <div className="imdl">
        {/* Image */}
        <div className="imdl__img" style={{ backgroundImage: item.image ? `url('${item.image}')` : 'none' }}>
          <button className="imdl__close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          {item.is_popular    && <span className="imdl__badge imdl__badge--hot">🔥 Popular</span>}
          {item.is_bestseller && <span className="imdl__badge imdl__badge--star">⭐ Bestseller</span>}
          {item.discount      && <span className="imdl__badge imdl__badge--off">{item.discount}% OFF</span>}
        </div>

        <div className="imdl__body">
          {/* Tags */}
          {item.tags?.length > 0 && (
            <div className="imdl__tags">
              {item.tags.map(tg => <span key={tg} className={`tag ${tg.toLowerCase().includes('veg')?'veg':tg.toLowerCase().includes('spicy')?'spicy':''}`}>{tg}</span>)}
            </div>
          )}

          <h2 className="imdl__name">{item.name}</h2>
          {item.cook_time && <p className="imdl__meta">⏱ {item.cook_time} · {item.category||''}</p>}
          <p className="imdl__desc">{item.long_description||item.description||'No description available.'}</p>

          {/* Nutrition */}
          {NUTRI.some(n => getNV(item,n) != null) && (
            <div className="imdl__section">
              <h4 className="imdl__section-title">📊 Nutrition Facts</h4>
              <NutriPills item={item} animate={true} />
            </div>
          )}

          {/* Allergens */}
          {item.allergens?.length > 0 && (
            <div className="imdl__section">
              <h4 className="imdl__section-title">⚠️ Allergens</h4>
              <div className="imdl__allergens">
                {item.allergens.map(a => <span key={a.id} className="imdl__allergen" style={{background:a.color||'#ef4444'}}>{a.icon} {a.name}</span>)}
              </div>
            </div>
          )}

          {/* ── Customize (inline, always visible) ── */}
          <div className="imdl__section imdl__customize">
            <h4 className="imdl__section-title">✏️ Customize Your Order</h4>
            <div className="imdl__cust-field">
              <label className="imdl__cust-label">Special Instructions</label>
              <input
                type="text"
                className="imdl__cust-input"
                placeholder="e.g. Less sugar, extra ice, no onions…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            <div className="imdl__cust-field">
              <label className="imdl__cust-label">
                Spice Level <span className="imdl__cust-optional">(optional)</span>
              </label>
              <div className="imdl__spice-row">
                {spiceOptions.map(s => (
                  <button key={s.id}
                    className={`imdl__spice-btn ${spice===s.id?'imdl__spice-btn--on':''}`}
                    onClick={() => setSpice(spice===s.id ? '' : s.id)}
                    type="button">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="imdl__footer">
            <div className="imdl__price-block">
              <span className="imdl__price">{currency}{item.price}</span>
              {item.originalPrice && <span className="imdl__orig">{currency}{item.originalPrice}</span>}
            </div>
            {!inCart
              ? <button className={`imdl__add${adding?' imdl__add--adding':''}`} onClick={handleAdd}>
                  {adding ? '✓ Adding…' : '+ Add to Cart'}
                </button>
              : <button className="imdl__added" disabled>✓ Added to Cart</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Menu Card (no separate customize button) ───────────────── */
function MenuCard({ item, inCart, cartQty, onAdd, onOpen, onCustomize, onChangeQty, currency }) {
  const [pulse, setPulse] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const imgRef = useRef(null);

  function tossToCart(e) {
    // Get source position (the card image)
    const srcEl = imgRef.current;
    if (!srcEl) return;
    const srcRect = srcEl.getBoundingClientRect();

    // Detect mobile vs desktop — find the right cart target
    const isMobile = window.innerWidth <= 768;
    const cartEl = isMobile
      ? (document.querySelector('.mbn-item:nth-child(2)') || document.querySelector('.mobile-bottom-nav button:nth-child(2)'))  // Mobile bottom nav cart button
      : (document.querySelector('.tb-cart-btn') || document.querySelector('.rcp__toggle'));
    if (!cartEl) return;
    const tgtRect = cartEl.getBoundingClientRect();

    // Create flying clone
    const flyer = document.createElement('div');
    const imgSrc = item.image || '';
    const flyerSize = isMobile ? 50 : 60;
    const half = flyerSize / 2;
    flyer.style.cssText = `
      position: fixed;
      z-index: 99999;
      width: ${flyerSize}px; height: ${flyerSize}px;
      border-radius: 50%;
      background: ${imgSrc ? `url('${imgSrc}') center/cover` : 'var(--gold)'};
      box-shadow: 0 8px 32px rgba(245,166,35,0.5), 0 0 0 3px var(--gold);
      left: ${srcRect.left + srcRect.width / 2 - half}px;
      top: ${srcRect.top + srcRect.height / 2 - half}px;
      pointer-events: none;
      transition: none;
    `;
    if (!imgSrc) {
      flyer.textContent = '🍽️';
      flyer.style.display = 'flex';
      flyer.style.alignItems = 'center';
      flyer.style.justifyContent = 'center';
      flyer.style.fontSize = '22px';
    }
    document.body.appendChild(flyer);

    // Calculate destination offset
    const startX = srcRect.left + srcRect.width / 2 - half;
    const startY = srcRect.top + srcRect.height / 2 - half;
    const endX   = tgtRect.left + tgtRect.width / 2 - half;
    const endY   = tgtRect.top + tgtRect.height / 2 - half;
    const dx = endX - startX;
    const dy = endY - startY;

    // Arc bulge: for mobile (going DOWN), arc curves LEFT/RIGHT
    // For desktop (going UP/RIGHT), arc curves upward
    const goingDown = dy > 0;
    const arcX = goingDown ? (dx > 0 ? -60 : 60) : 0;  // horizontal bulge on mobile
    const arcY = goingDown ? -40 : -80;                   // slight upward lift even going down

    // Slower duration for mobile
    const duration = isMobile ? 900 : 800;

    // Animate with keyframes
    const anim = flyer.animate([
      {
        transform: 'scale(1) rotate(0deg)',
        opacity: 1,
      },
      {
        transform: `translate(${dx * 0.25 + arcX}px, ${dy * 0.25 + arcY}px) scale(0.85) rotate(120deg)`,
        opacity: 1,
        offset: 0.3,
      },
      {
        transform: `translate(${dx * 0.55 + arcX * 0.5}px, ${dy * 0.55}px) scale(0.6) rotate(270deg)`,
        opacity: 0.95,
        offset: 0.6,
      },
      {
        transform: `translate(${dx * 0.85}px, ${dy * 0.85}px) scale(0.35) rotate(400deg)`,
        opacity: 0.8,
        offset: 0.85,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(0.15) rotate(480deg)`,
        opacity: 0.5,
      }
    ], {
      duration,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'forwards',
    });

    // Bounce the cart icon on arrival
    anim.onfinish = () => {
      flyer.remove();
      if (cartEl) {
        cartEl.animate([
          { transform: 'scale(1)' },
          { transform: 'scale(1.3)' },
          { transform: 'scale(0.9)' },
          { transform: 'scale(1.05)' },
          { transform: 'scale(1)' },
        ], { duration: 400, easing: 'ease-out' });
      }
    };
  }

  function handleAdd(e) {
    e.stopPropagation();
    setPulse(true);
    setTimeout(() => setPulse(false), 500);
    tossToCart(e);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 750);
    onAdd(item.id);
  }
  function handleCustomize(e) {
    e.stopPropagation();
    onCustomize(item);
  }
  function handleQty(e, delta) {
    e.stopPropagation();
    if (delta < 0) {
      const isFullRemove = cartQty <= 1;
      removeFromCartAnim(imgRef.current, item.name, isFullRemove);
    }
    onChangeQty(item.id, delta);
  }

  const hasNutri = NUTRI.some(n => getNV(item,n) != null);
  const tags = (item.tags||[]).map(t=>t.toLowerCase());
  const foodType = (item.food_type||item.diet_type||item.veg_nonveg||item.dietary||item.type||'').toLowerCase();
  const isVeg = foodType === 'veg' || foodType === 'vegetarian' || tags.some(t=>(t.includes('veg')||t.includes('vegetarian'))&&!t.includes('non'));
  const isNonVeg = foodType === 'nonveg' || foodType === 'non-veg' || foodType === 'non_veg' || tags.some(t=>t.includes('non-veg')||t.includes('nonveg'));
  const vegDotColor = isVeg ? '#22c55e' : isNonVeg ? '#ef4444' : null;
  const vegLabel = isVeg ? 'Veg' : isNonVeg ? 'Non-Veg' : null;

  return (
    <div className={`mc ${inCart?'mc--in':''}`} onClick={() => onOpen(item)}>
      <div className={`mc__img ${showFlash ? 'mc--adding' : ''}`} ref={imgRef} style={{ backgroundImage:`url('${item.image||''}')` }}>
        {!item.image && <div className="mc__ph">🍽️</div>}
        {/* Top-left: discount badge */}
        {item.discount > 0 && <span className="mc__badge mc__badge--off">{item.discount}% OFF</span>}
        {/* Top-right: bestseller/popular */}
        {(item.is_bestseller || item.is_popular) && (
          <span className="mc__badge mc__badge--top-right">
            {item.is_bestseller ? '⭐' : '🔥'}
          </span>
        )}
        {/* Bottom-left: veg/non-veg small dot */}
        {vegLabel && (
          <span className={`mc__badge mc__badge--diet ${isVeg ? 'mc__badge--veg' : 'mc__badge--nonveg'}`}>
            {isVeg ? '🟢' : '🔴'} {vegLabel}
          </span>
        )}
        {inCart && <span className="mc__qty-badge">{cartQty}</span>}
        {showFlash && <span className="mc__added-flash">✓</span>}
      </div>
      <div className="mc__body">
        <div className="mc__name-row">
          {vegDotColor && <span className="mc__veg-dot" style={{background: vegDotColor}} title={isVeg?'Veg':'Non-Veg'} />}
          <h3 className="mc__name">{item.name}</h3>
        </div>
        {item.description && <p className="mc__desc">{item.description}</p>}
        {hasNutri && <NutriPills item={item} />}
        {item.allergens?.length > 0 && (
          <div className="mc__allergens">
            {item.allergens.slice(0,4).map(a => <span key={a.id} className="mc__allergen" style={{background:a.color||'#ef4444'}} title={a.name}>{a.icon} {a.code}</span>)}
          </div>
        )}
        <div className="mc__footer">
          <div className="mc__price-wrap">
            <span className="mc__price">{currency}{item.price}</span>
            {item.originalPrice && <span className="mc__orig">{currency}{item.originalPrice}</span>}
          </div>
          <div className="mc__actions">
            {/* Customize button — always visible */}
            <button className="mc__cust-btn" onClick={handleCustomize} title="Customize">
              ✏️
            </button>
            {/* Qty controls when in cart, + button when not */}
            {inCart ? (
              <div className="mc__qty-ctrl" onClick={e => e.stopPropagation()}>
                <button className="mc__qty-btn mc__qty-btn--minus" onClick={e => handleQty(e, -1)}>−</button>
                <span className="mc__qty-num">{cartQty}</span>
                <button className={`mc__qty-btn mc__qty-btn--plus ${pulse?'mc__btn--pulse':''}`} onClick={e => { e.stopPropagation(); setPulse(true); setTimeout(()=>setPulse(false),500); tossToCart(e); onAdd(item.id); }}>+</button>
              </div>
            ) : (
              <button className={`mc__btn ${pulse?'mc__btn--pulse':''}`} onClick={handleAdd}>+</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Customize Modal ─────────────────────────────────────────── */
function CustomizeModal({ item, onClose, onSave }) {
  const [spice, setSpice] = useState('');
  const [notes, setNotes] = useState('');
  if (!item) return null;
  const spiceOptions = [
    { id:'mild',      label:'🟢 Mild'      },
    { id:'medium',    label:'🟡 Medium'    },
    { id:'hot',       label:'🔴 Hot'       },
    { id:'extra-hot', label:'🌶️ Extra Hot' },
  ];
  return (
    <div className="cust-overlay" onClick={e => { if(e.target.classList.contains('cust-overlay')) onClose(); }}>
      <div className="cust-modal">
        <div className="cust-header">
          <div>
            <h2 className="cust-title">Customize</h2>
            <p className="cust-subtitle">{item.name}</p>
          </div>
          <button className="cust-close" onClick={onClose}>✕</button>
        </div>
        <div className="cust-body">
          <div className="cust-section">
            <label className="cust-label">🌶️ Spice Level</label>
            <div className="cust-spice-grid">
              {spiceOptions.map(s => (
                <button key={s.id}
                  className={`cust-spice-btn ${spice===s.id?'cust-spice-btn--on':''}`}
                  onClick={() => setSpice(spice===s.id?'':s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="cust-section">
            <label className="cust-label">📝 Special Instructions</label>
            <textarea className="cust-textarea"
              placeholder="e.g. No onions, extra sauce, less spicy..."
              rows={3} value={notes} onChange={e=>setNotes(e.target.value)} />
          </div>
        </div>
        <div className="cust-footer">
          <button className="cust-cancel" onClick={onClose}>Cancel</button>
          <button className="cust-save" onClick={() => { onSave(item.id,{spice,notes}); onClose(); }}>
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}


function ProfileModal({ userData, onClose, onHistory, onLogout }) {
  const { t, lang, setLanguage, LANGS } = useLang();
  const name   = userData?.guestName || userData?.guest?.guest_name || 'Guest';
  const room   = userData?.guest?.guestRoomId || userData?.guest?.room || userData?.roomNumber || 'N/A';
  const outlet = safeJSON(localStorage.getItem('outlet'),{})?.name || '—';
  return (
    <div className="pm-overlay" onClick={e => { if(e.target.classList.contains('pm-overlay')) onClose(); }}>
      <div className="pm">
        <button className="pm__close" onClick={onClose}>✕</button>
        <div className="pm__hero">
          <div className="pm__av">{name.charAt(0).toUpperCase()}</div>
          <h2 className="pm__name">{name}</h2>
          <p className="pm__sub">{t('room')} {room}</p>
        </div>
        <div className="pm__rows">
          {[[t('guest_name'),name],[t('room_no'),room],[t('current_outlet'),outlet]].map(([k,v]) => (
            <div key={k} className="pm__row"><span className="pm__lbl">{k}</span><span className="pm__val">{v}</span></div>
          ))}
          {/* Language selector row — shown on all screens, extra useful on mobile */}
          <div className="pm__row">
            <span className="pm__lbl">🌐 Language</span>
            <div className="pm__lang-btns">
              {Object.entries(LANGS).map(([code, { label }]) => (
                <button key={code}
                  className={`pm__lang-btn ${lang === code ? 'pm__lang-btn--on' : ''}`}
                  onClick={() => setLanguage(code)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="pm__foot">
          <button className="pm__hist" onClick={onHistory}>📋 {t('order_history')}</button>
          <button className="pm__logout" onClick={onLogout} style={{width:'100%',marginTop:8,padding:'11px',background:'rgba(239,68,68,0.08)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10,fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit',transition:'all 150ms'}}>
            🚪 {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN MENU PAGE ─────────────────────────────────────────── */
export default function Menu() {
  const navigate   = useNavigate();
  const { t }      = useLang();
  const { isDark } = useTheme();

  const [menuItems, setMenuItems]     = useState([]);
  const [filtered, setFiltered]       = useState([]);
  const [cart, setCart]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [outlet, setOutlet]           = useState({});
  const [category, setCategory]       = useState('all');
  const [vegFilter, setVegFilter]     = useState(''); // '' | 'veg' | 'nonveg'
  const [allergenFilter, setAllergenFilter] = useState([]); // array of allergen ids to EXCLUDE
  const [showAllergenPanel, setShowAllergenPanel] = useState(false);
  const [allAllergens, setAllAllergens] = useState([]); // master list extracted from menu items
  const [recommendations, setRecommendations] = useState([]); // from recommendations API
  const [categories, setCategories]   = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [activeShift, setActiveShift] = useState(() => localStorage.getItem('selectedShift') || '');
  const [search, setSearch]           = useState('');
  const [priceF, setPriceF]           = useState('');
  const [sortF, setSortF]             = useState('');
  const [grid, setGrid]               = useState(5);
  const [page, setPage]               = useState(1);
  const PER_PAGE = 20;
  const [showProfile, setShowProfile]     = useState(false);
  const [leftOpen, setLeftOpen]           = useState(false);
  const [rightOpen, setRightOpen]         = useState(false);

  // Auto-open right cart panel when items added, auto-close when empty
  useEffect(() => {
    if (cart.length > 0 && !rightOpen) setRightOpen(true);
    if (cart.length === 0 && rightOpen) setRightOpen(false);
  }, [cart.length]);

  // Auto-open left sidebar when cart has items (on initial load)
  useEffect(() => {
    if (cart.length > 0 && !leftOpen) setLeftOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set document title
  useEffect(() => { document.title = 'POS'; }, []);
  const [selItem, setSelItem]         = useState(null);
  const [customizeItem, setCustomizeItem] = useState(null);
  const [toast, setToast]             = useState(null);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const notifTimer = useRef(null);
  const searchRef  = useRef(null);

  const selOutlet = localStorage.getItem('selectedOutlet');
  const selShift  = localStorage.getItem('selectedShift');
  const hotelId   = localStorage.getItem('hotel_id');
  const userData  = safeJSON(localStorage.getItem('userData'), {});
  const currency  = getCurrency();

  // Helper — get encoded room id for navigation
  const getRoomParam = () =>
    userData?.guest?.guestRoomId || userData?.guest?.room ||
    localStorage.getItem('roomNumber') || '';

  useEffect(() => {
    if (!selOutlet || !selShift) { navigate('/preferences'); return; }
    setCart(getCartRaw());
    loadMenu();
  }, []);

  useEffect(() => {
    let items = [...menuItems];
    if (category !== 'all') items = items.filter(i => i.category?.includes(category));
    if (search) { const q = search.toLowerCase(); items = items.filter(i => i.name.toLowerCase().includes(q)||(i.description||'').toLowerCase().includes(q)); }
    if (priceF) {
      let min=0, max=Infinity;
      if (priceF.endsWith('+')) min = parseInt(priceF);
      else if (priceF.includes('-')) [min,max] = priceF.split('-').map(Number);
      items = items.filter(i => i.price>=min && i.price<=max);
    }
    if (sortF==='price-low')  items.sort((a,b) => a.price-b.price);
    if (sortF==='price-high') items.sort((a,b) => b.price-a.price);
    if (sortF==='popular')    items.sort((a,b) => (b.is_popular?1:0)-(a.is_popular?1:0));
    // Veg / Non-veg filter — use backend diet_type/food_type/veg_nonveg fields
    const isVegItem = i => {
      const ft = (i.food_type||i.diet_type||i.veg_nonveg||i.dietary||i.type||'').toLowerCase();
      if (ft === 'veg' || ft === 'vegetarian') return true;
      const tags = (i.tags||[]).map(t=>t.toLowerCase());
      return tags.some(t=>(t.includes('veg')||t.includes('vegetarian'))&&!t.includes('non'));
    };
    const isNonVegItem = i => {
      const ft = (i.food_type||i.diet_type||i.veg_nonveg||i.dietary||i.type||'').toLowerCase();
      if (ft === 'nonveg' || ft === 'non-veg' || ft === 'non_veg') return true;
      const tags = (i.tags||[]).map(t=>t.toLowerCase());
      return tags.some(t=>t.includes('non-veg')||t.includes('nonveg'));
    };
    if (vegFilter==='veg')    items = items.filter(i => isVegItem(i));
    if (vegFilter==='nonveg') items = items.filter(i => isNonVegItem(i));
    // Allergen filter — exclude items that contain selected allergens
    if (allergenFilter.length > 0) {
      items = items.filter(i => {
        const itemAllergenIds = (i.allergens||[]).map(a => a.id);
        return !allergenFilter.some(af => itemAllergenIds.includes(af));
      });
    }
    setFiltered(items); setPage(1);
  }, [menuItems, category, search, priceF, sortF, vegFilter, allergenFilter]);

  async function loadMenu(shiftId, allergenIds) {
    const currentShift = shiftId || localStorage.getItem('selectedShift');
    const activeAllergens = allergenIds || allergenFilter;
    setLoading(true);
    try {
      let menuUrl = `${API_BASE}/api/app/outlets/${selOutlet}/categories/${currentShift}/menu?hotel_id=${hotelId}&_t=${Date.now()}`;
      // Send allergen exclusion filter to backend
      if (activeAllergens.length > 0) {
        const allergenCodes = allAllergens.filter(a => activeAllergens.includes(a.id)).map(a => a.code).join(',');
        if (allergenCodes) menuUrl += `&exclude_allergens=${allergenCodes}`;
        menuUrl += `&exclude_allergen_ids=${activeAllergens.join(',')}`;
      }
      const resp = await authFetch(menuUrl);
      const data = await resp.json();
      const o = data[Object.keys(data)[0]];
      if (o?.menuItems) {
        const storedOutlet = safeJSON(localStorage.getItem('outlet'), {});
        const mergedOutlet = {
          ...storedOutlet,
          ...o,
          pos_id: o.pos_id || storedOutlet.pos_id || selOutlet,
        };
        setOutlet(mergedOutlet);

        // ── Menu API already returns allergen_names, diet_type, nutrition — use directly ──
        const enrichedItems = o.menuItems.map(item => {
          // Allergens: use allergen_names from API response directly
          const allergens = (item.allergen_names && Array.isArray(item.allergen_names) && item.allergen_names.length > 0)
            ? item.allergen_names
            : (item.allergens || []);

          // Diet type from API
          const diet_type = item.diet_type || item.food_type || item.veg_nonveg || '';

          // Nutrition: use real values from API if present
          const nutrition = {};
          if (item.calories != null)   nutrition.calories = Number(item.calories);
          if (item.protein_g != null)  nutrition.protein = `${item.protein_g}g`;
          if (item.carbs_g != null)    nutrition.carbs = `${item.carbs_g}g`;
          if (item.fat_g != null)      nutrition.fat = `${item.fat_g}g`;
          if (item.fiber_g != null)    nutrition.fiber = `${item.fiber_g}g`;
          if (item.sodium_mg != null)  nutrition.sodium = `${item.sodium_mg}mg`;
          if (item.sugar_g != null)    nutrition.sugar = `${item.sugar_g}g`;
          const hasRealNutrition = Object.keys(nutrition).length > 0;

          // Discount: calculate from originalPrice vs price
          const origPrice = Number(item.originalPrice) || 0;
          const curPrice = Number(item.price) || 0;
          const discount = (origPrice > curPrice && curPrice > 0)
            ? Math.round(((origPrice - curPrice) / origPrice) * 100)
            : null;

          return {
            ...item,
            allergens,
            allergen_ids: allergens.map(a => a.id),
            food_type: diet_type,
            diet_type,
            is_bestseller: item.isBestseller || item.is_bestseller || (item.tags||[]).some(t => t.toLowerCase() === 'bestseller'),
            is_popular: item.isPopular || item.is_popular || (item.tags||[]).some(t => t.toLowerCase() === 'popular'),
            discount,
            ...(hasRealNutrition ? { nutrition } : {}),
          };
        });

        setMenuItems(enrichedItems);
        setFiltered(enrichedItems);
        const cats = enrichedItems.flatMap(i => {
          const c = i.category;
          return Array.isArray(c) ? c : (c ? [c] : []);
        });
        setCategories([...new Set(cats)]);

        // Extract allergens from items + fetch full master list from API
        const allergenMap = new Map();
        enrichedItems.forEach(item => {
          (item.allergens||[]).forEach(a => {
            if (a?.id && !allergenMap.has(a.id)) allergenMap.set(a.id, a);
          });
        });

        // Fetch master allergen list from backend
        try {
          const allergenResp = await authFetch(`${API_BASE}/api/allergens`);
          const allergenData = await allergenResp.json();
          const masterList = allergenData?.allergens || allergenData || [];
          if (Array.isArray(masterList)) {
            masterList.forEach(a => {
              if (a?.id && !allergenMap.has(a.id)) allergenMap.set(a.id, a);
            });
          }
        } catch (e) { console.warn('Master allergens fetch failed:', e.message); }

        setAllAllergens([...allergenMap.values()]);

        const prefs = storedOutlet?.preferences || o?.preferences || [];
        setPreferences(prefs.filter(p => p.itemCount > 0));
        localStorage.setItem('outlet', JSON.stringify(mergedOutlet));
        setCart(getCartRaw());

        // ── Fetch recommendations from API ──
        loadRecommendations(enrichedItems);
      }
    } catch(err) { if(err.message.includes('authentication')) { localStorage.clear(); navigate('/preferences'); } }
    finally { setLoading(false); }
  }

  // ── Recommendations API ──
  async function loadRecommendations(items) {
    try {
      // Pick a random item to get recommendations for, exclude items already in cart
      const cartIds = getCartRaw().map(c => String(c.id));
      const firstItem = items[0];
      if (!firstItem) return;
      const excludeStr = cartIds.join(',');
      const catId = localStorage.getItem('selectedShift') || '';
      const url = `${API_BASE}/api/app/outlets/${selOutlet}/categories/${catId}/products/${firstItem.id}/recommendations?exclude=${excludeStr}&perCategory=5&otherCategories=2`;
      const resp = await authFetch(url);
      const data = await resp.json();
      // Recommendations come as { sameCategory: [...], otherCategories: [...] } or as array
      let recs = [];
      if (Array.isArray(data)) recs = data;
      else if (data?.sameCategory) recs = [...(data.sameCategory||[]), ...(data.otherCategories||[])];
      else if (data?.recommendations) recs = data.recommendations;
      else {
        // Try to extract from nested structure
        const vals = Object.values(data).filter(v => Array.isArray(v));
        recs = vals.flat();
      }
      if (recs.length > 0) {
        setRecommendations(recs);
      }
    } catch (e) { console.warn('Recommendations fetch failed:', e.message); }
  }

  function addToCart(itemId, customization = {}) {
    const item = menuItems.find(m => String(m.id)===String(itemId));
    if (!item) return;
    const o     = safeJSON(localStorage.getItem('outlet'),{});
    const posId = o.pos_id || outlet.pos_id || '';
    setCart(prev => {
      const existing = prev.find(c => String(c.id)===String(itemId));
      let nc;
      if (existing) {
        nc = prev.map(c =>
          String(c.id)===String(itemId)
            ? { ...c, quantity: c.quantity + 1, ...(customization.notes||customization.spice ? {customization} : {}) }
            : c
        );
      } else {
        nc = [...prev, {
          id: item.id, name: item.name, price: item.price, image: item.image,
          quantity: 1, customization,
          outlet: selOutlet, outletName: o.name||outlet.name||'',
          pos_id: posId,
          requiresAdvancePayment: item.requiresAdvancePayment || false,
          taxes: item.taxes,
          nutrition: item.nutrition || {},
          allergens: item.allergens || [],
          diet_type: item.diet_type || item.food_type || '',
          food_type: item.food_type || item.diet_type || '',
          category: item.category || '',
          tags: item.tags || [],
          description: item.description || '',
        }];
      }
      saveCart(nc);
      return nc;
    });
    showToastMsg(`🛒 ${item.name} added!`);
  }

  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  function showToastMsg(msg) {
    setToast(msg);
    clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setToast(null), 2600);
  }

  function changeMobileQty(id, delta, btnEl) {
    if (delta < 0) {
      const item = cart.find(c => String(c.id) === String(id));
      if (item) {
        const isFullRemove = item.quantity <= 1 || delta <= -999;
        removeFromCartAnim(btnEl || null, item.name, isFullRemove);
      }
    }
    setCart(prev => {
      const idx = prev.findIndex(c => String(c.id) === String(id));
      if (idx === -1) return prev;
      const nc = prev.map((c, i) =>
        i === idx ? { ...c, quantity: c.quantity + delta } : c
      ).filter(c => c.quantity > 0);
      saveCart(nc);
      return nc;
    });
  }

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageItems  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const cartCount  = cart.reduce((s,i) => s+i.quantity, 0);
  const cartTotal  = cart.reduce((s,i) => s+i.price*i.quantity, 0);

  return (
    <div className={`app-shell ${isDark ? 'dark' : ''}`}>

      {/* ══ LEFT SIDEBAR ══ */}
      <LeftSidebar cart={cart} navigate={navigate} t={t} userData={userData} onProfile={() => setShowProfile(true)} isOpen={leftOpen} onToggle={() => setLeftOpen(o => !o)} currency={currency} onSortOffers={() => { setSortF(''); setCategory('all'); setSearch(''); const el = document.querySelector('.scroll-area'); if(el) el.scrollTo({top:0,behavior:'smooth'}); }} />

      {/* ══ CENTER ══ */}
      <div className="center-col">

        {/* TOP BAR */}
        <header className="topbar">
          {/* ── Main row: Outlet + [Desktop Search] + Icons ── */}
          <div className="tb-main-row">
            {/* Left sidebar toggle */}
            <button className="tb-sidebar-toggle" onClick={() => setLeftOpen(o => !o)} title="Toggle Menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                {leftOpen
                  ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                  : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
                }
              </svg>
            </button>
            <button className="tb-outlet" onClick={() => setShowChangeModal(true)} title="Click to change outlet or category">
              <img
                src="https://www.hotelogix.com/wp-content/themes/hotelogix/images/hotelogix-logo.svg"
                alt="HotelOGIX" className="tb-logo-inline"
                onError={e => { e.target.style.display='none'; }}
              />
              <span className="tb-outlet-icon">🍴</span>
              <div className="tb-outlet-info">
                <span className="tb-outlet-name">{outlet.name || 'Restaurant'}</span>
                <span className="tb-outlet-time">{outlet.timing || '6 AM – 11 PM'}</span>
              </div>
              <span className="tb-outlet-change-hint">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                Change
              </span>
            </button>

            {/* Search — visible on desktop only here */}
            <div className="tb-search-wrap tb-search-desktop">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input ref={searchRef} className="tb-search" placeholder={t('search_placeholder')} value={search} onChange={e=>setSearch(e.target.value)} />
              {search && <button className="tb-search-clr" onClick={() => setSearch('')}>✕</button>}
            </div>

            <div className="tb-right">
              <button className="tb-icon-btn tb-notif" style={{display:'none'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </button>
              {/* Cart panel toggle — desktop only */}
              <button className="tb-icon-btn tb-cart-panel-toggle tb-cart-btn" onClick={() => setRightOpen(o => !o)} title="Your Order">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                {cartCount > 0 && <span className="tb-cart-badge">{cartCount}</span>}
              </button>
              <button className={`tb-icon-btn ${allergenFilter.length > 0 ? 'tb-icon-btn--active' : ''}`} title="Allergen Filter" onClick={() => setShowAllergenPanel(p => !p)}>
                🛡️ {allergenFilter.length > 0 && <span className="tb-cart-badge">{allergenFilter.length}</span>}
              </button>
              <ThemeLangBar compact={true} />
              <button className="tb-avatar" onClick={() => setShowProfile(true)}>
                {(userData?.guestName||userData?.guest?.guest_name||'G').charAt(0).toUpperCase()}
              </button>
              <button className="tb-logout" onClick={() => { localStorage.clear(); navigate('/?logged_out=1'); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>

          {/* ── Mobile search row — only on mobile ── */}
          <div className="tb-mobile-search">
            <div className="tb-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input className="tb-search" placeholder={t('search_placeholder')} value={search} onChange={e=>setSearch(e.target.value)} />
              {search && <button className="tb-search-clr" onClick={() => setSearch('')}>✕</button>}
            </div>
          </div>
        </header>

        {/* SIMPLE FILTER BAR — one clean row */}
        <div className="unified-bar">
          {/* Meal preferences as scrollable pills (if multiple shifts) */}
          {preferences.length > 1 && (
            <div className="filter-row filter-row--meals">
              {preferences.map(pref => (
                <button key={pref.id}
                  className={`flt-pill ${String(pref.id)===activeShift?'flt-pill--on':''}`}
                  onClick={() => { localStorage.setItem('selectedShift', pref.id); setActiveShift(String(pref.id)); loadMenu(pref.id); }}>
                  {pref.icon && <span>{pref.icon}</span>}
                  {pref.title} ({pref.itemCount})
                </button>
              ))}
            </div>
          )}

          {/* Main filter row: Categories + Veg + Sort + Count */}
          <div className="filter-row">
            {/* Category pills */}
            <button className={`flt-pill ${category==='all'?'flt-pill--on':''}`} onClick={() => setCategory('all')}>
              All ({menuItems.length})
            </button>
            {categories.map(cat => (
              <button key={cat} className={`flt-pill ${category===cat?'flt-pill--on':''}`} onClick={() => setCategory(cat)}>
                {cat} ({menuItems.filter(i=>i.category?.includes(cat)).length})
              </button>
            ))}

            {/* Divider */}
            <span className="flt-divider" />

            {/* Veg / Non-veg */}
            <button className={`flt-pill flt-pill--veg ${vegFilter==='veg'?'flt-pill--on':''}`}
              onClick={() => setVegFilter(vegFilter==='veg'?'':'veg')}>🟢 Veg</button>
            <button className={`flt-pill flt-pill--nonveg ${vegFilter==='nonveg'?'flt-pill--on':''}`}
              onClick={() => setVegFilter(vegFilter==='nonveg'?'':'nonveg')}>🔴 Non-Veg</button>

            {/* Sort */}
            <select value={sortF} onChange={e=>setSortF(e.target.value)} className="flt-sel">
              <option value="">Sort</option>
              <option value="price-low">Price ↑</option>
              <option value="price-high">Price ↓</option>
              <option value="popular">Popular</option>
            </select>

            {/* Clear */}
            {(search||priceF||sortF||category!=='all'||vegFilter||allergenFilter.length>0) && (
              <button className="flt-pill flt-pill--clear" onClick={() => { setSearch(''); setPriceF(''); setSortF(''); setCategory('all'); setVegFilter(''); setAllergenFilter([]); }}>✕</button>
            )}

            {/* Count */}
            <span className="flt-count">{filtered.length} items</span>
          </div>
        </div>

        {/* SCROLL AREA */}
        <div className="scroll-area">

          {/* HERO CAROUSEL */}
          {!loading && <HeroCarousel outletData={outlet} />}

          {/* MENU GRID */}
          {loading ? (
            <div className="skl-grid" style={{ gridTemplateColumns:`repeat(${grid},1fr)` }}>
              {[...Array(8)].map((_,i) => (
                <div key={i} className="skl-card">
                  <div className="skl-img" />
                  <div className="skl-body">
                    <div className="skl-line skl-line--lg" />
                    <div className="skl-line skl-line--md" />
                    <div className="skl-line skl-line--sm" />
                  </div>
                </div>
              ))}
            </div>
          ) : pageItems.length === 0 ? (
            <div className="mp__empty">
              <div className="mp__empty-icon">🍽️</div>
              <h3>{t('no_items')}</h3>
              <p>{t('clear_filters')}</p>
              <button onClick={() => { setSearch(''); setPriceF(''); setCategory('all'); }}>{t('clear_filters')}</button>
            </div>
          ) : (
            <>
              <div className="section-hdr">
                <h2 className="section-title">{category==='all'?t('all'):category}</h2>
                <span className="section-count">{filtered.length} {t('items')}</span>
              </div>
              <div className="menu-grid" style={{ gridTemplateColumns:`repeat(${grid},1fr)` }}>
                {pageItems.map(item => (
                  <MenuCard key={item.id} item={item}
                    inCart={!!cart.find(c => String(c.id)===String(item.id))}
                    cartQty={cart.find(c => String(c.id)===String(item.id))?.quantity || 0}
                    onAdd={addToCart} onOpen={setSelItem}
                    onCustomize={setCustomizeItem}
                    onChangeQty={(id, delta) => {
                      setCart(prev => {
                        const idx = prev.findIndex(c => String(c.id)===String(id));
                        if (idx === -1) { if (delta > 0) addToCart(id); return prev; }
                        const nc = prev.map((c, i) =>
                          i === idx ? { ...c, quantity: c.quantity + delta } : c
                        ).filter(c => c.quantity > 0);
                        saveCart(nc);
                        return nc;
                      });
                    }}
                    currency={currency} />
                ))}
              </div>
            </>
          )}

          {/* RECOMMENDATIONS — from API or bestsellers fallback */}
          {!loading && !search && menuItems.length > 0 && (() => {
            // Use API recommendations if available, else fallback to bestsellers/popular
            const apiRecs = recommendations.filter(r => !cart.find(c => String(c.id) === String(r.id)));
            const fallbackRecs = menuItems.filter(i => i.is_bestseller || i.is_popular || i.isBestseller || i.isPopular);
            const recs = apiRecs.length > 0 ? apiRecs : fallbackRecs;
            if (recs.length === 0) return null;
            return (
              <>
                <div className="section-hdr" style={{ marginTop: 24 }}>
                  <h2 className="section-title">✨ {t('recommendations')}</h2>
                  <span className="section-count">{recs.length} {t('items')}</span>
                </div>
                <div className="menu-grid" style={{ gridTemplateColumns:`repeat(${grid},1fr)` }}>
                  {recs.slice(0, 10).map(item => (
                    <MenuCard key={`rec-${item.id}`} item={item}
                      inCart={!!cart.find(c => String(c.id)===String(item.id))}
                      cartQty={cart.find(c => String(c.id)===String(item.id))?.quantity || 0}
                      onAdd={addToCart} onOpen={setSelItem}
                      onCustomize={setCustomizeItem}
                      onChangeQty={(id, delta) => {
                        setCart(prev => {
                          const idx = prev.findIndex(c => String(c.id)===String(id));
                          if (idx === -1) { if (delta > 0) addToCart(id); return prev; }
                          const nc = prev.map((c, i) =>
                            i === idx ? { ...c, quantity: c.quantity + delta } : c
                          ).filter(c => c.quantity > 0);
                          saveCart(nc);
                          return nc;
                        });
                      }}
                      currency={currency} />
                  ))}
                </div>
              </>
            );
          })()}

          {/* ALLERGEN DISCLAIMER BAR */}
          {!loading && allAllergens.length > 0 && (
            <div className="allergen-notice">
              <span className="allergen-notice__icon">⚠️</span>
              <div className="allergen-notice__text">
                <strong>Allergen Notice:</strong> Menu items may contain allergens. Please inform our staff of any dietary requirements or allergies before ordering. Allergen information is indicative only.
              </div>
              <button className="allergen-notice__btn" onClick={() => setShowAllergenPanel(true)}>
                View Allergen Guide
              </button>
            </div>
          )}

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="mp__pg">
              <button className="pg__btn" onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}>← Prev</button>
              {[...Array(Math.min(totalPages,7))].map((_,i) => (
                <button key={i+1} className={`pg__btn ${page===i+1?'pg__btn--on':''}`} onClick={() => setPage(i+1)}>{i+1}</button>
              ))}
              {totalPages > 7 && <span className="pg__sep">…</span>}
              <button className="pg__btn" onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>Next →</button>
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT CART PANEL ══ */}
      <RightCart cart={cart} setCart={setCart} currency={currency} navigate={navigate} t={t} isOpen={rightOpen} onToggle={() => setRightOpen(o => !o)} cartCount={cartCount} />

      {/* ══ ALLERGEN GUIDE & FILTER PANEL ══ */}
      {showAllergenPanel && (
        <div className="co-overlay" onClick={e => { if(e.target.classList.contains('co-overlay')) setShowAllergenPanel(false); }}>
          <div className="co-modal" style={{ maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
            <button className="co-close" onClick={() => setShowAllergenPanel(false)}>✕</button>
            <h3 className="co-title" style={{ fontSize: 18 }}>🛡️ Allergen Guide & Disclaimer</h3>

            {/* Important Notice */}
            <div style={{ background:'rgba(245,166,35,0.12)', border:'1px solid rgba(245,166,35,0.3)', borderRadius:10, padding:'12px 16px', fontSize:13, color:'var(--txt2)', lineHeight:1.6, marginBottom: 16 }}>
              <strong>⚠️ Important Notice:</strong> While we take every precaution, our kitchen handles multiple allergens. Cross-contamination is possible. Always inform staff of severe allergies.
            </div>

            <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 12, lineHeight: 1.5 }}>
              The allergen information provided is based on standard recipes. Ingredients may vary. If you have a food allergy or intolerance, please speak to a member of staff before ordering.
            </p>

            {/* Common Allergen Codes */}
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', marginBottom: 10 }}>Common Allergen Codes</h4>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom: 20 }}>
              {allAllergens.map(a => (
                <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface2,var(--bg3))' }}>
                  <span style={{ width:32, height:32, borderRadius:8, background:a.color||'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:700, flexShrink:0 }}>
                    {a.icon} {a.code}
                  </span>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13, color:'var(--txt)' }}>{a.name}</div>
                    <div style={{ fontSize:11, color:'var(--txt3)' }}>Contains {a.name.toLowerCase()} products</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Filter Section */}
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>🔍 Filter by Allergens</h4>
            <p style={{ fontSize: 12, color: 'var(--txt3)', margin: '0 0 10px' }}>
              Select allergens to <strong>exclude</strong> from the menu:
            </p>
            {allAllergens.length === 0 ? (
              <p style={{ textAlign:'center', color:'var(--txt3)', padding: 16 }}>No allergen data available for current menu items.</p>
            ) : (
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
                {allAllergens.map(a => {
                  const isActive = allergenFilter.includes(a.id);
                  return (
                    <button key={a.id}
                      style={{ background: isActive ? (a.color||'#ef4444') : 'var(--surface2,var(--bg3))', color: isActive ? '#fff' : 'var(--txt)', border: `1.5px solid ${a.color||'#ef4444'}`, borderRadius: 20, padding:'6px 14px', fontSize:13, cursor:'pointer', fontWeight:600, fontFamily:'inherit', transition:'all 150ms', display:'flex', alignItems:'center', gap:4 }}
                      onClick={() => setAllergenFilter(prev => isActive ? prev.filter(x=>x!==a.id) : [...prev, a.id])}>
                      {a.icon} {a.code} {a.name} {isActive && '✕'}
                    </button>
                  );
                })}
              </div>
            )}
            {allergenFilter.length > 0 && (
              <button className="flt-clear" style={{ marginBottom: 12 }} onClick={() => { setAllergenFilter([]); loadMenu(null, []); }}>✕ Clear All Allergen Filters</button>
            )}

            <button className="co-btn co-btn--blue" style={{ marginTop:8, width:'100%' }} onClick={() => { setShowAllergenPanel(false); loadMenu(null, allergenFilter); }}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* ══ MODALS ══ */}
      {showChangeModal && (
        <ChangeSelectionModal
          onClose={() => setShowChangeModal(false)}
          onChangeOutlet={() => {
            setShowChangeModal(false);
            localStorage.removeItem('selectedOutlet');
            localStorage.removeItem('selectedShift');
            navigate(`/preferences?hotel_id=${hotelId}&room=${getRoomParam()}`);
          }}
          onChangeCategory={() => {
            setShowChangeModal(false);
            localStorage.removeItem('selectedShift');
            navigate(`/preferences?hotel_id=${hotelId}&outlet=${selOutlet}&room=${getRoomParam()}`);
          }}
        />
      )}

      {selItem && (
        <ItemModal item={selItem} onClose={() => setSelItem(null)}
          onAdd={addToCart} inCart={!!cart.find(c=>String(c.id)===String(selItem.id))} currency={currency} />
      )}

      {customizeItem && (
        <CustomizeModal
          item={customizeItem}
          onClose={() => setCustomizeItem(null)}
          onSave={(id, custom) => { addToCart(id, custom); setCustomizeItem(null); }}
        />
      )}

      {showProfile && (
        <ProfileModal userData={userData} onClose={() => setShowProfile(false)}
          onHistory={() => { setShowProfile(false); navigate('/history'); }}
          onLogout={() => { setShowProfile(false); localStorage.clear(); navigate('/?logged_out=1'); }} />
      )}

      {/* ══ MOBILE BOTTOM NAV ══ */}
      <nav className="mobile-bottom-nav">
        <button className="mbn-item active" onClick={() => navigate('/menu')}>
          <span className="mbn-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </span>
          Menu
        </button>
        <button className="mbn-item" onClick={() => setMobileCartOpen(true)}>
          <span className="mbn-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          </span>
          {cartCount > 0 && <span className="mbn-badge">{cartCount}</span>}
          Cart
        </button>
        <button className="mbn-item" onClick={() => navigate('/history')}>
          <span className="mbn-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
          </span>
          Orders
        </button>
        <button className="mbn-item" onClick={() => { const el = document.querySelector('.scroll-area'); const sec = el?.querySelector('.section-hdr:last-of-type'); if(sec) sec.scrollIntoView({behavior:'smooth',block:'start'}); else if(el) el.scrollTo({top:el.scrollHeight,behavior:'smooth'}); }}>
          <span className="mbn-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
          </span>
          Picks
        </button>
        <button className="mbn-item" onClick={() => setShowProfile(true)}>
          <span className="mbn-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          </span>
          Profile
        </button>
      </nav>

      {/* ══ MOBILE CART DRAWER ══ */}
      <div className={`mobile-cart-backdrop ${mobileCartOpen ? 'open' : ''}`} onClick={() => setMobileCartOpen(false)} />
      <div className={`mobile-cart-drawer ${mobileCartOpen ? 'open' : ''}`}>
        <div className="mcd-handle"><div className="mcd-handle-bar" /></div>
        <div className="mcd-header">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span className="mcd-title">Your Order</span>
            {cartCount > 0 && <span className="mcd-badge">{cartCount} items</span>}
          </div>
          <button className="mcd-close" onClick={() => setMobileCartOpen(false)}>✕</button>
        </div>
        <div className="mcd-items">
          {cart.length === 0 ? (
            <div className="mcd-empty">
              <div className="mcd-empty-icon">🛒</div>
              <p>Your cart is empty</p>
              <small style={{color:'var(--txt3)',fontSize:12}}>Add something delicious!</small>
            </div>
          ) : (
            cart.map(item => {
              const dietType = (item.food_type||item.diet_type||'').toLowerCase();
              const isVeg = dietType === 'veg' || dietType === 'vegetarian';
              const isNonVeg = dietType === 'nonveg' || dietType === 'non-veg';
              return (
              <div key={item.id} className="mcd-item">
                <div className="mcd-item-img" style={{ backgroundImage: `url('${item.image||''}')` }}>
                  {(isVeg || isNonVeg) && (
                    <span className="mcd-diet">{isVeg ? '🟢' : '🔴'}</span>
                  )}
                </div>
                <div className="mcd-item-info">
                  <div className="mcd-item-name">{item.name}</div>
                  {/* Nutrition row */}
                  {item.nutrition && (
                    <div className="mcd-item-nutri">
                      {item.nutrition.protein && <span>💪{item.nutrition.protein}</span>}
                      {item.nutrition.carbs && <span>🍞{item.nutrition.carbs}</span>}
                      {item.nutrition.fat && <span>🥑{item.nutrition.fat}</span>}
                    </div>
                  )}
                  {/* Allergens */}
                  {item.allergens?.length > 0 && (
                    <div className="mcd-item-allergens">
                      {item.allergens.slice(0,4).map(a => (
                        <span key={a.id} className="mcd-allergen" style={{background:a.color||'#ef4444'}}>{a.icon}</span>
                      ))}
                    </div>
                  )}
                  <div className="mcd-item-price">{currency} {item.price}{item.quantity > 1 ? ` × ${item.quantity} = ${currency} ${item.price * item.quantity}` : ''}</div>
                </div>
                <div className="mcd-item-controls">
                  <button className="mcd-ctrl" onClick={e => changeMobileQty(item.id, -1, e.currentTarget)}>−</button>
                  <span className="mcd-qty">{item.quantity}</span>
                  <button className="mcd-ctrl" onClick={() => changeMobileQty(item.id, 1)}>+</button>
                  <button className="mcd-del" onClick={e => changeMobileQty(item.id, -999, e.currentTarget)}>✕</button>
                </div>
              </div>
              );
            })
          )}
        </div>
        {cart.length > 0 && (
          <div className="mcd-footer">
            <div className="mcd-total-row">
              <span className="mcd-total-label">Total</span>
              <span className="mcd-total-val">{currency} {cartTotal.toLocaleString('en-IN')}</span>
            </div>
            <button className="mcd-place-btn" onClick={() => { setMobileCartOpen(false); navigate('/cart'); }}>
              Review & Place Order
            </button>
          </div>
        )}
      </div>

      {/* ══ TOAST — fixed overlay, never affects layout ══ */}
      {toast && <div className="mp-toast">{toast}</div>}

    </div>
  );
}