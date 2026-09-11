import api from './api';

// multipart/form-data — must include role_id, requested_cap and the mandatory
// supporting-document `file`; reason is optional. Content-Type is left unset
// so axios/the browser auto-generates it with the multipart boundary.
export const submitCapRequest  = (formData)  => api.post('/cap-requests', formData);
export const getMyCapRequests  = ()          => api.get('/cap-requests/my-requests');
export const getPendingCapRequests = ()      => api.get('/cap-requests/pending');
export const reviewCapRequest  = (id, body)  => api.patch(`/cap-requests/${id}/review`, body);
export const getCapRequestAttachment = (id)  => api.get(`/cap-requests/${id}/attachment`, { responseType: 'arraybuffer' });
