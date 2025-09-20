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
      if (import.meta.env.DEV) {
        console.log('🔄 Syncing user with backend...');
        console.log('Using API URL configured');
      }
      
      const response = await fetchWithIdToken('/auth/sync', idToken, { 
        method: 'POST', 
        body: JSON.stringify({}) 
      });
      
      if (import.meta.env.DEV) {
        console.log('📡 Backend sync response status:', response.status);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend sync failed - raw response:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          console.error('❌ Backend sync failed - parsed error:', errorData);
          throw new Error(errorData.error || 'Failed to sync user with backend');
        } catch (parseError) {
          console.error('❌ Could not parse error response:', parseError);
          throw new Error(`Backend sync failed with status ${response.status}: ${errorText}`);
        }
      }
      
      const data = await response.json();
      if (import.meta.env.DEV) {
        console.log('✅ Backend sync successful for user with role:', data.role);
      }
      
      setUser(data.user);
      setTenant(data.tenant || null);
      setRole(data.role);
      
      // Sync with Zustand store for backward compatibility
      zustandLogin(data.user, data.tenant || undefined);
      if (data.tenant) {
        zustandUpdateTenant(data.tenant);
      }
      
      if (import.meta.env.DEV) {
        console.log('✅ User state updated successfully');
      }
      return data;
    } catch (error) {
      console.error('❌ Error syncing user with backend:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  };

  const refreshUserData = async () => {
    if (!currentUser) {
      if (import.meta.env.DEV) {
        console.log('❌ No current user for refresh');
      }
      setLoading(false);
      return;
    }
    
    try {
      if (import.meta.env.DEV) {
        console.log('🔄 Getting fresh ID token for backend request...');
      }
      const idToken = await getCurrentUserToken();
      if (!idToken) {
        console.error('❌ No ID token available');
        setLoading(false);
        throw new Error('No ID token available');
      }

      if (import.meta.env.DEV) {
        console.log('📡 Making request to /auth/me endpoint...');
        console.log('🔑 Token available for request');
      }
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000);
      });

      const responsePromise = fetchWithIdToken('/auth/me', idToken);
      const response = await Promise.race([responsePromise, timeoutPromise]) as Response;

      console.log('📡 Backend /auth/me response status:', response.status);

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
          console.log('🔄 Token seems invalid, getting fresh token and retrying...');
          const freshToken = await currentUser.getIdToken(true); // Force refresh
          if (freshToken !== idToken) {
            console.log('✅ Got fresh token, retrying request...');
            const retryResponse = await fetchWithIdToken('/auth/me', freshToken);
            if (retryResponse.ok) {
              data = await retryResponse.json();
              console.log('✅ Retry successful with fresh token');
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

      console.log('✅ Backend /auth/me full response:', data);
      console.log('✅ Backend /auth/me summary:', {
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

      console.log('✅ User data refresh completed successfully');
      
      setLoading(false);
      
    } catch (error) {
      console.error('❌ Error refreshing user data:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      // If backend fails, at least set some basic user info from Firebase
      if (currentUser) {
        console.log('⚠️ Backend failed, using Firebase user data as fallback');
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
      console.log('🚀 Starting Google Sign-In process...');
      setLoading(true);
      
      // Use popup method only (more reliable)
      const { signInWithGoogle: firebaseSignInWithGoogle } = await import('../firebase/auth');
      
      console.log('🪟 Using popup method for Google Sign-In...');
      const { user: firebaseUser, idToken } = await firebaseSignInWithGoogle(false);
      
      console.log('✅ Firebase authentication successful:', firebaseUser.email);
      console.log('🔑 Got ID token, syncing with backend...');
      
      // Sync with backend
      const syncData = await syncUserWithBackend(idToken);
      console.log('✅ Backend sync complete!', syncData);
      
      // Navigate based on sync response
      if (syncData.role === 'tenant_admin' && (syncData.user?.tenantSlug || syncData.tenant?.slug)) {
        const tenantSlug = syncData.user?.tenantSlug || syncData.tenant?.slug;
        console.log('🔄 Sync complete, user will be redirected to tenant dashboard:', tenantSlug);
      } else if (syncData.role === 'platform_admin') {
        console.log('🔄 Sync complete, user will be redirected to platform dashboard');
      } else {
        console.log('🔄 Sync complete, user will be redirected based on role');
      }
      
    } catch (error) {
      console.error('❌ Google sign-in failed:', error);
      setLoading(false);
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('popup') || error.message.includes('blocked')) {
          alert('Pop-up was blocked. Please allow pop-ups for this site and try again.');
        } else if (error.message.includes('cancelled')) {
          console.log('User cancelled sign-in');
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
      console.log('🚀 Starting Simple Google Sign-In...');
      setLoading(true);
      
      // Step 1: Get Firebase ID token
      const { signInWithGoogle: firebaseSignInWithGoogle } = await import('../firebase/auth');
      const { user: firebaseUser, idToken } = await firebaseSignInWithGoogle(false);
      
      console.log('✅ Firebase authentication successful:', firebaseUser.email);
      console.log('🔑 Got ID token, calling backend API...');
      
      // Step 2: Call backend API (same as normal login)
      const data = await api.googleLogin(idToken);
      console.log('✅ Backend login successful:', data);
      
      // Step 3: Set state (same as normal login)
      setUser(data.user);
      setTenant(data.tenant || null);
      setRole(data.user.role);
      
      // Step 4: Update Zustand store (same as normal login)
      zustandLogin(data.user, data.tenant);
      if (data.tenant) {
        zustandUpdateTenant(data.tenant);
      }
      
      console.log('✅ Simple Google login complete!');
      setLoading(false);
      
    } catch (error) {
      console.error('❌ Simple Google sign-in failed:', error);
      setLoading(false);
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('popup') || error.message.includes('blocked')) {
          alert('Pop-up was blocked. Please allow pop-ups for this site and try again.');
        } else if (error.message.includes('cancelled')) {
          console.log('User cancelled sign-in');
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
    console.log('� Setting up auth state listener...');
    
    // Set up auth state listener
    const unsubscribe = onAuthStateChange(async (firebaseUser: User | null) => {
      console.log('🔄 Auth state changed:', firebaseUser ? `User: ${firebaseUser.email}` : 'No user');
      setCurrentUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          console.log('🔄 User authenticated, refreshing backend data...');
          await refreshUserData();
        } catch (error) {
          console.error('❌ Error during auth state change:', error);
          // Set loading to false even if refresh fails
          setLoading(false);
        }
      } else {
        console.log('🔄 No user, clearing state...');
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
