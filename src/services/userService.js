import { request } from './apiClient';

export const fetchUsers = (token) =>
  request('/api/users/', { token, fallback: 'Failed to fetch users' });

export const fetchLoginLogs = (token) =>
  request('/api/users/login-logs', { token, fallback: 'Failed to fetch login logs' });

export const createUser = (token, userData) =>
  request('/api/users/', { method: 'POST', token, body: userData, fallback: 'Failed to create user' });

export const deleteUser = (token, userId, deleteHistory = false) =>
  request(`/api/users/${userId}?delete_history=${deleteHistory}`, { method: 'DELETE', token, fallback: 'Failed to delete user' });

export const updateUser = (token, userId, userData) =>
  request(`/api/users/${userId}`, { method: 'PATCH', token, body: userData, fallback: 'Failed to update user' });

export const assignSurveyToUser = (token, userId, surveyId) =>
  request(`/api/users/${userId}/assign-survey/${surveyId}`, { method: 'POST', token, fallback: 'Failed to assign survey' });

export const unassignSurveyFromUser = (token, userId, surveyId) =>
  request(`/api/users/${userId}/assign-survey/${surveyId}`, { method: 'DELETE', token, fallback: 'Failed to unassign survey' });

export const notifyGoal = (token, userId, days, count) =>
  request(`/api/users/${userId}/notify-goal`, { method: 'POST', token, body: { days, count }, fallback: 'Failed to notify user' });
