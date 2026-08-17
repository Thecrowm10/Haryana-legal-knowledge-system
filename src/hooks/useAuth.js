import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { changePassword as changePasswordApi } from '../services/pdf';
import { encryptLoginPayload } from '../services/crypto';

const CITIZEN_PROFILE = { username: 'citizen', role: 'citizen', name: 'Guest', dept: '', mustChangePassword: false };
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes of inactivity — standard govt-portal idle timeout
const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function normalizeRole(role) {
  return role?.trim().toLowerCase().replace(/\s+/g, '_');
}

function userFromPayload(payload) {
  const firstName = payload.first_name || '';
  const lastName  = payload.last_name  || '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ');
  // The JWT's department_id can come back as a string ("3") while departments[].id
  // is numeric — normalize before comparing, or every lookup below silently misses.
  const deptId = payload.department_id != null ? Number(payload.department_id) : null;
  return {
    username:           payload.username,
    role:               normalizeRole(payload.role),
    name:               payload.username,
    firstName,
    lastName,
    fullName,
    email:              payload.email,
    dept:               payload.departments?.find(d => d.id === deptId)?.name
                          ?? payload.departments?.[0]?.name ?? payload.department ?? '',
    isActive:           payload.is_active,
    mustChangePassword: payload.must_change_password ?? false,
    passwordExpired:    payload.password_expired ?? false,
    mobileVerified:     payload.mobile_verified ?? false,
    mobile:             payload.mobile_number || '',
    deptId,
    departments:        payload.departments   || [],
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
  const lastRefreshRef        = useRef(0);

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('hlks:session-expired', handler);
    return () => window.removeEventListener('hlks:session-expired', handler);
  }, []);

  // Idle/inactivity timeout — separate from the reactive 401 handler above.
  // Only applies to real authenticated (token-based) sessions, not the
  // citizen guest role, which has no backend session to protect.
  useEffect(() => {
    if (!user || user.role === 'citizen') return;

    // Refresh the JWT when the user is active and the token has < 5 min left.
    // Capped at one API call per minute to avoid hammering on rapid mouse events.
    async function refreshTokenIfNeeded() {
      const now = Date.now();
      if (now - lastRefreshRef.current < 60_000) return;
      const token = localStorage.getItem('token');
      if (!token) return;
      const payload = decodeJwt(token);
      if (!payload || !payload.exp) return;
      if (payload.exp * 1000 - now > 5 * 60 * 1000) return; // more than 5 min left
      lastRefreshRef.current = now;
      try {
        const res = await api.post('/auth/refresh');
        const newToken = res.data.access_token;
        localStorage.setItem('token', newToken);
        const newPayload = decodeJwt(newToken);
        if (newPayload) setUser(userFromPayload(newPayload));
      } catch {
        // silent — the 401 interceptor or idle timer will handle actual expiry
      }
    }

    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => logout(), IDLE_TIMEOUT_MS);
      refreshTokenIfNeeded();
    };

    IDLE_EVENTS.forEach(evt => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer);
      IDLE_EVENTS.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [user]);

  async function loginAsRole({ username, password, role, token } = {}) {
    if (role === 'citizen') { setUser(CITIZEN_PROFILE); return; }
    // Admin OTP flow: after verify-otp the component passes the raw token directly.
    if (token) { loginWithToken(token); return; }

    setLoading(true);
    setError('');
    try {
      const encrypted_payload = await encryptLoginPayload(username, password);
      const res = await api.post('/auth/login', { encrypted_payload });
      const token = res.data.access_token;
      const payload = decodeJwt(token);
      if (!payload) throw new Error('Invalid token received');

      // Only super_admin must log in via the OTP flow; admin now uses the
      // same username/password officer login as other department roles.
      if (normalizeRole(payload.role) === 'super_admin') {
        setError(' Admin accounts must sign in via  Admin Access  on the portal selection screen.');
        return;
      }

      localStorage.setItem('token', token);
      setUser(userFromPayload(payload));
    } catch (err) {
      localStorage.removeItem('token');
      if (!err.response) {
        // Network error or crypto failure (not an API response)
        setError(err.message || 'Login failed. Please try again.');
      } else {
        const detail = err.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function loginWithToken(token) {
    const payload = decodeJwt(token);
    if (!payload) return;
    localStorage.setItem('token', token);
    setUser(userFromPayload(payload));
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

  return { user, error, loading, loginAsRole, loginWithToken, changePass, logout };
}
