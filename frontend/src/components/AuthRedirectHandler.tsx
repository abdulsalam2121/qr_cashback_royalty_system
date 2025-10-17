// src/components/AuthRedirectHandler.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const AuthRedirectHandler: React.FC = () => {
  const navigate = useNavigate();
  const { user, role, tenant, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!isAuthenticated || !user) {
      navigate('/login', { replace: true });
      return;
    }

      role,
      userId: user.id,
      tenantSlug: user.tenantSlug || tenant?.slug,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    });

    // Redirect based on role and tenant
    if (role === 'platform_admin') {
      navigate('/platform/dashboard', { replace: true });
    } else if (role === 'tenant_admin' && (user.tenantSlug || tenant?.slug)) {
      const tenantSlug = user.tenantSlug || tenant?.slug;
      navigate(`/t/${tenantSlug}/dashboard`, { replace: true });
    } else if (role === 'cashier' && (user.tenantSlug || tenant?.slug)) {
      const tenantSlug = user.tenantSlug || tenant?.slug;
      navigate(`/t/${tenantSlug}/pos`, { replace: true });
    } else if (role === 'customer' && (user.tenantSlug || tenant?.slug)) {
      const tenantSlug = user.tenantSlug || tenant?.slug;
      navigate(`/t/${tenantSlug}/customer`, { replace: true });
    } else {
      // For users without proper tenant/role setup, try to refresh auth or redirect to login
        role, 
        userTenantSlug: user.tenantSlug, 
        tenantSlug: tenant?.slug,
        userRole: user.role 
      });
      
      // Give it a moment and try again, or redirect to login
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    }
  }, [isAuthenticated, user, role, tenant, loading, navigate]);

  // Show loading while determining redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Setting up your account...</p>
        <p className="text-sm text-gray-500 mt-2">Please wait while we configure your store</p>
      </div>
    </div>
  );
};

export default AuthRedirectHandler;
