import { request } from './apiClient';

export const fetchInbox = (token) =>
  request('/api/notifications/', { token, fallback: 'Failed to load notifications' });

export const markRead = (token, id) =>
  request(`/api/notifications/${id}/read`, { method: 'PATCH', token, fallback: 'Failed to mark notification read' });

export const markAllRead = (token) =>
  request('/api/notifications/read-all', { method: 'POST', token, fallback: 'Failed to mark all read' });

export const remove = (token, id) =>
  request(`/api/notifications/${id}`, { method: 'DELETE', token, fallback: 'Delete failed' });

export const clearAll = (token) =>
  request('/api/notifications/', { method: 'DELETE', token, fallback: 'Clear failed' });
