import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (username, password) => {
        try {
          const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Login failed');
          }

          const data = await response.json();
          set({
            user: data.user,
            token: data.access_token,
            isAuthenticated: true,
          });
          return data.user;
        } catch (error) {
          console.error('Login error:', error);
          throw error;
        }
      },

      changePassword: async (newPassword) => {
        const { token } = useAuthStore.getState();
        try {
          const response = await fetch('http://localhost:8000/api/auth/change-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ new_password: newPassword }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to change password');
          }

          // Update user state locally
          set((state) => ({
            user: { ...state.user, is_first_login: false }
          }));
          
          return true;
        } catch (error) {
          console.error('Password change error:', error);
          throw error;
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        localStorage.removeItem('auth-storage');
      },

      checkAuth: async () => {
        const { token } = useAuthStore.getState();
        if (!token) return false;

        try {
          const response = await fetch('http://localhost:8000/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (response.ok) {
            const user = await response.json();
            set({ user, isAuthenticated: true });
            return true;
          } else {
            set({ user: null, token: null, isAuthenticated: false });
            return false;
          }
        } catch {
          set({ user: null, token: null, isAuthenticated: false });
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

export default useAuthStore;
