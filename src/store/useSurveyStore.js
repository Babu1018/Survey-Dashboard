import { create } from 'zustand';
import useAuthStore from './useAuthStore';

const API = 'http://localhost:8000';

const useSurveyStore = create((set, get) => ({
  surveys: [],
  currentSurvey: null,
  loading: false,

  // ─── Surveys ──────────────────────────────────────────────
  fetchSurveys: async (category = null) => {
    const { token } = useAuthStore.getState();
    set({ loading: true });
    try {
      const url = category ? `/api/surveys/?category=${category}` : '/api/surveys/';
      const response = await fetch(`${API}${url}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        throw new Error('Failed to fetch surveys');
      }
      const data = await response.json();
      set({ surveys: data, loading: false });
    } catch (error) {
      console.error("Failed to fetch surveys", error);
      set({ loading: false });
    }
  },

  fetchSurveyDetail: async (id) => {
    const { token } = useAuthStore.getState();
    set({ loading: true });
    try {
      const response = await fetch(`${API}/api/surveys/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        throw new Error('Failed to fetch survey detail');
      }
      const data = await response.json();
      set({ currentSurvey: data, loading: false });
    } catch (error) {
      console.error("Failed to fetch survey detail", error);
      set({ loading: false });
    }
  },

  createSurvey: async (surveyData) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/surveys/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(surveyData),
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        throw new Error('Failed to create survey');
      }
      const newSurvey = await response.json();
      set((state) => ({ surveys: [...state.surveys, newSurvey] }));
      return newSurvey;
    } catch (error) {
      console.error("Failed to create survey", error);
    }
  },

  addQuestions: async (surveyId, questions) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/surveys/${surveyId}/questions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(questions),
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        const err = await response.json();
        throw new Error(err.detail || 'Failed to add questions');
      }
      return true;
    } catch (error) {
      console.error("Failed to add questions", error);
      throw error;
    }
  },

  updateSurvey: async (id, surveyData) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/surveys/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(surveyData),
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        const err = await response.json();
        throw new Error(err.detail || 'Failed to update survey');
      }
      const updated = await response.json();
      set((state) => ({
        surveys: state.surveys.map(s => s.id === Number(id) ? updated : s)
      }));
      return updated;
    } catch (error) {
      console.error("Failed to update survey", error);
      throw error;
    }
  },

  clearQuestions: async (surveyId) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/surveys/${surveyId}/questions`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        const err = await response.json();
        throw new Error(err.detail || 'Failed to clear questions');
      }
      return true;
    } catch (error) {
      console.error("Failed to clear questions", error);
      throw error;
    }
  },

  deleteSurvey: async (surveyId) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/surveys/${surveyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to delete survey');
      }
      
      set((state) => ({
        surveys: state.surveys.filter((s) => s.id !== surveyId)
      }));
      return true;
    } catch (error) {
      console.error("Failed to delete survey", error);
      throw error;
    }
  },

  deleteSurveysByCategory: async (category) => {
    const { token } = useAuthStore.getState();
    set({ loading: true });
    try {
      const response = await fetch(`${API}/api/surveys/bulk-delete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ category })
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        const err = await response.json();
        throw new Error(err.detail || 'Failed to delete category');
      }
      await get().fetchSurveys();
      set({ loading: false });
      return true;
    } catch (error) {
      console.error("Failed to delete surveys by category", error);
      set({ loading: false });
      throw error;
    }
  },

  cloneSurvey: async (surveyId) => {
    const { token } = useAuthStore.getState();
    try {
      // 1. Get full detail
      const res = await fetch(`${API}/api/surveys/${surveyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) useAuthStore.getState().logout();
        const err = await res.json();
        throw new Error(err.detail || 'Failed to fetch survey for cloning');
      }
      const data = await res.json();
      
      // 2. Create new survey
      const newSurveyRes = await fetch(`${API}/api/surveys/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: `${data.title} (Copy)`,
          category: data.category,
          description: data.description || "",
          is_active: data.is_active
        }),
      });
      if (!newSurveyRes.ok) {
        const err = await newSurveyRes.json();
        throw new Error(err.detail || 'Failed to create cloned survey');
      }
      const newSurvey = await newSurveyRes.json();
      
      // 3. Clone questions
      if (data.questions && data.questions.length > 0) {
        const questionsToCopy = data.questions.map(q => ({
          question_text: q.question_text,
          question_type: q.question_type,
          media_type: q.media_type,
          media_url: q.media_url,
          required: q.required,
          order: q.order,
          rating_max: q.rating_max,
          low_label: q.low_label,
          high_label: q.high_label,
          scale: q.scale,
          score_threshold: q.score_threshold,
          threshold_next_question: q.threshold_next_question,
          options: q.options?.map(o => ({
            option_text: o.option_text || '',
            next_question: o.next_question ?? null,
            score: o.score || 0,
            is_red_flag: o.is_red_flag || false,
            media_url: o.media_url || ''
          })) || []
        }));
        
        const qRes = await fetch(`${API}/api/surveys/${newSurvey.id}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(questionsToCopy),
        });
        if (!qRes.ok) throw new Error('Failed to copy questions to clone');
      }
      
      await get().fetchSurveys();
      return true;
    } catch (error) {
      console.error("Failed to clone survey", error);
      throw error;
    }
  },

  cleanupMedia: async () => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/surveys/maintenance/cleanup`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        const err = await response.json();
        throw new Error(err.detail || 'Failed to clean up media');
      }
      return await response.json();
    } catch (error) {
      console.error("Failed to clean up media", error);
      throw error;
    }
  },

  repairDatabase: async () => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/surveys/maintenance/repair`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        const err = await response.json();
        throw new Error(err.detail || 'Failed to repair database');
      }
      return await response.json();
    } catch (error) {
      console.error("Failed to repair database", error);
      throw error;
    }
  },

  // ─── Groups ───────────────────────────────────────────────
  groups: [],

  fetchGroups: async () => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/groups/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        throw new Error('Failed to fetch groups');
      }
      const data = await response.json();
      set({ groups: data });
    } catch (error) {
      console.error("Failed to fetch groups", error);
    }
  },

  createGroup: async (name) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/groups/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        throw new Error('Failed to create group');
      }
      const newGroup = await response.json();
      if (newGroup && newGroup.id) {
        set((state) => ({ groups: [...state.groups, newGroup] }));
      } else {
        await get().fetchGroups();
      }
      return newGroup;
    } catch (error) {
      console.error("Failed to create group", error);
    }
  },

  assignSurveyToGroup: async (groupId, surveyId) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/groups/${groupId}/assign/${surveyId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to assign survey to group');
      const data = await response.json();
      if (data && data.id) {
        set((state) => ({
          groups: state.groups.map(g => g.id === groupId ? data : g)
        }));
      } else {
        await get().fetchGroups();
      }
    } catch (error) {
      console.error("Failed to assign survey to group", error);
      throw error;
    }
  },

  unassignSurveyFromGroup: async (groupId, surveyId) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/groups/${groupId}/assign/${surveyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to unassign survey from group');
      const data = await response.json();
      if (data && data.id) {
        set((state) => ({
          groups: state.groups.map(g => g.id === groupId ? data : g)
        }));
      } else {
        await get().fetchGroups();
      }
    } catch (error) {
      console.error("Failed to unassign survey from group", error);
      throw error;
    }
  },

  deleteGroup: async (groupId) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete group');
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== groupId)
      }));
      return true;
    } catch (error) {
      console.error("Failed to delete group", error);
      throw error;
    }
  },

  updateGroup: async (groupId, groupData) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(groupData),
      });
      if (!response.ok) throw new Error('Failed to update group');
      const data = await response.json();
      if (data && data.id) {
        set((state) => ({
          groups: state.groups.map(g => g.id === groupId ? data : g)
        }));
      } else {
        await get().fetchGroups();
      }
      return data;
    } catch (error) {
      console.error("Failed to update group", error);
      throw error;
    }
  },

  assignUserToGroup: async (groupId, userId) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/groups/${groupId}/users/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to add user to group');
      const data = await response.json();
      if (data && data.id) {
        set((state) => ({
          groups: state.groups.map(g => g.id === groupId ? data : g)
        }));
      } else {
        await get().fetchGroups();
      }
    } catch (error) {
      console.error("Failed to assign user to group", error);
      throw error;
    }
  },

  unassignUserFromGroup: async (groupId, userId) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/groups/${groupId}/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to remove user from group');
      const data = await response.json();
      if (data && data.id) {
        set((state) => ({
          groups: state.groups.map(g => g.id === groupId ? data : g)
        }));
      } else {
        await get().fetchGroups();
      }
    } catch (error) {
      console.error("Failed to unassign user from group", error);
      throw error;
    }
  },


  // ─── Users ────────────────────────────────────────────────
  users: [],

  fetchUsers: async () => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/users/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) useAuthStore.getState().logout();
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      set({ users: data });
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  },

  createUser: async (userData) => {
    const { token } = useAuthStore.getState();
    const response = await fetch(`${API}/api/users/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to create user');
    }
    const newUser = await response.json();
    set((state) => ({ users: [...state.users, newUser] }));
    return newUser;
  },

  deleteUser: async (userId) => {
    const { token } = useAuthStore.getState();
    const response = await fetch(`${API}/api/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (response.ok) {
      set((state) => ({ users: state.users.filter(u => u.id !== userId) }));
      return true;
    }
    return false;
  },

  updateUser: async (userId, userData) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error('Failed to update user');
      const updated = await response.json();
      set((state) => ({
        users: state.users.map(u => u.id === userId ? updated : u)
      }));
      return updated;
    } catch (error) {
      console.error("Failed to update user", error);
      throw error;
    }
  },


  assignSurveyToUser: async (userId, surveyId) => {
    const { token } = useAuthStore.getState();
    const response = await fetch(`${API}/api/users/${userId}/assign-survey/${surveyId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to assign survey');
    const updated = await response.json();
    set((state) => ({ users: state.users.map(u => u.id === userId ? updated : u) }));
    return updated;
  },

  unassignSurveyFromUser: async (userId, surveyId) => {
    const { token } = useAuthStore.getState();
    const response = await fetch(`${API}/api/users/${userId}/assign-survey/${surveyId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to unassign survey');
    const updated = await response.json();
    set((state) => ({ users: state.users.map(u => u.id === userId ? updated : u) }));
    return updated;
  },
}));

export default useSurveyStore;


