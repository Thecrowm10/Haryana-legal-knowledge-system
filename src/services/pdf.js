import api from './api';

export const uploadPdfFile     = (formData) => api.post('/pdf/upload-file', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const uploadPdfMetadata = (data)     => api.post('/pdf/upload', data);
export const getMyDocuments    = ()         => api.get('/pdf/my-documents');
export const searchDocuments      = (document_type, q, limit = 20) => api.get('/pdf/search-documents', { params: { document_type, q, limit } });
export const getApproverDocuments = (status, skip = 0, limit = 100) => api.get('/pdf/approver/documents', { params: { skip, limit, ...(status ? { status } : {}) } });
export const getPdfFile           = (id)                              => api.get(`/pdf/${id}/file`, { responseType: 'arraybuffer' });
