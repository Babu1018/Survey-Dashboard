import { create } from 'zustand';
import useAuthStore from './useAuthStore';
import * as surveyService from '../services/surveyService';
import * as groupService from '../services/groupService';
import * as userService from '../services/userService';

const useSurveyStore = create((set, get) => ({
  surveys: [],
  currentSurvey: null,
  loading: false,

  // ─── Surveys ──────────────────────────────────────────────
  fetchSurveys: async (category = null) => {
    const { token } = useAuthStore.getState();
    set({ loading: true });
    try {
      const data = await surveyService.fetchSurveys(token, category);
      set({ surveys: data, loading: false });
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to fetch surveys", error);
      set({ loading: false });
    }
  },

  fetchSurveyDetail: async (id) => {
    const { token } = useAuthStore.getState();
    set({ loading: true });
    try {
      const data = await surveyService.fetchSurveyDetail(token, id);
      set({ currentSurvey: data, loading: false });
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to fetch survey detail", error);
      set({ loading: false });
    }
  },

  createSurvey: async (surveyData) => {
    const { token } = useAuthStore.getState();
    try {
      const newSurvey = await surveyService.createSurvey(token, surveyData);
      set((state) => ({ surveys: [...state.surveys, newSurvey] }));
      return newSurvey;
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to create survey", error);
    }
  },

  addQuestions: async (surveyId, questions) => {
    const { token } = useAuthStore.getState();
    try {
      await surveyService.addQuestions(token, surveyId, questions);
      return true;
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to add questions", error);
      throw error;
    }
  },

  updateSurvey: async (id, surveyData) => {
    const { token } = useAuthStore.getState();
    try {
      const updated = await surveyService.updateSurvey(token, id, surveyData);
      set((state) => ({
        surveys: state.surveys.map(s => s.id === Number(id) ? updated : s)
      }));
      return updated;
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to update survey", error);
      throw error;
    }
  },

  clearQuestions: async (surveyId) => {
    const { token } = useAuthStore.getState();
    try {
      await surveyService.clearQuestions(token, surveyId);
      return true;
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to clear questions", error);
      throw error;
    }
  },

  deleteSurvey: async (surveyId) => {
    const { token } = useAuthStore.getState();
    try {
      await surveyService.deleteSurvey(token, surveyId);
      set((state) => ({
        surveys: state.surveys.filter((s) => s.id !== surveyId)
      }));
      return true;
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to delete survey", error);
      throw error;
    }
  },

  deleteSurveysByCategory: async (category) => {
    const { token } = useAuthStore.getState();
    set({ loading: true });
    try {
      await surveyService.deleteSurveysByCategory(token, category);
      await get().fetchSurveys();
      set({ loading: false });
      return true;
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to delete surveys by category", error);
      set({ loading: false });
      throw error;
    }
  },

  cloneSurvey: async (surveyId) => {
    const { token } = useAuthStore.getState();
    try {
      // 1. Get full detail
      const data = await surveyService.fetchSurveyDetail(token, surveyId);

      // 2. Create new survey
      const newSurvey = await surveyService.createSurvey(token, {
        title: `${data.title} (Copy)`,
        category: data.category,
        description: data.description || "",
        is_active: data.is_active
      });

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

        await surveyService.addQuestions(token, newSurvey.id, questionsToCopy);
      }

      await get().fetchSurveys();
      return true;
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to clone survey", error);
      throw error;
    }
  },

  surveyReport: null,
  surveyReportLoading: false,

  fetchSurveyReport: async (id) => {
    const { token } = useAuthStore.getState();
    set({ surveyReportLoading: true });
    try {
      const data = await surveyService.fetchSurveyReport(token, id);
      set({ surveyReport: data, surveyReportLoading: false });
      return data;
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to fetch survey report", error);
      set({ surveyReportLoading: false });
      throw error;
    }
  },

  repairDatabase: async () => {
    const { token } = useAuthStore.getState();
    try {
      return await surveyService.repairDatabase(token);
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to repair database", error);
      throw error;
    }
  },

  // ─── Groups ───────────────────────────────────────────────
  groups: [],

  fetchGroups: async () => {
    const { token } = useAuthStore.getState();
    try {
      const data = await groupService.fetchGroups(token);
      set({ groups: data });
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to fetch groups", error);
    }
  },

  createGroup: async (name) => {
    const { token } = useAuthStore.getState();
    try {
      const newGroup = await groupService.createGroup(token, name);
      if (newGroup && newGroup.id) {
        set((state) => ({ groups: [...state.groups, newGroup] }));
      } else {
        await get().fetchGroups();
      }
      return newGroup;
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to create group", error);
    }
  },

  assignSurveyToGroup: async (groupId, surveyId) => {
    const { token } = useAuthStore.getState();
    try {
      const data = await groupService.assignSurveyToGroup(token, groupId, surveyId);
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
      const data = await groupService.unassignSurveyFromGroup(token, groupId, surveyId);
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
      await groupService.deleteGroup(token, groupId);
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
      const data = await groupService.updateGroup(token, groupId, groupData);
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

  setGroupManager: async (groupId, managerId) => {
    const { token } = useAuthStore.getState();
    try {
      const data = await groupService.setGroupManager(token, groupId, managerId);
      set((state) => ({
        groups: state.groups.map(g => g.id === groupId ? data : g)
      }));
      return data;
    } catch (error) {
      console.error("Failed to set group manager", error);
      throw error;
    }
  },

  assignUserToGroup: async (groupId, userId) => {
    const { token } = useAuthStore.getState();
    try {
      const data = await groupService.assignUserToGroup(token, groupId, userId);
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
      const data = await groupService.unassignUserFromGroup(token, groupId, userId);
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
      const data = await userService.fetchUsers(token);
      set({ users: data });
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to fetch users", error);
    }
  },

  // ─── Login logs ───────────────────────────────────────────
  loginLogs: [],
  loginLogsLoading: false,

  fetchLoginLogs: async () => {
    const { token } = useAuthStore.getState();
    set({ loginLogsLoading: true });
    try {
      const data = await userService.fetchLoginLogs(token);
      set({ loginLogs: data, loginLogsLoading: false });
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to fetch login logs", error);
      set({ loginLogsLoading: false });
    }
  },

  // ─── My submissions ─────────────────────────────────────────
  mySubmissions: [],
  mySubmissionsLoading: false,

  fetchMySubmissions: async () => {
    const { token } = useAuthStore.getState();
    set({ mySubmissionsLoading: true });
    try {
      const data = await surveyService.fetchMySubmissions(token);
      set({ mySubmissions: data, mySubmissionsLoading: false });
    } catch (error) {
      if (error.status === 401) useAuthStore.getState().logout();
      console.error("Failed to fetch my submissions", error);
      set({ mySubmissionsLoading: false });
    }
  },

  createUser: async (userData) => {
    const { token } = useAuthStore.getState();
    const newUser = await userService.createUser(token, userData);
    set((state) => ({ users: [...state.users, newUser] }));
    return newUser;
  },

  deleteUser: async (userId, deleteHistory = false) => {
    const { token } = useAuthStore.getState();
    try {
      await userService.deleteUser(token, userId, deleteHistory);
      set((state) => ({ users: state.users.filter(u => u.id !== userId) }));
      return true;
    } catch {
      return false;
    }
  },

  updateUser: async (userId, userData) => {
    const { token } = useAuthStore.getState();
    try {
      const updated = await userService.updateUser(token, userId, userData);
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
    const updated = await userService.assignSurveyToUser(token, userId, surveyId);
    set((state) => ({ users: state.users.map(u => u.id === Number(userId) ? updated : u) }));
    return updated;
  },

  unassignSurveyFromUser: async (userId, surveyId) => {
    const { token } = useAuthStore.getState();
    const updated = await userService.unassignSurveyFromUser(token, userId, surveyId);
    set((state) => ({ users: state.users.map(u => u.id === Number(userId) ? updated : u) }));
    return updated;
  },

  notifyGoal: async (userId, days, count) => {
    const { token } = useAuthStore.getState();
    return userService.notifyGoal(token, userId, days, count);
  },
}));

export default useSurveyStore;
