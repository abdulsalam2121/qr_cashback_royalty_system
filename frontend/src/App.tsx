import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './hooks/useToast';
import TenantLayout from './components/TenantLayout';
import PlatformLayout from './components/PlatformLayout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import ResendVerification from './pages/ResendVerification';
import DebugAuth from './pages/DebugAuth';
import Dashboard from './pages/Dashboard';
import POSTerminal from './pages/POSTerminal';
import Customers from './pages/Customers';
import Cards from './pages/Cards';
import Transactions from './pages/Transactions';
import Stores from './pages/Stores';
import Staff from './pages/Staff';
import Rules from './pages/Rules';
import Customer from './pages/Customer';
import CardView from './pages/CardView';
import PlatformDashboard from './pages/platform/Dashboard';
import PlatformTenants from './pages/platform/Tenants';
import PlatformAnalytics from './pages/platform/Analytics';
import PlatformPlans from './pages/platform/Plans';
import PlatformSettings from './pages/platform/Settings';
import TenantBilling from './pages/tenant/Billing';
import SubscriptionAnalytics from './pages/admin/SubscriptionAnalytics';
import { X } from 'lucide-react';

// App content component that has access to AuthContext
function AppContent() {
  const { isAuthenticated, user, tenant, loading } = useAuth();

  // Show loading during authentication check
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Root redirect */}
          <Route 
            path="/" 
            element={
              <Navigate to={
                isAuthenticated && user ? (
                  user.role === 'platform_admin' ? '/platform/dashboard' :
                  user.role === 'tenant_admin' && tenant ? `/t/${tenant.slug}/dashboard` :
                  user.role === 'cashier' && tenant ? `/t/${tenant.slug}/pos` :
                  user.role === 'customer' && tenant ? `/t/${tenant.slug}/customer` :
                  '/login'
                ) : '/login'
              } replace />
            } 
          />
          
          {/* Debug route */}
          <Route path="/debug" element={<DebugAuth />} />
          
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={
              isAuthenticated && user ? (
                <Navigate to={
                  user.role === 'platform_admin' ? '/platform/dashboard' :
                  user.role === 'tenant_admin' && tenant ? `/t/${tenant.slug}/dashboard` :
                  user.role === 'cashier' && tenant ? `/t/${tenant.slug}/pos` :
                  user.role === 'customer' && tenant ? `/t/${tenant.slug}/customer` :
                  '/login'
                } replace />
              ) : <Login />
            } 
          />
          
          <Route 
            path="/signup" 
            element={
              isAuthenticated && user ? (
                <Navigate to={
                  user.role === 'platform_admin' ? '/platform/dashboard' :
                  user.role === 'tenant_admin' && tenant ? `/t/${tenant.slug}/dashboard` :
                  user.role === 'cashier' && tenant ? `/t/${tenant.slug}/pos` :
                  user.role === 'customer' && tenant ? `/t/${tenant.slug}/customer` :
                  '/login'
                } replace />
              ) : <Signup />
            } 
          />

          {/* Password Reset Routes */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Email Verification Routes */}
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/resend-verification" element={<ResendVerification />} />

          {/* Platform Admin Routes */}
          <Route path="/platform" element={<PlatformLayout />}>
            <Route 
              path="dashboard" 
              element={
                <ProtectedRoute roles={['platform_admin']}>
                  <PlatformDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="tenants" 
              element={
                <ProtectedRoute roles={['platform_admin']}>
                  <PlatformTenants />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="analytics" 
              element={
                <ProtectedRoute roles={['platform_admin']}>
                  <PlatformAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="plans" 
              element={
                <ProtectedRoute roles={['platform_admin']}>
                  <PlatformPlans />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="settings" 
              element={
                <ProtectedRoute roles={['platform_admin']}>
                  <PlatformSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="subscription-analytics" 
              element={
                <ProtectedRoute roles={['platform_admin']}>
                  <SubscriptionAnalytics />
                </ProtectedRoute>
              } 
            />
          </Route>

          {/* Tenant-specific routes */}
          <Route path="/t/:tenantSlug" element={<TenantLayout />}>
            <Route 
              path="dashboard" 
              element={
                <ProtectedRoute roles={['tenant_admin', 'cashier']}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="customers" 
              element={
                <ProtectedRoute roles={['tenant_admin', 'cashier']}>
                  <Customers />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="cards" 
              element={
                <ProtectedRoute roles={['tenant_admin', 'cashier']}>
                  <Cards />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="cards/:cardId" 
              element={
                <ProtectedRoute roles={['tenant_admin', 'cashier']}>
                  <CardView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="transactions" 
              element={
                <ProtectedRoute roles={['tenant_admin', 'cashier']}>
                  <Transactions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="stores" 
              element={
                <ProtectedRoute roles={['tenant_admin']}>
                  <Stores />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="staff" 
              element={
                <ProtectedRoute roles={['tenant_admin']}>
                  <Staff />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="rules" 
              element={
                <ProtectedRoute roles={['tenant_admin']}>
                  <Rules />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="pos" 
              element={
                <ProtectedRoute roles={['tenant_admin', 'cashier']}>
                  <POSTerminal />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="customer" 
              element={
                <ProtectedRoute roles={['customer']}>
                  <Customer />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="billing" 
              element={
                <ProtectedRoute roles={['tenant_admin']}>
                  <TenantBilling />
                </ProtectedRoute>
              } 
            />
          </Route>

          {/* Fallback Routes */}
          <Route path="/unauthorized" element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <X className="h-6 w-6 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-600 mb-6">You don't have permission to access this page.</p>
                <button
                  onClick={() => window.history.back()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
