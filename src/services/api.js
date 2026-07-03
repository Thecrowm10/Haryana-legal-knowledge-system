import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
   
    if (err.response?.status === 401 && err.config?.headers?.Authorization) {
      localStorage.removeItem('token');
      window.dispatchEvent(new CustomEvent('hlks:session-expired'));
    }
    return Promise.reject(err);
  }
);

export default api;
