import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE from '../config';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import ThemeLangBar from '../components/ThemeLangBar';
import './Login.css';

export default function Login({ showLogoutSuccess = false }) {
  const navigate = useNavigate();
  const { t } = useLang();
  const { isDark } = useTheme();
  const [hotelId,    setHotelId]    = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [lastName,   setLastName]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [logoutModal, setLogoutModal] = useState(showLogoutSuccess);
  const [hotelIdFromUrl, setHotelIdFromUrl] = useState(false);
  const [roomFromUrl, setRoomFromUrl]       = useState(false);
  const [tableIdFromUrl, setTableIdFromUrl] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);

    // If logged out — show QR screen only, stop everything else
    setLogoutModal(true);    

    const hid   = p.get('hotel_id');
    const room  = p.get('room');
    const table = p.get('table_id');
    const outletId = p.get('outlet_id') || p.get('outlet');

    // If hotel_id + table_id → redirect straight to preferences for auto-login
    if (hid && table) {
      const prefParams = new URLSearchParams({ hotel_id: hid, table_id: table });
      if (outletId) prefParams.set('outlet_id', outletId);
      navigate(`/preferences?${prefParams.toString()}`, { replace: true });
      return;
    }

    // If hotel_id + room → redirect to preferences (has its own login modal)
    if (hid) { setHotelId(hid); setHotelIdFromUrl(true); }
    if (room) { setRoomNumber(room); setRoomFromUrl(true); }
    if (hid && room) {
      const prefParams = new URLSearchParams({ hotel_id: hid, room });
      const hotelName = p.get('hotelName');
      if (hotelName) prefParams.set('hotelName', hotelName);
      navigate(`/preferences?${prefParams.toString()}`, { replace: true });
      return;
    }
  }, [navigate]);

  // No auto-dismiss — QR screen stays until user scans QR

  function redirectToPreferences(hid, room, hotelName) {
    const p = new URLSearchParams({ hotel_id: hid, room });
    if (hotelName) p.append('hotelName', hotelName);
    navigate(`/preferences?${p.toString()}`);
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!hotelId.trim())    { alert('Please enter Hotel ID');    return; }
    if (!roomNumber.trim()) { alert('Please enter Room Number'); return; }
    if (!lastName.trim())   { alert('Please enter Last Name');   return; }

    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/guests/qrlogin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomNumber.trim(), lastName: lastName.trim(), hotelId: hotelId.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      const token = data?.token || data?.authToken || data?.data?.token || data?.jwt;
      if (!token) throw new Error('Authentication failed.');

      const payload = { roomNumber: roomNumber.trim(), confirmationNumber: lastName.trim(), hotelId: hotelId.trim(), lastName: lastName.trim(), token, guestName: data.guestName || data.name || lastName.trim(), ...data };
      localStorage.setItem('userData',    JSON.stringify(payload));
      localStorage.setItem('hotel_id',    hotelId.trim());
      localStorage.setItem('roomNumber',  roomNumber.trim());
      localStorage.setItem('sessionData', JSON.stringify({ loginTime: new Date().toISOString(), lastActivity: new Date().toISOString() }));

      try {
        const hr   = await fetch(`${API_BASE}/api/orders/history?page=1&limit=10`, { headers: { Authorization: `Bearer ${token}` } });
        const hraw = await hr.json().catch(() => null);
        const hist = (Array.isArray(hraw) && hraw) || hraw?.data || hraw?.orders || [];
        localStorage.setItem('orderHistory', JSON.stringify(hist));
      } catch(_) {}

      redirectToPreferences(hotelId.trim(), roomNumber.trim(), data?.guest?.hotel_name || data?.hotelName || 'Hotel');
    } catch(err) {
      alert(err.message || 'Login failed. Please check your details.');
    } finally { setLoading(false); }
  }

  // If logged out, show only the QR scan screen — no login form
  if (logoutModal) {
    return (
      <div className={`lgn-wrap ${isDark ? 'lgn-wrap--dark' : ''}`}>
        <div className="logout-overlay" style={{position:'relative',background:'transparent',backdropFilter:'none'}}>
          <div className="logout-box"> 
             <p className="logout-box__msg">Please scan the QR code again to access the menu.</p>           
            <div style={{margin:'20px auto',width:120,height:120,border:'3px dashed var(--gold,#F5A623)',borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(245,166,35,0.06)'}}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--gold,#F5A623)" strokeWidth="1.5">
                <rect x="2" y="2" width="6" height="6" rx="1"/><rect x="16" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/>
                <rect x="10" y="2" width="4" height="4" rx="0.5"/><rect x="2" y="10" width="4" height="4" rx="0.5"/><rect x="10" y="10" width="4" height="4" rx="0.5"/>
                <rect x="16" y="16" width="6" height="6" rx="1"/><rect x="10" y="16" width="4" height="4" rx="0.5"/><rect x="16" y="10" width="4" height="4" rx="0.5"/>
              </svg>
            </div>
            <p style={{fontSize:16,fontWeight:700,color:'var(--txt,#111)',marginBottom:4}}>Scan the QR Code</p>
            <p style={{fontSize:13,color:'var(--txt3,#9ca3af)',marginBottom:20,lineHeight:1.6,textAlign:'center'}}>
              Look for the QR code in your room, at your table, or at the front desk to access the dining menu.
            </p>

            <div className="logout-box__thanks">
              <strong>Thank you for using HotelOGIX!</strong><br/>
              We hope you enjoyed your experience.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`lgn-wrap ${isDark ? 'lgn-wrap--dark' : ''}`}>
      <div className="lgn-topbar">
        <ThemeLangBar />
      </div>

      <div className="lgn-card">
        <div className="lgn-logo">
          <img src="https://www.hotelogix.com/wp-content/themes/hotelogix/images/hotelogix-logo.svg" alt="HotelOGIX" onError={e => e.target.style.display='none'} />
        </div>

        <h1 className="lgn-title">{t('order_online')}</h1>
        <p className="lgn-sub">{t('login_subtitle')}</p>

        <div className="lgn-form">
          <div className="lgn-group">
            <label>{t('hotel_id')} *</label>
            <input type="text" placeholder="e.g. HTL123" value={hotelId} onChange={e=>setHotelId(e.target.value)} disabled={loading || hotelIdFromUrl} autoFocus={!hotelId} style={hotelIdFromUrl ? {background:'var(--bg3,#f0f2f7)',color:'var(--txt2,#6b7280)'} : {}} />
          </div>
          <div className="lgn-group">
            <label>{t('room_number')} *</label>
            <input type="text" placeholder="e.g. 204" value={roomNumber} onChange={e=>setRoomNumber(e.target.value)} disabled={loading || roomFromUrl} style={roomFromUrl ? {background:'var(--bg3,#f0f2f7)',color:'var(--txt2,#6b7280)'} : {}} />
          </div>
          <div className="lgn-group">
            <label>{t('last_name')} *</label>
            <input type="text" placeholder="e.g. Sharma" value={lastName} onChange={e=>setLastName(e.target.value)} disabled={loading} onKeyDown={e=>e.key==='Enter'&&handleLogin(e)} autoFocus={hotelIdFromUrl && roomFromUrl} />
          </div>
          <button className="lgn-btn" onClick={handleLogin} disabled={loading}>
            {loading ? <><span className="lgn-spinner"/>Verifying…</> : t('login_btn')}
          </button>
        </div>

        <p className="lgn-support">
          {t('need_help')}{' '}
          <button className="lgn-support-link" onClick={() => alert('Support: +91 98765 43210')}>
            {t('contact_support')}
          </button>
        </p>
      </div>
    </div>
  );
}