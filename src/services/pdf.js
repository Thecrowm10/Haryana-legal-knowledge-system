import api from './api';

export const uploadPdfFile     = (formData) => api.post('/pdf/upload-file', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const uploadPdfMetadata = (data)     => api.post('/pdf/upload', data);
export const getMyDocuments    = ()         => api.get('/pdf/my-documents');
