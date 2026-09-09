import { request } from './apiClient';

export const login = (username, password) =>
  request('/api/auth/login', { method: 'POST', body: { username, password }, fallback: 'Login failed' });

export const loginEmail = (email, password) =>
  request('/api/auth/login/email', { method: 'POST', body: { email, password }, fallback: 'Login failed' });

export const loginAuthentik = (email, password) =>
  request('/api/auth/authentik/login', { method: 'POST', body: { email, password }, fallback: 'Authentik login failed' });

export const lookupUsernameByEmail = (email) =>
  request('/api/auth/lookup-username', { method: 'POST', body: { email }, fallback: 'Lookup failed' })
    .then((data) => data.username || null)
    .catch(() => null);

export const changePassword = (token, newPassword) =>
  request('/api/auth/change-password', { method: 'POST', token, body: { new_password: newPassword }, fallback: 'Failed to change password' });

export const forgotPassword = (email) =>
  request('/api/auth/forgot-password', { method: 'POST', body: { email }, fallback: 'Failed to request OTP' });

export const resetPassword = (email, otp, newPassword) =>
  request('/api/auth/reset-password', { method: 'POST', body: { email, otp, new_password: newPassword }, fallback: 'Failed to reset password' });

export const requestPhoneOtp = (phoneNumber) =>
  request('/api/auth/login/phone/request-otp', { method: 'POST', body: { phone_number: phoneNumber }, fallback: 'Failed to request OTP' });

export const verifyPhoneOtp = (phoneNumber, otp) =>
  request('/api/auth/login/phone/verify-otp', { method: 'POST', body: { phone_number: phoneNumber, otp }, fallback: 'Invalid or expired OTP' });

export const checkAuth = (token) =>
  request('/api/auth/me', { token, fallback: 'Session check failed' });

export const checkAuthAuthentik = (token) =>
  request('/api/auth/authentik/me', { token, fallback: 'Session check failed' });
