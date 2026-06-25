import { useState } from 'react';
import api from '../services/api';

const CITIZEN_PROFILE = { username: 'citizen', role: 'citizen', name: 'Guest Citizen', dept: '' };

function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
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
  return {
    username: payload.username,
    role:     payload.role,
    name:     payload.username,
    email:    payload.email,
    dept:     payload.department ?? '',
    isActive: payload.is_active,
  };
}

export function useAuth() {
  const [user, setUser] = useState(restoreUserFromToken);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  async function loginAsRole({ username, password, role }) {
    if (role === 'citizen') {
      setUser(CITIZEN_PROFILE);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { username, password });
      const token = res.data.access_token;
      localStorage.setItem('token', token);

      const payload = decodeJwt(token);
      if (!payload) throw new Error('Invalid token received');

      setUser({
        username:  payload.username,
        role:      payload.role,
        name:      payload.username,
        email:     payload.email,
        dept:      payload.department ?? '',
        isActive:  payload.is_active,
      });
    } catch (err) {
      localStorage.removeItem('token');
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  return { user, error, loading, loginAsRole, logout };
}
