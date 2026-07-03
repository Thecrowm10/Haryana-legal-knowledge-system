import api from './api';

export const changePassword       = (current_password, new_password) => api.post('/auth/change-password', { current_password, new_password });
export const requestPasswordReset  = (identifier) => api.post('/auth/forgot-password', { identifier });
export const resetPasswordWithOtp  = (identifier, otp, new_password) => api.post('/auth/reset-password', { identifier, otp, new_password });
export const requestAdminOtp       = (mobile_number) => api.post('/admin/auth/request-otp', { mobile_number });
export const verifyAdminOtp        = (mobile_number, otp) => api.post('/admin/auth/verify-otp', { mobile_number, otp });
export const uploadPdfFile     = (formData) => api.post('/pdf/upload-file', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const uploadPdfMetadata = (data)     => api.post('/pdf/upload', data);
export const getMyDocuments    = ()         => api.get('/pdf/my-documents');
export const searchDocuments      = (document_type, q, limit = 20) => api.get('/pdf/search-documents', { params: { document_type, q, limit } });
export const getApproverDocuments = (status, skip = 0, limit = 100) => api.get('/pdf/approver/documents', { params: { skip, limit, ...(status ? { status } : {}) } });
export const reviewDocument       = (pdf_id, action, comments)        => api.post('/pdf/review', { pdf_id, action, ...(comments ? { comments } : {}) });
export const getPdfFile           = (id)                              => api.get(`/pdf/${id}/file`, { responseType: 'arraybuffer' });
