import { request } from './apiClient';

export const fetchRecent = (token, limit = 50) =>
  request(`/api/monitor/recent?limit=${limit}`, { token, fallback: 'Failed to fetch recent responses' });

export const fetchManagersOverview = (token) =>
  request('/api/monitor/managers-overview', { token, fallback: 'Failed to fetch managers overview' });

export const fetchScope = (token) =>
  request('/api/monitor/my-scope', { token, fallback: 'Failed to fetch report scope' });

export const fetchResponseDetail = (token, id) =>
  request(`/api/monitor/responses/${id}`, { token, fallback: 'Failed to fetch response detail' });

export const deleteResponse = (token, id) =>
  request(`/api/monitor/responses/${id}`, { method: 'DELETE', token, fallback: 'Failed to delete response' });

export const bulkDeleteResponses = (token, ids) =>
  request('/api/monitor/responses/bulk-delete', { method: 'POST', token, body: { ids }, fallback: 'Failed to delete responses' });

export const updateResponseStatus = (token, id, status, comment = null) =>
  request(`/api/monitor/responses/${id}/status`, { method: 'PATCH', token, body: { status, comment }, fallback: 'Failed to update status' });

export const updateAnswerStatus = (token, answerId, status, note = null) =>
  request(`/api/monitor/answers/${answerId}/status`, { method: 'PATCH', token, body: { status, note }, fallback: 'Failed to review answer' });
