import { create } from 'zustand';
import useAuthStore from './useAuthStore';
import { WS_API } from '../config/api';
import * as monitorService from '../services/monitorService';


const useMonitorStore = create((set, get) => ({
  recentResponses: [],
  socket: null,
  connected: false,
  // Which respondents this account is allowed to see: Admin sees everyone
  // (scopeAll: true); a Manager only sees users in the groups they manage.
  scopeAll: true,
  scopeUserIds: new Set(),

  fetchRecent: async (limit = 50) => {
    const { token } = useAuthStore.getState();
    try {
      const data = await monitorService.fetchRecent(token, limit);
      set({ recentResponses: data });
    } catch (error) {
      console.error("Failed to fetch recent responses", error);
    }
  },

  managersOverview: [],

  fetchManagersOverview: async () => {
    const { token } = useAuthStore.getState();
    try {
      const data = await monitorService.fetchManagersOverview(token);
      set({ managersOverview: data });
    } catch (error) {
      console.error("Failed to fetch managers overview", error);
    }
  },

  fetchScope: async () => {
    const { token } = useAuthStore.getState();
    try {
      const data = await monitorService.fetchScope(token);
      set({ scopeAll: !!data.all, scopeUserIds: new Set(data.user_ids || []) });
    } catch (error) {
      console.error("Failed to fetch report scope", error);
    }
  },

  connectWebSocket: () => {
    get().fetchScope();
    const ws = new WebSocket(`${WS_API}/api/monitor/ws`);

    ws.onopen = () => {
      console.log("WebSocket connected");
      set({ socket: ws, connected: true });
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'NEW_RESPONSE') {
        const { scopeAll, scopeUserIds } = get();
        if (!scopeAll && !scopeUserIds.has(message.data.user_id)) return;
        set((state) => ({
          recentResponses: [message.data, ...state.recentResponses].slice(0, 50)
        }));
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      set({ socket: null, connected: false });
      // Reconnect after 3 seconds
      setTimeout(() => {
        useMonitorStore.getState().connectWebSocket();
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error", err);
      ws.close();
    };
  },

  fetchResponseDetail: async (id) => {
    const { token } = useAuthStore.getState();
    try {
      return await monitorService.fetchResponseDetail(token, id);
    } catch (error) {
      console.error("Failed to fetch response detail", error);
      return null;
    }
  },

  deleteResponse: async (id) => {
    const { token } = useAuthStore.getState();
    try {
      await monitorService.deleteResponse(token, id);
      set((state) => ({
        recentResponses: state.recentResponses.filter(r => r.id !== id)
      }));
      return true;
    } catch (error) {
      console.error("Failed to delete response", error);
      throw error;
    }
  },

  bulkDeleteResponses: async (ids) => {
    const { token } = useAuthStore.getState();
    try {
      const result = await monitorService.bulkDeleteResponses(token, ids);
      set((state) => ({
        recentResponses: state.recentResponses.filter(r => !ids.includes(r.id))
      }));
      return result;
    } catch (error) {
      console.error("Failed to bulk delete responses", error);
      throw error;
    }
  },

  updateResponseStatus: async (id, status, comment = null) => {
    const { token } = useAuthStore.getState();
    try {
      const updated = await monitorService.updateResponseStatus(token, id, status, comment);
      set((state) => ({
        recentResponses: state.recentResponses.map(r => r.id === id ? { ...r, status: updated.status } : r)
      }));
      return updated;
    } catch (error) {
      console.error("Failed to update status", error);
      throw error;
    }
  },

  // Approve or decline one answer inside a submission. The backend rolls the
  // per-answer decisions up into the parent submission's status and returns
  // it, so the recent feed is kept in step here.
  updateAnswerStatus: async (responseId, answerId, status, note = null) => {
    const { token } = useAuthStore.getState();
    const updated = await monitorService.updateAnswerStatus(token, answerId, status, note);
    set((state) => ({
      recentResponses: state.recentResponses.map(
        r => r.id === responseId ? { ...r, status: updated.response_status } : r
      )
    }));
    return updated;
  }
}));

export default useMonitorStore;
