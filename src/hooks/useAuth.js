import { useState } from 'react';
import { API_MODE } from '../data/users';
import axios from 'axios';

const ROLE_PROFILES = {
  uploader: { username: 'uploader', role: 'uploader', name: 'Priya Sharma',  dept: 'Revenue Dept.' },
  approver: { username: 'approver', role: 'approver', name: 'Sunil Verma',   dept: 'Legal Dept.' },
  citizen:  { username: 'citizen',  role: 'citizen',  name: 'Ramesh Kumar',  dept: 'Public' },
  csoffice: { username: 'csoffice', role: 'csoffice', name: 'Anita Singh',   dept: 'CS Office' },
  admin:    { username: 'admin',    role: 'admin',    name: 'Vikram Rao',    dept: 'HARTRON / IT Admin' },
  auditor:  { username: 'auditor', role: 'auditor',  name: 'Deepa Nair',    dept: 'Finance Dept.' },
};

export function useAuth() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function loginAsRole(role) {
    setLoading(true);
    setError('');
    try {
      if (API_MODE) {
        const res = await axios.post('/api/auth/login', { role });
        setUser(res.data.user);
      } else {
        setUser(ROLE_PROFILES[role]);
      }
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function logout() { setUser(null); }

  return { user, error, loading, loginAsRole, logout };
}
