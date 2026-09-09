import { create } from 'zustand';
import useAuthStore from './useAuthStore';
import * as inboxService from '../services/inboxService';

// Persistent, per-account notification feed shown in the TopBar bell.
// Distinct from useNotificationStore, which is the transient toast strip.
const useInboxStore = create((set, get) => ({
  items: [],
  unread: 0,
  loading: false,

  fetch: async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;
    set({ loading: true });
    try {
      const items = await inboxService.fetchInbox(token);
      set({ items, unread: items.filter(n => !n.is_read).length, loading: false });
    } catch (error) {
      console.error('Failed to load notifications', error);
      set({ loading: false });
    }
  },

  markRead: async (id) => {
    const { token } = useAuthStore.getState();
    // Optimistic: the badge should drop the moment the row is opened.
    set(state => ({
      items: state.items.map(n => (n.id === id ? { ...n, is_read: true } : n)),
      unread: Math.max(0, state.unread - (state.items.find(n => n.id === id && !n.is_read) ? 1 : 0)),
    }));
    try {
      await inboxService.markRead(token, id);
    } catch (error) {
      console.error('Failed to mark notification read', error);
      get().fetch();
    }
  },

  markAllRead: async () => {
    const { token } = useAuthStore.getState();
    set(state => ({ items: state.items.map(n => ({ ...n, is_read: true })), unread: 0 }));
    try {
      await inboxService.markAllRead(token);
    } catch (error) {
      console.error('Failed to mark all read', error);
      get().fetch();
    }
  },

  remove: async (id) => {
    const { token } = useAuthStore.getState();
    const prev = get().items;
    set(state => {
      const gone = state.items.find(n => n.id === id);
      return {
        items: state.items.filter(n => n.id !== id),
        unread: Math.max(0, state.unread - (gone && !gone.is_read ? 1 : 0)),
      };
    });
    try {
      await inboxService.remove(token, id);
    } catch (error) {
      console.error('Failed to delete notification', error);
      set({ items: prev, unread: prev.filter(n => !n.is_read).length });
    }
  },

  clearAll: async () => {
    const { token } = useAuthStore.getState();
    const prev = get().items;
    set({ items: [], unread: 0 });
    try {
      await inboxService.clearAll(token);
    } catch (error) {
      console.error('Failed to clear notifications', error);
      set({ items: prev, unread: prev.filter(n => !n.is_read).length });
    }
  },
}));

export default useInboxStore;
