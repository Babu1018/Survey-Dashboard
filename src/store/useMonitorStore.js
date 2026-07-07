import { create } from 'zustand';
import useAuthStore from './useAuthStore';

const API = 'http://localhost:8000';

const useMonitorStore = create((set) => ({
  recentResponses: [],
  socket: null,
  connected: false,

  fetchRecent: async () => {
    try {
      const response = await fetch(`${API}/api/monitor/recent`);
      const data = await response.json();
      set({ recentResponses: data });
    } catch (error) {
      console.error("Failed to fetch recent responses", error);
    }
  },

  connectWebSocket: () => {
    const ws = new WebSocket('ws://localhost:8000/api/monitor/ws');
    
    ws.onopen = () => {
      console.log("WebSocket connected");
      set({ socket: ws, connected: true });
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'NEW_RESPONSE') {
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
    try {
      const response = await fetch(`${API}/api/monitor/responses/${id}`);
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch response detail", error);
      return null;
    }
  },

  deleteResponse: async (id) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/monitor/responses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to delete response');
      }
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
      const response = await fetch(`${API}/api/monitor/responses/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to delete responses');
      }
      const result = await response.json();
      set((state) => ({
        recentResponses: state.recentResponses.filter(r => !ids.includes(r.id))
      }));
      return result;
    } catch (error) {
      console.error("Failed to bulk delete responses", error);
      throw error;
    }
  },
  
  updateResponseStatus: async (id, status) => {
    const { token } = useAuthStore.getState();
    try {
      const response = await fetch(`${API}/api/monitor/responses/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to update status');
      }
      const updated = await response.json();
      set((state) => ({
        recentResponses: state.recentResponses.map(r => r.id === id ? { ...r, status: updated.status } : r)
      }));
      return updated;
    } catch (error) {
      console.error("Failed to update status", error);
      throw error;
    }
  }
}));

export default useMonitorStore;
