import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLang, LANGS } from '../context/LangContext';
import './ThemeLangBar.css';

export default function ThemeLangBar({ compact = false }) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { lang, setLanguage, t } = useLang();

  return (
    <div className={`tlb ${compact ? 'tlb--compact' : ''}`}>
      {/* Language selector */}
      <div className="tlb-lang-wrap">
        <select
          className="tlb-lang"
          value={lang}
          onChange={e => setLanguage(e.target.value)}
          title="Language"
        >
          {Object.entries(LANGS).map(([code, { label }]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </div>

      {/* Theme toggle */}
      <button className="tlb-toggle" onClick={toggleTheme} title={isDark ? t('light_mode') : t('dark_mode')}>
        <span className="tlb-toggle-track">
          <span className="tlb-toggle-thumb">
            {isDark ? '🌙' : '☀️'}
          </span>
        </span>
        {!compact && (
          <span className="tlb-toggle-label">
            {isDark ? t('light_mode') : t('dark_mode')}
          </span>
        )}
      </button>
    </div>
  );
}
