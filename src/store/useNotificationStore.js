import { create } from 'zustand';

const useNotificationStore = create((set) => ({
  notification: null,
  
  showSuccess: (message) => {
    set({ notification: { message, type: 'success' } });
    setTimeout(() => set({ notification: null }), 4000);
  },
  
  showError: (message) => {
    set({ notification: { message, type: 'error' } });
    setTimeout(() => set({ notification: null }), 4000);
  },
  
  clearNotification: () => set({ notification: null })
}));

export default useNotificationStore;
