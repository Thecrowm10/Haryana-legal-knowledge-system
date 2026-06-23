import api from './api';

export const getDocuments        = ()              => api.get('/documents');
export const getMyUploads        = ()              => api.get('/documents/mine');
export const searchDocuments     = (params)        => api.get('/documents/search', { params });
export const uploadDocument      = (formData)      => api.post('/documents/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const approveDocument     = (id)            => api.post(`/documents/${id}/approve`);
export const rejectDocument      = (id, reason)    => api.post(`/documents/${id}/reject`, { reason });
export const getDocumentById     = (id)            => api.get(`/documents/${id}`);
