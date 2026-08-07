import api from './api';

export const sendFirstLoginMobileOtp = () =>
  api.post('/auth/first-login/send-mobile-otp');

export const verifyFirstLoginMobileOtp = (otp) =>
  api.post('/auth/first-login/verify-mobile-otp', { otp });

export const firstLoginResetPassword = (new_password) =>
  api.post('/auth/first-login/reset-password', { new_password });
