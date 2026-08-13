import api from './api';

export const submitCapRequest  = (body)      => api.post('/cap-requests', body);
export const getMyCapRequests  = ()          => api.get('/cap-requests/my-requests');
export const getPendingCapRequests = ()      => api.get('/cap-requests/pending');
export const reviewCapRequest  = (id, body)  => api.patch(`/cap-requests/${id}/review`, body);
