import { request } from './apiClient';

export const fetchGroups = (token) =>
  request('/api/groups/', { token, fallback: 'Failed to fetch groups' });

export const createGroup = (token, name) =>
  request('/api/groups/', { method: 'POST', token, body: { name }, fallback: 'Failed to create group' });

export const assignSurveyToGroup = (token, groupId, surveyId) =>
  request(`/api/groups/${groupId}/assign/${surveyId}`, { method: 'POST', token, fallback: 'Failed to assign survey to group' });

export const unassignSurveyFromGroup = (token, groupId, surveyId) =>
  request(`/api/groups/${groupId}/assign/${surveyId}`, { method: 'DELETE', token, fallback: 'Failed to unassign survey from group' });

export const deleteGroup = (token, groupId) =>
  request(`/api/groups/${groupId}`, { method: 'DELETE', token, fallback: 'Failed to delete group' });

export const updateGroup = (token, groupId, groupData) =>
  request(`/api/groups/${groupId}`, { method: 'PATCH', token, body: groupData, fallback: 'Failed to update group' });

export const setGroupManager = (token, groupId, managerId) =>
  request(`/api/groups/${groupId}/manager`, { method: 'PATCH', token, body: { manager_id: managerId }, fallback: 'Failed to set group manager' });

export const assignUserToGroup = (token, groupId, userId) =>
  request(`/api/groups/${groupId}/users/${userId}`, { method: 'POST', token, fallback: 'Failed to add user to group' });

export const unassignUserFromGroup = (token, groupId, userId) =>
  request(`/api/groups/${groupId}/users/${userId}`, { method: 'DELETE', token, fallback: 'Failed to remove user from group' });
