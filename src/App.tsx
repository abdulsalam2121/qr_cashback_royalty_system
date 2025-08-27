import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import TenantLayout from './components/TenantLayout';
import PlatformLayout from './components/PlatformLayout';
import Login from './pages/Login';
import Signup from './pages/Signup';
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
import { X } from 'lucide-react';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[]; requireTenant?: boolean }> = ({ 
  children, 
  roles = [],
  requireTenant = false
}) => {
  const { isAuthenticated, user, tenant } = useAuthStore();
  
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  
  if (requireTenant && !tenant && user.role !== 'platform_admin') {
    return <Navigate to="/login" replace />;
  }
  
  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  const { isAuthenticated, user, tenant, initialize } = useAuthStore();
  const [isInitialized, setIsInitialized] = React.useState(false);

  useEffect(() => {
    const init = () => {
      initialize();
      setIsInitialized(true);
    };
    init();
  }, [initialize]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
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
                    '/login'
                  } replace />
                ) : <Signup />
              } 
            />
            
            {/* Public card view route (tenant-scoped) */}
            <Route path="/:tenantSlug/c/:cardUid" element={<CardView />} />
            
            {/* Platform Admin Routes */}
            <Route 
              path="/platform" 
              element={
                <ProtectedRoute>
                  <PlatformLayout />
                </ProtectedRoute>
              }
            >
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
                path="plans" 
                element={
                  <ProtectedRoute roles={['platform_admin']}>
                    <PlatformPlans />
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
                path="settings" 
                element={
                  <ProtectedRoute roles={['platform_admin']}>
                    <PlatformSettings />
                  </ProtectedRoute>
                } 
              />
            </Route>
            
            {/* Tenant Routes */}
            <Route 
              path="/t/:tenantSlug" 
              element={
                <ProtectedRoute requireTenant>
                  <TenantLayout />
                </ProtectedRoute>
              }
            >
              <Route 
                path="dashboard" 
                element={
                  <ProtectedRoute roles={['tenant_admin', 'cashier']}>
                    <Dashboard />
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
              <Route 
                path="customers" 
                element={
                  <ProtectedRoute roles={['tenant_admin']}>
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
            </Route>
            
            {/* Root redirect */}
            <Route 
              path="/" 
              element={
                <Navigate to={
                  user?.role === 'platform_admin' ? '/platform/dashboard' :
                  user?.role === 'tenant_admin' && tenant ? `/t/${tenant.slug}/dashboard` :
                  user?.role === 'cashier' && tenant ? `/t/${tenant.slug}/pos` :
                  user?.role === 'customer' && tenant ? `/t/${tenant.slug}/customer` :
                  '/login'
                } replace />
              } 
            />
            
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
    </ErrorBoundary>
  );
}

export default App;