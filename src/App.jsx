import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LangProvider } from './context/LangContext';
import SessionGuard from './components/SessionGuard';
import Login from './pages/Login';
import Preferences from './pages/Preferences';
import Verify from './pages/Verify';
import Menu from './pages/menu/Menu';
import Cart from './pages/Cart';
import History from './pages/History';
import OrderStatus from './pages/OrderStatus';
import Success from './pages/Success';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <Router>
          <SessionGuard>
            <Routes>
              <Route path="/"             element={<Login />} />
              <Route path="/login"        element={<Login />} />
              <Route path="/preferences"  element={<Preferences />} />
              <Route path="/verify"       element={<Verify />} />
              <Route path="/menu"         element={<Menu />} />
              <Route path="/cart"         element={<Cart />} />
              <Route path="/history"      element={<History />} />
              <Route path="/order-status" element={<OrderStatus />} />
              <Route path="/success"      element={<Success />} />
              <Route path="*"             element={<Navigate to="/" replace />} />
            </Routes>
          </SessionGuard>
        </Router>
      </LangProvider>
    </ThemeProvider>
  );
}

export default App;