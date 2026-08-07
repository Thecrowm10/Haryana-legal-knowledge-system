import api from './api';

export const getRoleCaps        = ()                     => api.get('/dept-role-limits');
export const upsertRoleCap      = (body)                 => api.put('/dept-role-limits', body);
export const deleteRoleCap      = (deptId, roleId)       => api.delete(`/dept-role-limits/${deptId}/${roleId}`);
export const getActiveUserCount = (deptId, roleId)       => api.get('/dept-role-limits/user-count', { params: { dept_id: deptId, role_id: roleId } });
