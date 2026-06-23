import api from './api';

export const getAnalytics    = () => api.get('/analytics');
export const getAuditLog     = () => api.get('/audit');
export const getGraphData    = () => api.get('/knowledge-graph');
