import api from './api';

export const getAuditLogs = (params = {}) => api.get('/audit-logs/', { params });
export const getAuditLogActions = () => api.get('/audit-logs/actions');
