import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeLangBar from '../components/ThemeLangBar';
import { useLang } from '../context/LangContext';
import './Verify.css';

export default function Verify() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [phone, setPhone]       = useState('Loading...');
  const [loading, setLoading]   = useState(false);
  const inputRefs               = useRef([]);

  // ── mirrors DOMContentLoaded in verify.js ────────────────────────────
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.phone) {
      setPhone(userData.phone);
    } else {
      navigate('/');
    }
    if (inputRefs.current[0]) inputRefs.current[0].focus();
  }, [navigate]);

  // ── mirrors moveToNext() ──────────────────────────────────────────────
  function handleOtpChange(value, index) {
    const sanitized = value.replace(/[^0-9]/g, '').slice(-1);
    const newOtp    = [...otp];
    newOtp[index]   = sanitized;
    setOtp(newOtp);

    if (sanitized && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    const filled = newOtp.join('');
    if (filled.length === 6) {
      setTimeout(() => verifyOTP(filled), 500);
    }
  }

  // ── mirrors keydown handler ───────────────────────────────────────────
  function handleKeyDown(e, index) {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  }

  // ── mirrors verifyOTP() ───────────────────────────────────────────────
  function verifyOTP(code) {
    const otpCode = code || otp.join('');
    if (otpCode.length < 6) {
      alert('Please enter complete 6-digit OTP');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/preferences');
    }, 1000);
  }

  // ── mirrors resendOTP() ───────────────────────────────────────────────
  function resendOTP() {
    const randomOTP = Math.floor(100000 + Math.random() * 900000);
    alert(`New OTP sent: ${randomOTP}`);
  }

  return (
    <div className="container">
      <div className="otp-page">
        <div className="otp-content" style={{ position:'relative' }}>
          <div style={{ position:'absolute', top:14, right:14 }}><ThemeLangBar compact={true} /></div>

          {/* Logo */}
          <div className="hotelogix-logo">
            <img
              src="https://www.hotelogix.com/wp-content/themes/hotelogix/images/hotelogix-logo.svg"
              alt="HotelOGIX Logo"
            />
          </div>

          <h1 className="otp-title">Verify Your Identity</h1>
          <p className="otp-description">We've sent a 6-digit verification code to</p>
          <p className="phone-display">{phone}</p>

          {/* OTP inputs */}
          <div className="otp-container">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => (inputRefs.current[i] = el)}
                type="text"
                className="otp-input"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(e.target.value, i)}
                onKeyDown={e => handleKeyDown(e, i)}
                inputMode="numeric"
              />
            ))}
          </div>

          <button
            className="otp-btn"
            onClick={() => verifyOTP()}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Verify & Continue →'}
          </button>

          <div className="resend-section">
            <span style={{ color: '#888' }}>Didn't receive code? </span>
            <button className="resend-btn" onClick={resendOTP}>Resend OTP</button>
          </div>

        </div>
      </div>
    </div>
  );
}
