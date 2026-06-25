import api from './api';

export const getUsers   = ()     => api.get('/users/');
export const getRoles   = ()     => api.get('/roles/');
export const updateUser = (data) => api.patch('/users/', data);
