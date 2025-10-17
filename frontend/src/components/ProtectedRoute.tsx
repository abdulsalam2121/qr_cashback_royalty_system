// src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAuthStore } from '../store/authStore';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  isAdmin?: boolean;
  requiredRole?: string;
  roles?: string[];
  requireTenant?: boolean;
}

const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  isAdmin = false, 
  requiredRole,
  roles = [],
  requireTenant = false
}) => {
  const { user, role, tenant, loading, isAuthenticated } = useAuth();
  const { user: zustandUser, tenant: zustandTenant, isAuthenticated: zustandAuth } = useAuthStore();
  const location = useLocation();

  // Use Firebase auth as primary, fallback to zustand for backward compatibility
  const currentUser = user || zustandUser;
  const currentRole = role || currentUser?.role;
  const currentTenant = tenant || zustandTenant;
  const authenticated = isAuthenticated || zustandAuth;

  // Debug logging (only in development and without sensitive data)
  if (import.meta.env.DEV) {
    console.log('🛡️ ProtectedRoute state:', {
      loading,
      authenticated,
      hasUser: !!currentUser,
      currentRole,
      hasTenant: !!currentTenant,
      requireTenant,
      roles,
      location: location.pathname
    });
  }

  // Show loading spinner while auth state is being determined
  if (loading) {
    if (import.meta.env.DEV) {
    }
    return <LoadingSpinner />;
  }

  // If not authenticated, redirect to login
  if (!authenticated || !currentUser) {
    if (import.meta.env.DEV) {
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check tenant requirement - but allow some time for tenant data to load
  if (requireTenant && !currentTenant && currentRole !== 'platform_admin') {
    // If we have a user but no tenant yet, check if user has tenantSlug
    if (currentUser?.tenantSlug) {
      if (import.meta.env.DEV) {
      }
      // Allow access - tenant data may still be loading
    } else {
      if (import.meta.env.DEV) {
      }
      return <Navigate to="/login" replace />;
    }
  }

  // Check role requirements
  if (roles.length > 0 && currentRole && !roles.includes(currentRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // If we have a specific role requirement, check it
  if (requiredRole && currentRole !== requiredRole) {
    // Redirect based on actual role
    if (currentRole === 'platform_admin') {
      return <Navigate to="/platform/dashboard" replace />;
    } else if (currentRole === 'tenant_admin' && currentTenant) {
      return <Navigate to={`/t/${currentTenant.slug}/dashboard`} replace />;
    } else if (currentRole === 'cashier' && currentTenant) {
      return <Navigate to={`/t/${currentTenant.slug}/pos`} replace />;
    } else if (currentRole === 'customer' && currentTenant) {
      return <Navigate to={`/t/${currentTenant.slug}/customer`} replace />;
    } else {
      return <Navigate to="/login" replace />;
    }
  }

  // Admin route protection
  if (isAdmin) {
    if (currentRole !== 'platform_admin' && currentRole !== 'tenant_admin') {
      // Not an admin, redirect to appropriate dashboard
      if (currentRole === 'cashier' && currentTenant) {
        return <Navigate to={`/t/${currentTenant.slug}/pos`} replace />;
      } else if (currentRole === 'customer' && currentTenant) {
        return <Navigate to={`/t/${currentTenant.slug}/customer`} replace />;
      } else {
        return <Navigate to="/login" replace />;
      }
    }
  }

  // Customer route protection - check for exact /customer route, not /customers
  if (location.pathname.endsWith('/customer') && currentRole === 'platform_admin') {
    return <Navigate to="/platform/dashboard" replace />;
  }

  if (location.pathname.endsWith('/customer') && currentRole === 'tenant_admin' && currentTenant) {
    return <Navigate to={`/t/${currentTenant.slug}/dashboard`} replace />;
  }

  // All checks passed, render the protected component
  return <>{children}</>;
};
