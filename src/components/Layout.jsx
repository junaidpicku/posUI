import React, { useState } from 'react';
import Sidebar from './Sidebar';
import './Layout.css';

export default function Layout({ children, title, showBack, onBack, rightSlot }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Top bar */}
      <header className="layout-header">
        <div className="layout-header-left">
          <button className="layout-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">
            <span /><span /><span />
          </button>
          {showBack && (
            <button className="layout-back" onClick={onBack}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                <polyline points="15,18 9,12 15,6" />
              </svg>
            </button>
          )}
          {title && <span className="layout-title">{title}</span>}
        </div>
        <div className="layout-header-right">
          {rightSlot}
        </div>
      </header>

      {/* Page content */}
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
}
