// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange, getCurrentUserToken, signOut as firebaseSignOut } from '../firebase/auth';
import { useAuthStore } from '../store/authStore';
import { User as AppUser, Tenant } from '../types';
import { api } from '../utils/api';

interface AuthContextType {
  // Firebase user
  currentUser: User | null;
  // App user data from backend
  user: AppUser | null;
  tenant: Tenant | null;
  role: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  
  // Auth methods
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleSimple: () => Promise<void>;
  signOut: () => Promise<void>;
  
  // Backend sync
  syncUserWithBackend: (idToken: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchWithIdToken(path: string, idToken: string, init?: RequestInit) {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
  
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(init?.headers || {}),
    },
    credentials: "include",
  });
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get Zustand store actions
  const { login: zustandLogin, logout: zustandLogout, updateTenant: zustandUpdateTenant } = useAuthStore();

  const isAuthenticated = currentUser !== null && user !== null;

  const syncUserWithBackend = async (idToken: string) => {
    try {
      
      const response = await fetchWithIdToken('/auth/sync', idToken, { 
        method: 'POST', 
        body: JSON.stringify({}) 
      });
      
      if (import.meta.env.DEV) {
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to sync user with backend');
        } catch (parseError) {
          throw new Error(`Backend sync failed with status ${response.status}: ${errorText}`);
        }
      }
      
      const data = await response.json();
      
      setUser(data.user);
      setTenant(data.tenant || null);
      setRole(data.role);
      
      // Sync with Zustand store for backward compatibility
      zustandLogin(data.user, data.tenant || undefined);
      if (data.tenant) {
        zustandUpdateTenant(data.tenant);
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  const refreshUserData = async () => {
    if (!currentUser) {
      if (import.meta.env.DEV) {
      }
      setLoading(false);
      return;
    }
    
    try {
      if (import.meta.env.DEV) {
      }
      const idToken = await getCurrentUserToken();
      if (!idToken) {
        console.error('❌ No ID token available');
        setLoading(false);
        throw new Error('No ID token available');
      }

      if (import.meta.env.DEV) {
      }
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000);
      });

      const responsePromise = fetchWithIdToken('/auth/me', idToken);
      const response = await Promise.race([responsePromise, timeoutPromise]) as Response;


      let data = null;
      try {
        data = await response.clone().json();
      } catch (e) {
        console.error('❌ Could not parse backend response as JSON:', e);
        const textResponse = await response.text();
        console.error('Raw response:', textResponse);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        console.error('❌ Backend /auth/me failed:', data);
        
        // If token is invalid, try to get a fresh one
        if (response.status === 401) {
          const freshToken = await currentUser.getIdToken(true); // Force refresh
          if (freshToken !== idToken) {
            const retryResponse = await fetchWithIdToken('/auth/me', freshToken);
            if (retryResponse.ok) {
              data = await retryResponse.json();
            } else {
              const retryData = await retryResponse.json().catch(() => ({}));
              console.error('❌ Retry also failed:', retryData);
              throw new Error(retryData?.error || 'Authentication failed after token refresh');
            }
          } else {
            throw new Error(data?.error || 'Authentication failed - token invalid');
          }
        } else {
          throw new Error(data?.error || 'Failed to refresh user data');
        }
      }

      console.log('🔄 Auth refresh successful:', {
        userId: data?.user?.id,
        email: data?.user?.email,
        role: data?.role,
        tenant: data?.tenant?.name,
        tenantSlug: data?.tenant?.slug || data?.user?.tenantSlug
      });

      setRole(data.role);
      if (data.user) {
        setUser(data.user);
        // Sync with Zustand store
        zustandLogin(data.user, data.tenant || undefined);
      }
      if (data.tenant) {
        setTenant(data.tenant);
        zustandUpdateTenant(data.tenant);
      }

      
      setLoading(false);
      
    } catch (error) {
      console.error('❌ Error refreshing user data:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      // If backend fails, at least set some basic user info from Firebase
      if (currentUser) {
        const fallbackUser = {
          id: currentUser.uid,
          email: currentUser.email || '',
          firstName: currentUser.displayName?.split(' ')[0] || '',
          lastName: currentUser.displayName?.split(' ')[1] || '',
          role: 'customer', // Default role
          tenantSlug: null,
          active: true
        };
        
        setUser(fallbackUser as any);
        setRole('customer');
        setTenant(null);
      }
      
      setLoading(false);
      // Don't throw here, just log the error and continue
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      
      // Use popup method only (more reliable)
      const { signInWithGoogle: firebaseSignInWithGoogle } = await import('../firebase/auth');
      
      const { user: firebaseUser, idToken } = await firebaseSignInWithGoogle(false);
      
      if (import.meta.env.DEV) {
      }
      
      // Sync with backend
      const syncData = await syncUserWithBackend(idToken);
      if (import.meta.env.DEV) {
      }
      
      // Navigate based on sync response
      if (syncData.role === 'tenant_admin' && (syncData.user?.tenantSlug || syncData.tenant?.slug)) {
        const tenantSlug = syncData.user?.tenantSlug || syncData.tenant?.slug;
      } else if (syncData.role === 'platform_admin') {
      } else {
      }
      
    } catch (error) {
      console.error('❌ Google sign-in failed:', error);
      setLoading(false);
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('popup') || error.message.includes('blocked')) {
          alert('Pop-up was blocked. Please allow pop-ups for this site and try again.');
        } else if (error.message.includes('cancelled')) {
        } else {
          alert(`Sign-in failed: ${error.message}`);
        }
      }
      throw error;
    }
  };

  // Simple Google login that works like normal login
  const handleGoogleSignInSimple = async () => {
    try {
      setLoading(true);
      
      // Step 1: Get Firebase ID token
      const { signInWithGoogle: firebaseSignInWithGoogle } = await import('../firebase/auth');
      const { user: firebaseUser, idToken } = await firebaseSignInWithGoogle(false);
      
      if (import.meta.env.DEV) {
      }
      
      // Step 2: Call backend API (same as normal login)
      const data = await api.googleLogin(idToken);
      if (import.meta.env.DEV) {
      }
      
      // Step 3: Set state (same as normal login)
      setUser(data.user);
      setTenant(data.tenant || null);
      setRole(data.user.role);
      
      // Step 4: Update Zustand store (same as normal login)
      zustandLogin(data.user, data.tenant);
      if (data.tenant) {
        zustandUpdateTenant(data.tenant);
      }
      
      setLoading(false);
      
    } catch (error) {
      console.error('❌ Simple Google sign-in failed:', error);
      setLoading(false);
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('popup') || error.message.includes('blocked')) {
          alert('Pop-up was blocked. Please allow pop-ups for this site and try again.');
        } else if (error.message.includes('cancelled')) {
        } else {
          alert(`Sign-in failed: ${error.message}`);
        }
      }
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await firebaseSignOut();
      setUser(null);
      setTenant(null);
      setRole(null);
      
      // Clear Zustand store
      zustandLogout();
      
      // Clear any backend session cookies
      try {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
        await fetch(`${baseUrl}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch (error) {
        console.error('Error clearing backend session:', error);
      }
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  useEffect(() => {
    
    // Set up auth state listener
    const unsubscribe = onAuthStateChange(async (firebaseUser: User | null) => {
      if (import.meta.env.DEV) {
      }
      setCurrentUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          await refreshUserData();
        } catch (error) {
          console.error('❌ Error during auth state change:', error);
          // Set loading to false even if refresh fails
          setLoading(false);
        }
      } else {
        setUser(null);
        setTenant(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value: AuthContextType = {
    currentUser,
    user,
    tenant,
    role,
    loading,
    isAuthenticated,
    signInWithGoogle: handleGoogleSignIn,
    signInWithGoogleSimple: handleGoogleSignInSimple,
    signOut: handleSignOut,
    syncUserWithBackend,
    refreshUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
