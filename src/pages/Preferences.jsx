import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE from '../config';
import ThemeLangBar from '../components/ThemeLangBar';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import './Preferences.css';

const IMAGE_API_BASE_URL = API_BASE;

export default function Preferences() {
  const navigate   = useNavigate();
  const { t }      = useLang();
  const { isDark } = useTheme();

  // ── state mirrors original variables ─────────────────────────────────
  const [selectedOutlet, setSelectedOutlet]   = useState(null);
  const [outlets, setOutlets]                 = useState([]);
  const [preferences, setPreferences]         = useState([]);
  const [step, setStep]                       = useState('loading'); // 'loading' | 'outlets' | 'preferences' | 'error'
  const [outletSelectedText, setOutletSelectedText] = useState('');
  const [showBackBtn, setShowBackBtn]         = useState(true);
  const [errorMsg, setErrorMsg]               = useState('');
  const [loading, setLoading]                 = useState(true);

  // Login modal state
  const [showLoginModal, setShowLoginModal]   = useState(false);
  const [loginLastName, setLoginLastName]     = useState('');
  const [loginLoading, setLoginLoading]       = useState(false);
  const [loginError, setLoginError]           = useState('');

  // No-category modal
  const [noCategoryOutletName, setNoCategoryOutletName] = useState(null);

  // Room info modal
  const [roomInfoMsg, setRoomInfoMsg]         = useState(null);

  const hotelIdRef     = useRef('');
  const roomNumberRef  = useRef('');
  const hotelNameRef   = useRef('Hotel');

  // ── mirrors DOMContentLoaded ──────────────────────────────────────────
  useEffect(() => {
    window.isLoginInProgress = false;

    const params      = new URLSearchParams(window.location.search);
    const roomNumber  = params.get('room');
    const tableId     = params.get('table_id');
    const hotelId     = params.get('hotel_id');
    const hotelName   = params.get('hotelName') || 'Hotel';
    const urlOutletId = params.get('outlet_id') || params.get('outlet');

    hotelIdRef.current    = hotelId || localStorage.getItem('hotel_id') || '1';
    roomNumberRef.current = roomNumber || localStorage.getItem('roomNumber') || '';
    hotelNameRef.current  = hotelName;

    if (!hotelId) {
      setRoomInfoMsg('Hotel information is missing. Please scan the QR code again.');
      setLoading(false);
      return;
    }

    if (!roomNumber && !tableId) {
      setRoomInfoMsg('Room or Table information is missing. Please scan the QR code again.');
      setLoading(false);
      return;
    }

    // Store to localStorage
    localStorage.setItem('hotel_id', hotelId);
    if (roomNumber) {
      localStorage.setItem('roomNumber', roomNumber);
      localStorage.removeItem('tableId');
      localStorage.removeItem('tableInfo');
    }
    if (tableId) {
      localStorage.setItem('tableId', tableId);
      localStorage.removeItem('roomNumber');
      if (urlOutletId) localStorage.setItem('urlOutletId', urlOutletId);
    }
    if (hotelName) localStorage.setItem('hotelName', hotelName);

    // Table-based flow
    if (tableId) {
      handleTableFlow(tableId, hotelId, urlOutletId);
      return;
    }

    // Room-based flow
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.token) {
      loadOutletsByHotel(hotelId, userData.token);
    } else {
      setShowLoginModal(true);
      setLoading(false);
    }
  }, []);

  // ── authenticated fetch helper ────────────────────────────────────────
  async function authFetch(url, options = {}) {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const token    = userData.token;
    if (!token) throw new Error('No authentication token found');
    return fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    });
  }

  // ── mirrors fetchTableInfo ────────────────────────────────────────────
  async function fetchTableInfo(tableId, hotelId) {
    try {
      const resp = await fetch(`${API_BASE}/api/table?hotel_id=${hotelId}&pms_table_id=${tableId}`);
      if (!resp.ok) {
        console.warn('fetchTableInfo HTTP error:', resp.status);
        // If rate limited, wait and retry once
        if (resp.status === 429) {
          await new Promise(r => setTimeout(r, 2000));
          const retry = await fetch(`${API_BASE}/api/table?hotel_id=${hotelId}&pms_table_id=${tableId}`);
          if (retry.ok) {
            const retryData = await retry.json().catch(() => null);
            if (retryData?.tables?.length > 0) {
              localStorage.setItem('tableInfo', JSON.stringify(retryData.tables[0]));
              return retryData.tables[0];
            }
          }
        }
        return null;
      }
      const data = await resp.json().catch(() => null);
      if (data?.tables && data.tables.length > 0) {
        localStorage.setItem('tableInfo', JSON.stringify(data.tables[0]));
        return data.tables[0];
      }
      return null;
    } catch (err) {
      console.warn('fetchTableInfo error:', err.message);
      return null;
    }
  }

  // ── Table login flow ──────────────────────────────────────────
  async function handleTableFlow(tableId, hotelId, urlOutletId) {
    try {
      // Check if we already have a valid session from a previous table login
      const existingUser = JSON.parse(localStorage.getItem('userData') || '{}');
      if (existingUser.token && existingUser.isTableBased && existingUser.tableId === tableId) {
        // Already logged in with this table — skip login, go to outlet selection
        const outId = urlOutletId || existingUser.outletId;
        if (outId) {
          localStorage.setItem('selectedOutlet', outId);
          setSelectedOutlet(outId);
          setShowBackBtn(false);
          loadOutletPreferences(outId, existingUser.outletName || 'Outlet', hotelId);
        } else {
          loadOutletsByHotel(hotelId, existingUser.token);
        }
        return;
      }

      // Try to get table info (may fail due to rate limiting)
      let tableInfo = await fetchTableInfo(tableId, hotelId);
      
      // If table API failed, build minimal info from URL params
      if (!tableInfo) {
        tableInfo = {
          table_name: '',
          table_number: '',
          outlet_id: urlOutletId || '',
        };
      }
      
      // If outlet_id came from URL, merge it
      if (urlOutletId) {
        tableInfo.outlet_id = urlOutletId;
      }

      await handleTableLogin(tableId, hotelId, tableInfo);
    } catch (err) {
      console.error('Table flow error:', err);
      // If login fails, show error but don't block — let user retry
      setRoomInfoMsg('Unable to verify table. Please try again or scan the QR code.');
      setLoading(false);
    }
  }

  async function handleTableLogin(tableId, hotelId, tableInfo) {
    let resp, result;
    try {
      resp = await fetch(`${API_BASE}/api/guests/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, hotelId })
      });
      result = await resp.json().catch(() => ({}));
    } catch (err) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    if (!resp.ok) throw new Error(result?.message || 'Table login failed. Please try again.');

    const token = result?.token || result?.authToken || result?.data?.token || result?.jwt;
    if (!token) throw new Error('Authentication failed. Please try again.');

    const userPayload = {
      tableId, tableNumber: tableInfo.table_name || tableInfo.table_number,
      outletId: tableInfo.outlet_id, hotelId, token, isTableBased: true,
      guestName: result.guestName || result.name || 'Guest', ...result
    };
    localStorage.setItem('userData', JSON.stringify(userPayload));
    localStorage.setItem('sessionData', JSON.stringify({ loginTime: new Date().toISOString(), lastActivity: new Date().toISOString() }));

    // REMOVED: Fetch order history for table-based login
    // Skip order history API call when isTableBased is true
    // try {
    //   const hResp = await fetch(`${API_BASE}/api/orders/history?page=1&limit=10&hotel_id=${hotelId}&table_id=${tableId}`, {
    //     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    //   });
    //   ...
    // } catch (_) {}

    // Skip outlet if outlet_id already known
    if (tableInfo.outlet_id) {
      localStorage.setItem('selectedOutlet', tableInfo.outlet_id);
      setSelectedOutlet(tableInfo.outlet_id);
      setShowBackBtn(false);

      try {
        const oResp = await authFetch(`${API_BASE}/api/app/hotels/${hotelId}/outlets`);
        const oData = await oResp.json();
        const outlet = oData.outlets?.find(o => o.id == tableInfo.outlet_id);
        const outletName = outlet?.name || 'Selected Outlet';
        localStorage.setItem('selectedOutletName', outletName);
        setOutletSelectedText(`Table <strong>${tableInfo.table_name || tableInfo.table_number}</strong> - Choose your preferred options for <strong>${outletName}</strong>`);
        loadOutletPreferences(tableInfo.outlet_id, outletName, hotelId);
      } catch (_) {
        loadOutletsByHotel(hotelId, token);
      }
    } else {
      loadOutletsByHotel(hotelId, token);
    }
  }

  // ── mirrors loadOutletsByHotel ────────────────────────────────────────
  async function loadOutletsByHotel(hotelId, token) {
    const hid = hotelId || hotelIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const urlOutletParam = params.get('outlet_id') || params.get('outlet');

      const resp = await authFetch(`${API_BASE}/api/app/hotels/${hid}/outlets`);
      const data = await resp.json();

      if (!data.outlets || data.outlets.length === 0) {
        setLoading(false);
        alert('No outlets available for this hotel');
        return;
      }

      // If outlet param in URL
      if (urlOutletParam) {
        const outlet = data.outlets.find(o => o.id == urlOutletParam);
        if (outlet) {
          localStorage.setItem('selectedOutlet', outlet.id);
          localStorage.setItem('selectedOutletName', outlet.name);
          setSelectedOutlet(outlet.id);
          const userData = JSON.parse(localStorage.getItem('userData') || '{}');
          const tableInfo = JSON.parse(localStorage.getItem('tableInfo') || '{}');
          let prefix = userData.isTableBased && tableInfo.table_name ? `Table <strong>${tableInfo.table_name}</strong> - ` : '';
          setOutletSelectedText(`${prefix}Choose your preferred options for <strong>${outlet.name}</strong>`);
          loadOutletPreferences(outlet.id, outlet.name, hid);
          return;
        }
      }

      // Single outlet - skip outlet selection
      if (data.outlets.length === 1) {
        const outlet = data.outlets[0];
        localStorage.setItem('selectedOutlet', outlet.id);
        localStorage.setItem('selectedOutletName', outlet.name);
        setSelectedOutlet(outlet.id);

        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        if (!userData.isTableBased) setShowBackBtn(false);

        const tableInfo = JSON.parse(localStorage.getItem('tableInfo') || '{}');
        let prefix = userData.isTableBased && tableInfo.table_name ? `Table <strong>${tableInfo.table_name}</strong> - ` : '';
        setOutletSelectedText(`${prefix}Choose your preferred options for <strong>${outlet.name}</strong>`);
        loadOutletPreferences(outlet.id, outlet.name, hid);
      } else {
        setOutlets(data.outlets);
        setStep('outlets');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading outlets:', err);
      setLoading(false);
      if (err.message.includes('authentication')) {
        alert('Session expired. Please login again.');
        localStorage.clear();
        navigate('/');
      } else {
        alert('Failed to load outlets');
      }
    }
  }

  // ── mirrors selectOutlet / proceedToPreferences ───────────────────────
  function selectOutlet(outletId, name) {
    localStorage.setItem('selectedOutlet', outletId);
    localStorage.setItem('selectedOutletName', name);
    setSelectedOutlet(outletId);
    setLoading(true);
    setStep('loading');

    const userData  = JSON.parse(localStorage.getItem('userData') || '{}');
    const tableInfo = JSON.parse(localStorage.getItem('tableInfo') || '{}');
    let prefix = userData.isTableBased && tableInfo.table_name ? `Table <strong>${tableInfo.table_name}</strong> - ` : '';
    setOutletSelectedText(`${prefix}Choose your preferred options for <strong>${name}</strong>`);
    loadOutletPreferences(outletId, name, hotelIdRef.current);
  }

  // ── mirrors loadOutletPreferences ────────────────────────────────────
  async function loadOutletPreferences(outletId, outletName, hotelId) {
    const hid = hotelId || hotelIdRef.current;
    setLoading(true);
    try {
      const resp = await authFetch(`${API_BASE}/api/app/outlets/${outletId}/categories?hotel_id=${hid}`);
      const data = await resp.json();
      const outletData = Object.values(data)[0];

      if (!outletData || !outletData.preferences || outletData.preferences.length === 0) {
        setLoading(false);
        setNoCategoryOutletName(outletName || 'this outlet');
        setStep('noCategory');
        return;
      }

      const validPrefs = outletData.preferences.filter(p => p.itemCount > 0);
      if (validPrefs.length === 0) {
        setLoading(false);
        setNoCategoryOutletName(outletName || 'this outlet');
        setStep('noCategory');
        return;
      }

      localStorage.setItem('outlet', JSON.stringify(outletData));
      setPreferences(validPrefs);
      setStep('preferences');
      setLoading(false);
    } catch (err) {
      console.error('Error loading preferences:', err);
      setLoading(false);
      setNoCategoryOutletName(outletName || 'this outlet');
      setStep('noCategory');
    }
  }

  // ── mirrors goBackToOutlets ───────────────────────────────────────────
  function goBackToOutlets() {
    setPreferences([]);
    setSelectedOutlet(null);
    localStorage.removeItem('selectedShift');
    loadOutletsByHotel(hotelIdRef.current);
  }

  // ── mirrors handleLogin (modal) ───────────────────────────────────────
  async function handleModalLogin(e) {
    e.preventDefault();
    if (!loginLastName.trim()) { setLoginError('Please enter your last name'); return; }
    setLoginLoading(true);
    setLoginError('');
    window.isLoginInProgress = true;

    try {
      const roomNumber = localStorage.getItem('roomNumber');
      const hotelId    = hotelIdRef.current;

      const resp   = await fetch(`${API_BASE}/api/guests/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomNumber, hotelId, lastName: loginLastName.trim() })
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result?.message || 'Login failed. Please check your last name.');

      const token = result?.token || result?.authToken || result?.data?.token || result?.jwt;
      if (!token) throw new Error('Authentication failed. Please try again.');

      const userPayload = {
        roomNumber, hotelId, lastName: loginLastName.trim(), token, isTableBased: false,
        guestName: result.guestName || result.name || loginLastName.trim(), ...result
      };
      localStorage.setItem('userData', JSON.stringify(userPayload));
      localStorage.setItem('sessionData', JSON.stringify({ loginTime: new Date().toISOString(), lastActivity: new Date().toISOString() }));

      // Order history
      try {
        const hResp = await fetch(`${API_BASE}/api/orders/history?page=1&limit=10&hotel_id=${hotelId}&room=${roomNumber}`, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        const hRaw = await hResp.json().catch(() => null);
        let history = (Array.isArray(hRaw) && hRaw) || hRaw?.data || hRaw?.orders || hRaw?.results || [];
        if (!Array.isArray(history) && hRaw && typeof hRaw === 'object') {
          const first = Object.values(hRaw).find(v => Array.isArray(v));
          history = first || [];
        }
        localStorage.setItem('orderHistory', JSON.stringify(history));
      } catch (_) {}

      setShowLoginModal(false);
      window.isLoginInProgress = false;
      loadOutletsByHotel(hotelId, token);

    } catch (err) {
      setLoginError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
      window.isLoginInProgress = false;
    }
  }

  // ── preference card click → navigate to menu ─────────────────────────
  function selectPreference(prefId) {
    localStorage.setItem('selectedShift', prefId);
    navigate('/menu');
  }

  // ───────────────────── render helpers ────────────────────────────────

  function LoadingSpinner() {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 50, height: 50, border: '4px solid #f3f3f3', borderTop: '4px solid #4A90E2', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 15px' }} />
          <p style={{ color: '#666', fontSize: '1rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  function RoomInfoModal({ message }) {
    return (
      <div className="room-info-modal">
        <div className="room-info-content">
          <div className="room-info-icon">🚪</div>
          <h2 className="room-info-title">Access Information Required</h2>
          <p className="room-info-message">{message || "We couldn't find your access information. Please scan the QR code again."}</p>
          <div className="room-info-tip"><strong>💡 Tip:</strong> Make sure you're scanning from the QR code provided in your room, at your table, or by the front desk.</div>
        </div>
      </div>
    );
  }

  function NoCategoryModal({ outletName }) {
    return (
      <div className="room-info-modal" id="noCategoryModal">
        <div className="room-info-content">
          <div className="room-info-icon">📋</div>
          <h2 className="room-info-title">No Categories Available</h2>
          <p className="room-info-message">Sorry, there are currently no menu categories available for <strong>{outletName}</strong>.</p>
          <div className="room-info-tip"><strong>💡 Tip:</strong> Please try another outlet or contact the front desk for assistance.</div>
          <button onClick={() => { setNoCategoryOutletName(null); goBackToOutlets(); }} style={{ marginTop: 20, padding: '12px 24px', background: '#4A90E2', color: 'white', border: 'none', borderRadius: 8, fontSize: '1rem', cursor: 'pointer', fontWeight: 600 }}>
            Go Back to Outlets
          </button>
        </div>
      </div>
    );
  }

  // ───────────────────── main render ───────────────────────────────────

  if (roomInfoMsg) return <RoomInfoModal message={roomInfoMsg} />;
  if (noCategoryOutletName) return <NoCategoryModal outletName={noCategoryOutletName} />;

  return (
    <div className="container">
      {loading && <LoadingSpinner />}

      {/* Guest Login Modal - mirrors showLoginModal() */}
      {showLoginModal && (
        <div className="login-modal">
          <div className="login-modal-content">
            <div className="login-modal-icon">🔑</div>
            <h2 className="login-modal-title">Guest Verification</h2>
            <div className="login-guest-info">
              <p><strong>Hotel:</strong> {hotelNameRef.current}</p>
              <p><strong>Room Number:</strong> {roomNumberRef.current}</p>
            </div>
            <form onSubmit={handleModalLogin}>
              <div className="login-form-group">
                <label htmlFor="guestLastName">Last Name *</label>
                <input
                  type="text"
                  id="guestLastName"
                  placeholder="Enter your last name"
                  value={loginLastName}
                  onChange={e => setLoginLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                  autoFocus
                  disabled={loginLoading}
                />
              </div>
              <button type="submit" className="login-btn" disabled={loginLoading}>
                {loginLoading ? 'Verifying...' : 'Verify & Continue'}
              </button>
              {loginError && <div className="login-error">{loginError}</div>}
            </form>
          </div>
        </div>
      )}

      <div className="preferences-page">
        <div className="preferences-content" style={{ position:'relative' }}>

          {/* Logo */}
          <div className="hotelogix-logo">
            <img src="https://www.hotelogix.com/wp-content/themes/hotelogix/images/hotelogix-logo.svg" alt="HotelOGIX Logo" />
          </div>
          <div className="preferences-theme-bar" style={{ position:'absolute', top:20, right:20, zIndex:10 }}>
            <ThemeLangBar compact={true} />
          </div>

          {/* Step 1: Outlet Selection */}
          {step === 'outlets' && (
            <div className="step-section" id="outletSelection">
              <h2>Select Your Preferred Outlet</h2>
              <p>Choose from our premium dining and service outlets</p>
              <div className="outlet-options">
                {outlets.map(outlet => {
                  let timing = '';
                  try {
                    let periods = outlet.service_periods;
                    if (typeof periods === 'string') periods = JSON.parse(periods);
                    if (Array.isArray(periods) && periods.length)
                      timing = periods.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' • ');
                  } catch (_) { timing = 'All Day'; }

                  return (
                    <div key={outlet.id} className="outlet-option" onClick={() => selectOutlet(outlet.id, outlet.name)}>
                      <span className="outlet-icon">{outlet.icon}</span>
                      <div className="outlet-title">{outlet.name}</div>
                      <div className="outlet-description">{outlet.type_label || 'Restaurant'}</div>
                      {timing && <div className="outlet-time">{timing}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Preferences */}
          {step === 'preferences' && (
            <div className="step-section" id="preferencesSelection">
              {showBackBtn && (
                <button className="back-step-btn" onClick={goBackToOutlets}>← Back to Outlets</button>
              )}
              <h2>Select Your Dining Preference</h2>
              <p
                id="outletSelectedText"
                dangerouslySetInnerHTML={{ __html: outletSelectedText || 'Choose your preferred menu options' }}
              />
              <div className="shift-options" id="dynamicPreferences">
                {preferences.map(pref => {
                  const iconDisplay = pref.image_path
                    ? `${IMAGE_API_BASE_URL}/images/restaurant/${pref.image_path}`
                    : pref.image_url
                      ? `${IMAGE_API_BASE_URL}/images/restaurant/${pref.image_url}`
                      : null;

                  return (
                    <div key={pref.id} className="shift-option" onClick={() => selectPreference(pref.id)}>
                      <span className="shift-icon">
                        {iconDisplay
                          ? <img src={iconDisplay} alt={pref.title} width={48} height={48} style={{ objectFit: 'cover', borderRadius: 8 }} onError={e => { e.target.style.display = 'none'; }} />
                          : (pref.icon || '🍽️')
                        }
                      </span>
                      <div className="shift-title">{pref.title}</div>
                      <div className="shift-description">{pref.description}</div>
                      <div className="shift-time">{pref.time}</div>
                      <div className="shift-item-count">{pref.itemCount} items</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}