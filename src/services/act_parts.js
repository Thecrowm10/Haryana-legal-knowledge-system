import api from './api';

export const uploadActPartFile        = (formData)           => api.post('/act-parts/upload-file', formData);
export const saveActPartSections      = (actId, body)        => api.post(`/act-parts/${actId}/sections`, body);
export const getActPartSections       = (actId)              => api.get(`/act-parts/${actId}/sections`);
export const saveActPartEntries       = (actId, type, body)  => api.post(`/act-parts/${actId}/${type}`, body);
export const getActPartEntries        = (actId, type)        => api.get(`/act-parts/${actId}/${type}`);
export const getAllActParts            = (actId)              => api.get(`/act-parts/${actId}`);
export const getActPartFile           = (fileRef)            => api.get(`/act-parts/file/${encodeURIComponent(fileRef)}`, { responseType: 'blob' });
export const getActPartApprovals      = (actId)              => api.get(`/act-parts/${actId}/approvals`);
export const submitActPartForApproval = (actId, partType)    => api.post(`/act-parts/${actId}/${partType}/submit`);
export const reviewActPart            = (body)               => api.post('/act-parts/approvals/review', body);
export const getPendingActParts       = ()                   => api.get('/act-parts/approvals/pending');
export const getAllActPartSubmissions  = ()                   => api.get('/act-parts/approvals/all');
export const getMyActPartSubmissions  = ()                   => api.get('/act-parts/approvals/my-submissions');
