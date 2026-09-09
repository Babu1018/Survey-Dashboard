import { request } from './apiClient';

export const fetchSurveys = (token, category = null) =>
  request(category ? `/api/surveys/?category=${category}` : '/api/surveys/', { token, fallback: 'Failed to fetch surveys' });

export const fetchSurveyDetail = (token, id) =>
  request(`/api/surveys/${id}`, { token, fallback: 'Failed to fetch survey detail' });

export const createSurvey = (token, surveyData) =>
  request('/api/surveys/', { method: 'POST', token, body: surveyData, fallback: 'Failed to create survey' });

export const addQuestions = (token, surveyId, questions) =>
  request(`/api/surveys/${surveyId}/questions`, { method: 'POST', token, body: questions, fallback: 'Failed to add questions' });

export const updateSurvey = (token, id, surveyData) =>
  request(`/api/surveys/${id}`, { method: 'PUT', token, body: surveyData, fallback: 'Failed to update survey' });

export const clearQuestions = (token, surveyId) =>
  request(`/api/surveys/${surveyId}/questions`, { method: 'DELETE', token, fallback: 'Failed to clear questions' });

export const deleteSurvey = (token, surveyId) =>
  request(`/api/surveys/${surveyId}`, { method: 'DELETE', token, fallback: 'Failed to delete survey' });

export const deleteSurveysByCategory = (token, category) =>
  request('/api/surveys/bulk-delete', { method: 'POST', token, body: { category }, fallback: 'Failed to delete category' });

export const fetchSurveyReport = (token, id) =>
  request(`/api/surveys/${id}/report`, { token, fallback: 'Failed to fetch survey report' });

export const repairDatabase = (token) =>
  request('/api/surveys/maintenance/repair', { method: 'POST', token, fallback: 'Failed to repair database' });

export const fetchMySubmissions = (token) =>
  request('/api/surveys/my-responses', { token, fallback: 'Failed to fetch your submissions' });

export const uploadMedia = (token, formData) =>
  request('/api/surveys/upload', { method: 'POST', token, body: formData, isFormData: true, fallback: 'Upload failed' });

// A respondent attaching a file as their answer to a Media Upload question.
// Distinct from uploadMedia (Admin/Manager-only, for authoring survey media):
// this is open to any signed-in user, and the backend validates the file
// against that question's own type/size configuration.
export const uploadAnswerFile = (token, questionId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('question_id', String(questionId));
  return request('/api/surveys/upload-answer', {
    method: 'POST', token, body: formData, isFormData: true, fallback: 'Upload failed',
  });
};

export const submitResponse = (surveyId, responseData) =>
  request(`/api/surveys/${surveyId}/responses`, { method: 'POST', body: responseData, fallback: 'Failed to submit response' });
