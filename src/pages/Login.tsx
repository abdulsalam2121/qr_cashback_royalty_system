import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CreditCard, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

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
      // Use real API authentication
      const response = await api.login(formData.email, formData.password);
      
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

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have a store account?{' '}
              <Link
                to="/signup"
                className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
              >
                Start your free trial here
              </Link>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Get 40 free card activations • No credit card required
            </p>
          </div>

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