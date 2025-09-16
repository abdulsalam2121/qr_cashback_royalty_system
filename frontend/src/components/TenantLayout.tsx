import React from 'react';
import { Outlet, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Receipt, 
  Settings, 
  Store, 
  UserCheck, 
  LogOut,
  Menu,
  X,
  Smartphone,
  AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAuth } from '../context/AuthContext';
import SubscriptionBanner from './SubscriptionBanner';

const TenantLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { user, tenant } = useAuthStore();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback to just navigating to login
      navigate('/login');
    }
  };

  const handleSubscribe = () => {
    navigate(`/t/${tenantSlug}/billing`);
  };

  const handleManageBilling = () => {
    navigate(`/t/${tenantSlug}/billing`);
  };

  const navigation = React.useMemo(() => {
    const baseNav = [
      { name: 'Dashboard', href: `/t/${tenantSlug}/dashboard`, icon: LayoutDashboard, roles: ['tenant_admin', 'cashier'] },
      { name: 'POS Terminal', href: `/t/${tenantSlug}/pos`, icon: Smartphone, roles: ['tenant_admin', 'cashier'] },
      { name: 'Customers', href: `/t/${tenantSlug}/customers`, icon: Users, roles: ['tenant_admin'] },
      { name: 'Cards', href: `/t/${tenantSlug}/cards`, icon: CreditCard, roles: ['tenant_admin', 'cashier'] },
      { name: 'Transactions', href: `/t/${tenantSlug}/transactions`, icon: Receipt, roles: ['tenant_admin', 'cashier'] },
      { name: 'Stores', href: `/t/${tenantSlug}/stores`, icon: Store, roles: ['tenant_admin'] },
      { name: 'Staff', href: `/t/${tenantSlug}/staff`, icon: UserCheck, roles: ['tenant_admin'] },
      { name: 'Rules & Settings', href: `/t/${tenantSlug}/rules`, icon: Settings, roles: ['tenant_admin'] },
    ];

    return baseNav.filter(item => item.roles.includes(user?.role || ''));
  }, [user?.role, tenantSlug]);

  if (!user || !tenant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">Tenant access required</p>
        </div>
      </div>
    );
  }

  const isSubscriptionActive = tenant.subscriptionStatus === 'ACTIVE' || tenant.subscriptionStatus === 'TRIALING';
  const isGracePeriod = tenant.subscriptionStatus === 'PAST_DUE' && tenant.graceEndsAt && new Date(tenant.graceEndsAt) > new Date();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 lg:flex lg:flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-lg font-bold text-gray-900 truncate block">{tenant.name}</span>
              <span className="text-xs text-gray-500">LoyaltyPro</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 mt-6 px-3 overflow-y-auto">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== `/t/${tenantSlug}/dashboard` && location.pathname.startsWith(item.href));
              
              const isDisabled = !isSubscriptionActive && !isGracePeriod && 
                ['pos', 'cards', 'transactions'].some(path => item.href.includes(path));
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : isDisabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={(e) => {
                    if (isDisabled) {
                      e.preventDefault();
                      return;
                    }
                    setSidebarOpen(false);
                  }}
                >
                  <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${
                    isActive ? 'text-blue-700' : 
                    isDisabled ? 'text-gray-400' : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  <span className="truncate">{item.name}</span>
                  {isDisabled && (
                    <AlertTriangle className="ml-auto w-4 h-4 text-orange-500" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User info and logout */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-gray-700">
                {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.firstName ? `${user.firstName} ${user.lastName}` : user.email || 'User'}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <LogOut className="mr-3 h-4 w-4 flex-shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="flex-1 lg:flex lg:items-center lg:justify-between min-w-0">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-gray-900 truncate">
                  {navigation.find(item => {
                    const isActive = location.pathname === item.href || 
                      (item.href !== `/t/${tenantSlug}/dashboard` && location.pathname.startsWith(item.href));
                    return isActive;
                  })?.name || 'Dashboard'}
                </h1>
              </div>
              
              <div className="hidden lg:flex items-center space-x-3 ml-4 flex-shrink-0">
                {/* Subscription Status Badge */}
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  tenant.subscriptionStatus === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                  tenant.subscriptionStatus === 'TRIALING' ? 'bg-blue-100 text-blue-800' :
                  tenant.subscriptionStatus === 'PAST_DUE' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {tenant.subscriptionStatus === 'TRIALING' ? 'Trial Account' :
                   tenant.subscriptionStatus === 'ACTIVE' ? 'Active' :
                   tenant.subscriptionStatus === 'PAST_DUE' ? 'Past Due' :
                   'Inactive'}
                </span>
                
                {user.storeName && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    <Store className="w-4 h-4 mr-1 flex-shrink-0" />
                    <span className="truncate">{user.storeName}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Subscription Banner */}
              {tenant && (
                <SubscriptionBanner
                  tenant={tenant}
                  onSubscribe={handleSubscribe}
                  onManageBilling={handleManageBilling}
                />
              )}
              
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TenantLayout;