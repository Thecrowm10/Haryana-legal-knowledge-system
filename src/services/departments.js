import api from './api';

export const getDepartments   = ()     => api.get('/departments/');
export const createDepartment = (data) => api.post('/departments/', data);
export const getDocumentTypes = ()     => api.get('/document-types/');
