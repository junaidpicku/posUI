// Shared session utilities used across all pages

export const safeJSON = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };

export const getUser = () => safeJSON(localStorage.getItem('userData'), null);
export const getToken = () => getUser()?.token || null;
export const getCurrencySymbol = () => {
  try {
    const u = getUser();
    return u?.guest?.currency_symbol || u?.currency_symbol || '₹';
  } catch { return '₹'; }
};

export const isLoggedIn = () => !!getToken();

export const logout = (navigate) => {
  localStorage.clear();
  if (navigate) navigate('/');
  else window.location.href = '/';
};

export const checkAuth = (navigate) => {
  if (!isLoggedIn()) {
    logout(navigate);
    return false;
  }
  return true;
};