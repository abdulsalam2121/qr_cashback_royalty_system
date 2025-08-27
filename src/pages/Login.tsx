import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';
import { User, Tenant } from '../types';

// Mock data for demo accounts
const mockAccounts = {
  'platform@example.com': {
    user: {
      id: 'platform-admin-1',
      email: 'platform@example.com',
      role: 'platform_admin' as const,
      firstName: 'Platform',
      lastName: 'Admin'
    }
  },
  'owner@alpha.com': {
    user: {
      id: 'tenant-admin-1',
      email: 'owner@alpha.com',
      role: 'tenant_admin' as const,
      firstName: 'Alpha',
      lastName: 'Owner',
      tenantId: 'alpha-tenant-1',
      tenantSlug: 'alpha-shop',
      tenantName: 'Alpha Phone Shop'
    },
    tenant: {
      id: 'alpha-tenant-1',
      slug: 'alpha-shop',
      name: 'Alpha Phone Shop',
      createdAt: '2024-01-01T00:00:00.000Z',
      subscriptionStatus: 'ACTIVE' as const,
      planId: 'pro-plan',
      _count: {
        stores: 2,
        users: 3,
        customers: 25,
        cards: 150
      }
    }
  },
  'cashier@alpha.com': {
    user: {
      id: 'cashier-1',
      email: 'cashier@alpha.com',
      role: 'cashier' as const,
      firstName: 'Alpha',
      lastName: 'Cashier',
      tenantId: 'alpha-tenant-1',
      tenantSlug: 'alpha-shop',
      tenantName: 'Alpha Phone Shop',
      storeId: 'store-1',
      storeName: 'Main Store'
    },
    tenant: {
      id: 'alpha-tenant-1',
      slug: 'alpha-shop',
      name: 'Alpha Phone Shop',
      createdAt: '2024-01-01T00:00:00.000Z',
      subscriptionStatus: 'ACTIVE' as const,
      planId: 'pro-plan'
    }
  },
  'owner@beta.com': {
    user: {
      id: 'tenant-admin-2',
      email: 'owner@beta.com',
      role: 'tenant_admin' as const,
      firstName: 'Beta',
      lastName: 'Owner',
      tenantId: 'beta-tenant-1',
      tenantSlug: 'beta-repairs',
      tenantName: 'Beta Mobile Repairs'
    },
    tenant: {
      id: 'beta-tenant-1',
      slug: 'beta-repairs',
      name: 'Beta Mobile Repairs',
      createdAt: '2024-02-01T00:00:00.000Z',
      subscriptionStatus: 'TRIALING' as const,
      trialEndsAt: '2024-03-01T00:00:00.000Z',
      _count: {
        stores: 1,
        users: 1,
        customers: 8,
        cards: 25
      }
    }
  }
};

// Mock login function
const mockLogin = async (email: string, password: string): Promise<{ user: User; tenant?: Tenant }> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const account = mockAccounts[email as keyof typeof mockAccounts];
  
  if (!account) {
    throw new Error('Invalid email or password');
  }
  
  // Simple password validation for demo
  const validPasswords = {
    'platform@example.com': 'AdminPass123!',
    'owner@alpha.com': 'TenantAdmin123!',
    'cashier@alpha.com': 'Cashier123!',
    'owner@beta.com': 'TenantAdmin123!'
  };
  
  if (password !== validPasswords[email as keyof typeof validPasswords]) {
    throw new Error('Invalid email or password');
  }
  
  return account;
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Try mock login first for demo accounts
      let response;
      try {
        response = await mockLogin(formData.email, formData.password);
      } catch (mockError) {
        // If mock login fails, try real API as fallback
        try {
          response = await api.login(formData.email, formData.password);
        } catch (apiError) {
          throw mockError; // Show the mock error message
        }
      }
      
      const { user, tenant } = response;
      if (!user) {
        throw new Error('No user data received from server');
      }
      
      login(user, tenant);
      
      // Redirect based on role
      if (user.role === 'platform_admin') {
        navigate('/platform/dashboard');
      } else if (user.role === 'tenant_admin' && tenant) {
        navigate(`/t/${tenant.slug}/dashboard`);
      } else if (user.role === 'cashier' && tenant) {
        navigate(`/t/${tenant.slug}/pos`);
      } else if (user.role === 'customer' && tenant) {
        navigate(`/t/${tenant.slug}/customer`);
      } else {
        navigate('/login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Welcome to LoyaltyPro
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account to continue
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-3 pr-10 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <p className="mb-2 font-medium">Demo Accounts:</p>
              <div className="space-y-2">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <div>
                      <p><strong>Platform Admin:</strong> platform@example.com / AdminPass123!</p>
                      <p className="text-gray-500">→ Go to: localhost:5173/platform/login</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ email: 'platform@example.com', password: 'AdminPass123!' })}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Fill
                    </button>
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <p><strong>Alpha Phone Shop (Tenant 1):</strong></p>
                        <p className="ml-2">Admin: owner@alpha.com / TenantAdmin123!</p>
                        <p className="text-gray-500 ml-2">→ Go to: localhost:5173/t/alpha-shop/login</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ email: 'owner@alpha.com', password: 'TenantAdmin123!' })}
                        className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        Fill
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <div>
                        <p className="ml-2">Cashier: cashier@alpha.com / Cashier123!</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ email: 'cashier@alpha.com', password: 'Cashier123!' })}
                        className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                      >
                        Fill
                      </button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <p><strong>Beta Mobile Repairs (Tenant 2 - trial):</strong></p>
                        <p className="ml-2">Admin: owner@beta.com / TenantAdmin123!</p>
                        <p className="text-gray-500 ml-2">→ Go to: localhost:5173/t/beta-repairs/login</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ email: 'owner@beta.com', password: 'TenantAdmin123!' })}
                        className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                      >
                        Fill
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;