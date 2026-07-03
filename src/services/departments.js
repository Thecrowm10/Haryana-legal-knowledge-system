import api from './api';

export const getDepartments        = ()     => api.get('/departments/');
export const getMyDepartments      = ()     => api.get('/users/my-departments');
export const createDepartment      = (data) => api.post('/departments/', data);
export const toggleDepartment      = (id)   => api.patch(`/departments/${id}/toggle`);
export const getDocumentTypes      = ()     => api.get('/document-types/');
export const createDocumentType    = (data) => api.post('/document-types/', data);
export const toggleDocumentType    = (id)   => api.patch(`/document-types/${id}/toggle`);
