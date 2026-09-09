import { API } from '../config/api';

async function parseError(response, fallback) {
  const body = await response.json().catch(() => ({}));
  const error = new Error(body.detail || fallback);
  error.status = response.status;
  return error;
}

// Single place every backend call goes through: builds the URL, attaches
// auth/content headers, and normalizes failures into an Error with `.status`
// so callers can branch on e.g. 401 without re-parsing the response.
export async function request(path, { method = 'GET', token, body, isFormData = false, fallback = 'Request failed' } = {}) {
  const headers = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  if (!response.ok) throw await parseError(response, fallback);
  if (response.status === 204) return null;
  return response.json();
}
