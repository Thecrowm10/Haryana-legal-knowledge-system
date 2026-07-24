import api from './api';

export const uploadActPartFile   = (formData) => api.post('/act-parts/upload-file', formData);
export const saveActPartSections = (actId, body) => api.post(`/act-parts/${actId}/sections`, body);
export const getActPartSections  = (actId)       => api.get(`/act-parts/${actId}/sections`);
export const saveActPartEntries  = (actId, type, body) => api.post(`/act-parts/${actId}/${type}`, body);
export const getActPartEntries   = (actId, type)       => api.get(`/act-parts/${actId}/${type}`);
export const getAllActParts       = (actId)             => api.get(`/act-parts/${actId}`);
