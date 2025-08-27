import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Tenant } from '../types';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  login: (user: User, tenant?: Tenant) => void;
  logout: () => void;
  updateTenant: (tenant: Tenant) => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      isAuthenticated: false,
      login: (user: User, tenant?: Tenant) => {
        set({ user, tenant, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, tenant: null, isAuthenticated: false });
      },
      updateTenant: (tenant: Tenant) => {
        set({ tenant });
      },
      initialize: () => {
        const state = get();
        // Ensure authentication state is consistent
        if (state.user && !state.isAuthenticated) {
          set({ isAuthenticated: true });
        } else if (!state.user && state.isAuthenticated) {
          set({ isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      version: 1,
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Error rehydrating auth state:', error);
          // Clear corrupted data
          localStorage.removeItem('auth-storage');
          return;
        }
        if (state) {
          // The initialize method will be called after rehydration
          // We don't need to call it here as it will be called in the useEffect
        }
      },
    }
  )
);