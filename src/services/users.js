import api from './api';

export const getUsers    = (skip = 0, limit = 10, status = null, departmentId = null) => api.get('/users/', { params: { skip, limit, ...(status ? { status } : {}), ...(departmentId ? { department_id: departmentId } : {}) } });
export const getRoles    = ()     => api.get('/roles/');
export const updateUser  = (data) => api.patch('/users/', data);
export const registerUser = (data) => api.post('/auth/register', data);
export const getApproversByDepartment = (departmentId) => api.get('/users/approvers', { params: { department_id: departmentId } });
