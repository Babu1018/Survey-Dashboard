import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as authService from '../services/authService';

// Authentik returns {subject, email, username, name, roles[]} instead of
// this app's User shape, so map it onto the fields the UI reads (role,
// is_first_login, is_active) before storing it.
const mapAuthentikUser = (userInfo) => ({
  id: userInfo.subject,
  username: userInfo.username,
  email: userInfo.email,
  name: userInfo.name,
  role: userInfo.roles?.[0] || 'User',
  is_first_login: false,
  is_active: true,
});

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      // Which backend issued the current token, so checkAuth() knows which
      // /me endpoint can actually verify it (local and Authentik tokens are
      // signed differently and are not interchangeable).
      authProvider: null,

      login: async (username, password) => {
        try {
          const data = await authService.login(username, password);
          set({
            user: data.user,
            token: data.access_token,
            isAuthenticated: true,
            authProvider: 'local',
          });
          return data.user;
        } catch (error) {
          console.error('Login error:', error);
          throw error;
        }
      },

      loginEmail: async (email, password) => {
        try {
          const data = await authService.loginEmail(email, password);
          set({
            user: data.user,
            token: data.access_token,
            isAuthenticated: true,
            authProvider: 'local',
          });
          return data.user;
        } catch (error) {
          console.error('Login error:', error);
          throw error;
        }
      },

      loginAuthentik: async (email, password) => {
        try {
          const data = await authService.loginAuthentik(email, password);
          const user = mapAuthentikUser(data.user);
          set({ user, token: data.access_token, isAuthenticated: true, authProvider: 'authentik' });
          return user;
        } catch (error) {
          console.error('Authentik login error:', error);
          throw error;
        }
      },

      lookupUsernameByEmail: async (email) => {
        return authService.lookupUsernameByEmail(email);
      },

      changePassword: async (newPassword) => {
        const { token } = useAuthStore.getState();
        try {
          await authService.changePassword(token, newPassword);

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

      forgotPassword: async (email) => {
        return authService.forgotPassword(email);
      },

      resetPassword: async (email, otp, newPassword) => {
        return authService.resetPassword(email, otp, newPassword);
      },

      requestPhoneOtp: async (phoneNumber) => {
        return authService.requestPhoneOtp(phoneNumber);
      },

      verifyPhoneOtp: async (phoneNumber, otp) => {
        const data = await authService.verifyPhoneOtp(phoneNumber, otp);
        set({
          user: data.user,
          token: data.access_token,
          isAuthenticated: true,
          authProvider: 'local',
        });
        return data.user;
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, authProvider: null });
        localStorage.removeItem('auth-storage');
      },

      checkAuth: async () => {
        const { token, authProvider } = useAuthStore.getState();
        if (!token) return false;

        try {
          if (authProvider === 'authentik') {
            const userInfo = await authService.checkAuthAuthentik(token);
            set({ user: mapAuthentikUser(userInfo), isAuthenticated: true });
          } else {
            const user = await authService.checkAuth(token);
            set({ user, isAuthenticated: true });
          }
          return true;
        } catch {
          set({ user: null, token: null, isAuthenticated: false, authProvider: null });
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
