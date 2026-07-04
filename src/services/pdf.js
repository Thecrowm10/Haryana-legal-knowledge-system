import api from './api';

export const changePassword       = (current_password, new_password) => api.post('/auth/change-password', { current_password, new_password });
export const requestPasswordReset  = (identifier) => api.post('/auth/forgot-password', { identifier });
export const resetPasswordWithOtp  = (identifier, otp, new_password) => api.post('/auth/reset-password', { identifier, otp, new_password });
export const requestAdminOtp       = (mobile_number) => api.post('/admin/auth/request-otp', { mobile_number });
export const verifyAdminOtp        = (mobile_number, otp) => api.post('/admin/auth/verify-otp', { mobile_number, otp });
// Content-Type is left unset — axios/the browser auto-generates it with the
// multipart boundary for FormData bodies. Setting it manually here previously
// dropped the boundary parameter, which can hang or fail the upload server-side.
export const uploadPdfFile     = (formData) => api.post('/pdf/upload-file', formData);
export const uploadPdfMetadata = (data)     => api.post('/pdf/upload', data);
export const getMyDocuments    = ()         => api.get('/pdf/my-documents');
export const searchDocuments      = (document_type, q, limit = 20) => api.get('/pdf/search-documents', { params: { document_type, q, limit } });
export const getApproverDocuments = (status, skip = 0, limit = 100) => api.get('/pdf/approver/documents', { params: { skip, limit, ...(status ? { status } : {}) } });
export const reviewDocument       = (pdf_id, action, comments, annotations_json) => api.post('/pdf/review', { pdf_id, action, ...(comments ? { comments } : {}), ...(annotations_json ? { annotations_json } : {}) });
export const getPdfFile           = (id)                              => api.get(`/pdf/${id}/file`, { responseType: 'arraybuffer' });
export const getAllDocumentsAdmin  = (status, skip = 0, limit = 500)  => api.get('/pdf/all', { params: { skip, limit, ...(status ? { status } : {}) } });
export const checkDuplicateDocument    = (document_name, document_type_id) => api.get('/pdf/check-duplicate', { params: { document_name, document_type_id } });
export const linkDocumentToDepartment  = (pdf_id)                       => api.post('/pdf/link-department', { pdf_id });
export const getLinkedDocuments        = (link_status)                  => api.get('/pdf/linked-documents', { params: link_status ? { link_status } : {} });
export const getDepartmentLinkRequests = (link_status = 'pending')      => api.get('/pdf/department-link-requests', { params: { link_status } });
export const getAllDepartmentLinks      = (link_status, department_id)   => api.get('/pdf/all-department-links', { params: { ...(link_status ? { link_status } : {}), ...(department_id ? { department_id } : {}) } });
export const reviewDepartmentLink      = (link_id, action, comments, annotations_json) => api.post('/pdf/review-link', { link_id, action, comments: comments || null, annotations_json: annotations_json || null });
