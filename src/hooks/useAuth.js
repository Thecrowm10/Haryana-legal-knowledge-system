import { useState, useEffect } from 'react';
import api from '../services/api';
import { changePassword as changePasswordApi } from '../services/pdf';

const CITIZEN_PROFILE  = { username: 'citizen', role: 'citizen', name: 'Guest Citizen', dept: '', mustChangePassword: false };
// const DEV_UPLOADER     = { username: 'dept.uploader', role: 'uploader', name: 'Dev Uploader (Mock)',  dept: 'Urban Local Bodies', mustChangePassword: false };
// const DEV_APPROVER     = { username: 'dept.approver', role: 'approver', name: 'Dev Approver (Mock)',  dept: 'Urban Local Bodies', mustChangePassword: false };

function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function userFromPayload(payload) {
  return {
    username:          payload.username,
    role:              payload.role,
    name:              payload.username,
    email:             payload.email,
    dept:              payload.department ?? '',
    isActive:          payload.is_active,
    mustChangePassword: payload.must_change_password ?? false,
  };
}

function restoreUserFromToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload) { localStorage.removeItem('token'); return null; }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    localStorage.removeItem('token');
    return null;
  }
  return userFromPayload(payload);
}

export function useAuth() {
  const [user, setUser]       = useState(restoreUserFromToken);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('hlks:session-expired', handler);
    return () => window.removeEventListener('hlks:session-expired', handler);
  }, []);

  async function loginAsRole({ username, password, role }) {
    if (role === 'citizen') {
      setUser(CITIZEN_PROFILE);
      return;
    }

    // DEV BYPASS — uncomment below to use mock users when backend is unavailable
    // if (username === 'dept.uploader' && password === 'upload123') { setUser(DEV_UPLOADER); return; }
    // if (username === 'dept.approver' && password === 'approve123') { setUser(DEV_APPROVER); return; }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { username, password });
      const token = res.data.access_token;
      localStorage.setItem('token', token);

      const payload = decodeJwt(token);
      if (!payload) throw new Error('Invalid token received');

      setUser(userFromPayload(payload));
    } catch (err) {
      localStorage.removeItem('token');
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function changePass(currentPassword, newPassword) {
    const res = await changePasswordApi(currentPassword, newPassword);
    const token = res.data.access_token;
    localStorage.setItem('token', token);
    const payload = decodeJwt(token);
    if (payload) setUser(userFromPayload(payload));
  }

  function logout() {
    const token = localStorage.getItem('token');
    localStorage.removeItem('token');
    setUser(null);
    if (token) {
      api.post('/auth/logout', null, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }

  return { user, error, loading, loginAsRole, changePass, logout };
}
