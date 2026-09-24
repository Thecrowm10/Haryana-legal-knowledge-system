import api from './api';

// Approver — request that an approved document be unlocked, either so the
// uploader can edit it ('edit') or so it can be soft-deleted ('delete').
// Routed automatically to the Nodal Officer of the document's own department.
export const createUnlockRequest = (pdfId, requestType, reason) =>
  api.post('/unlock-requests', { pdf_id: pdfId, request_type: requestType, ...(reason ? { reason } : {}) });

// Approver — the requester's own history of unlock requests.
export const getMyUnlockRequests = () => api.get('/unlock-requests/my-requests');

// Nodal Officer — pending unlock requests for their own department(s).
export const getPendingUnlockRequests = () => api.get('/unlock-requests/pending');

// Nodal Officer — approve or reject a pending unlock request.
export const reviewUnlockRequest = (id, body) => api.patch(`/unlock-requests/${id}/review`, body);
