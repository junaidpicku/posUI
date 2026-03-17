import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import ThemeLangBar from './ThemeLangBar';
import './Sidebar.css';

const safeJSONParse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };

const Icons = {
  Menu:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Cart:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  History: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>,
  Track:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  Home:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  Support: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Logout:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Close:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Refresh: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
};

export default function Sidebar({ open, onClose }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { t }     = useLang();
  const { isDark } = useTheme();

  const userData  = safeJSONParse(localStorage.getItem('userData'), {});
  const cartData  = safeJSONParse(localStorage.getItem('cartData'), []);
  const cartCount = Array.isArray(cartData) ? cartData.reduce((s, i) => s + (i.quantity||1), 0) : 0;
  const guestName = userData?.guestName || userData?.guest?.guest_name || userData?.name || 'Guest';
  const room      = userData?.guest?.guestRoomId || userData?.guest?.room || userData?.roomNumber || 'N/A';
  const hotelName = userData?.guest?.hotel_name || localStorage.getItem('hotelName') || 'HotelOGIX';
  const outletName= safeJSONParse(localStorage.getItem('outlet'), {})?.name || 'Restaurant';
  const loginTime = safeJSONParse(localStorage.getItem('sessionData'), {})?.loginTime;

  const formatLogin = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const h = d.getHours(), m = d.getMinutes();
    return `${days[d.getDay()]}. ${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()} (${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'})`;
  };

  const navItems = [
    { label: t('browse_menu'),    path: '/menu',         Icon: Icons.Menu    },
    { label: t('my_cart'),        path: '/cart',         Icon: Icons.Cart,  badge: cartCount > 0 ? cartCount : null },
    { label: t('order_history'),  path: '/history',      Icon: Icons.History },
    { label: t('track_order'),    path: '/order-status', Icon: Icons.Track   },
    { label: t('my_profile'),     path: '/preferences',  Icon: Icons.Home    },
    { label: t('support'),        path: null,            Icon: Icons.Support },
  ];

  function go(path) {
    if (!path) { alert('Support: +91 98765 43210'); onClose(); return; }
    navigate(path); onClose();
  }

  function handleLogout() { localStorage.clear(); onClose(); navigate('/?logged_out=1'); }

  return (
    <>
      <div className={`sb-backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sb ${open ? 'open' : ''}`}>

        {/* Header */}
        <div className="sb-hdr">
          <div className="sb-hdr-top">
            <div className="sb-brand">
              <div className="sb-brand-icon">🏨</div>
              <div>
                <div className="sb-brand-name">HotelOGIX</div>
                <div className="sb-brand-sub">Room Dining</div>
              </div>
            </div>
            <button className="sb-close" onClick={onClose}><Icons.Close /></button>
          </div>
          <div className="sb-hotel">{hotelName}</div>
          <div className="sb-outlet-chip">{outletName} ▾</div>
        </div>

        {/* Guest chip */}
        <div className="sb-guest">
          <div className="sb-guest-av">{guestName.charAt(0).toUpperCase()}</div>
          <div>
            <div className="sb-guest-name">{guestName}</div>
            <div className="sb-guest-room">{t('room')} {room}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sb-nav">
          {navItems.map(({ label, path, Icon, badge }) => {
            const active = path && location.pathname === path;
            return (
              <button key={label} className={`sb-item ${active ? 'active' : ''}`} onClick={() => go(path)}>
                {active && <span className="sb-active-bar" />}
                <span className="sb-item-icon"><Icon /></span>
                <span className="sb-item-label">{label}</span>
                {badge && <span className="sb-badge">{badge}</span>}
              </button>
            );
          })}
        </nav>

        {/* Last login */}
        <div className="sb-last-login">
          <div className="sb-ll-icon"><Icons.Refresh /></div>
          <div>
            <p className="sb-ll-title">Last Login:</p>
            <p className="sb-ll-time">{formatLogin(loginTime)}</p>
          </div>
        </div>

        {/* Theme + Lang */}
        <div className="sb-settings">
          <ThemeLangBar />
        </div>

        {/* Logout */}
        <div className="sb-foot">
          <button className="sb-logout-btn" onClick={handleLogout}>
            <Icons.Logout /> {t('logout')}
          </button>
        </div>
      </aside>
    </>
  );
}