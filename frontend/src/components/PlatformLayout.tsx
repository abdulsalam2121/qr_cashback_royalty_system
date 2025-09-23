import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  CreditCard as CreditCardIcon, 
  Settings, 
  LogOut,
  Menu,
  X,
  Crown,
  DollarSign,
  BarChart3,
  Package
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

const PlatformLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [printOrderCount, setPrintOrderCount] = React.useState(0);

  // Fetch print order count for badge
  const fetchPrintOrderCount = React.useCallback(async () => {
    try {
      const { count } = await api.platform.getCardPrintOrdersCount();
      setPrintOrderCount(count);
    } catch (error) {
      console.error('Failed to fetch print order count:', error);
    }
  }, []);

  React.useEffect(() => {
    if (user?.role === 'platform_admin') {
      fetchPrintOrderCount();
      
      // Refresh count every 30 seconds
      const interval = setInterval(fetchPrintOrderCount, 30000);
      
      // Listen for custom refresh events
      const handleRefreshCount = () => fetchPrintOrderCount();
      window.addEventListener('refreshPrintOrderCount', handleRefreshCount);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('refreshPrintOrderCount', handleRefreshCount);
      };
    }
  }, [user, fetchPrintOrderCount]);

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

  const navigation = [
    { name: 'Dashboard', href: '/platform/dashboard', icon: LayoutDashboard },
    { name: 'Tenants', href: '/platform/tenants', icon: Building2 },
    { name: 'Plans', href: '/platform/plans', icon: CreditCardIcon },
    { name: 'Card Print Orders', href: '/platform/card-print-orders', icon: Package, badge: printOrderCount },
    { name: 'Analytics', href: '/platform/analytics', icon: DollarSign },
    { name: 'Subscriptions', href: '/platform/subscriptions', icon: BarChart3 },
    { name: 'Settings', href: '/platform/settings', icon: Settings },
  ];

  if (!user || user.role !== 'platform_admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">Platform admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex relative">{/* Added relative positioning */}
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-white shadow-lg transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 lg:flex lg:flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'} w-64`}>
        <div className={`flex items-center h-16 border-b border-gray-200 flex-shrink-0 ${
          sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-6'
        }`}>
          {/* Logo and platform info */}
          <div className={`flex items-center ${sidebarCollapsed ? 'lg:flex-col lg:space-x-0 lg:space-y-1' : 'space-x-3'}`}>
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-200">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-8 h-8 object-contain"
              />
            </div>
            <span className={`text-xl font-bold text-gray-900 transition-opacity duration-300 ${
              sidebarCollapsed ? 'lg:hidden' : ''
            }`}>Platform</span>
          </div>
          
          {/* Desktop toggle button - only show when not collapsed */}
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex p-1.5 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Collapsed state toggle button - positioned below logo */}
        {sidebarCollapsed && (
          <div className="hidden lg:flex justify-center py-2 border-b border-gray-200">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        )}

        <nav className="flex-1 mt-6 px-3 overflow-y-auto">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/platform/dashboard' && location.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-purple-50 text-purple-700 border-r-2 border-purple-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  } ${sidebarCollapsed ? 'lg:justify-center' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`h-5 w-5 flex-shrink-0 ${
                    isActive ? 'text-purple-700' : 'text-gray-400 group-hover:text-gray-500'
                  } ${sidebarCollapsed ? '' : 'mr-3'}`} />
                  <span className={`truncate transition-opacity duration-300 ${
                    sidebarCollapsed ? 'lg:hidden' : ''
                  }`}>{item.name}</span>
                  {/* Badge for notifications */}
                  {item.badge && item.badge > 0 && (
                    <span className={`ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full ${
                      sidebarCollapsed ? 'lg:hidden' : ''
                    }`}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User info and logout */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Crown className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.firstName ? `${user.firstName} ${user.lastName}` : user.email || 'Platform Admin'}
              </p>
              <p className="text-xs text-purple-600 font-medium">Platform Admin</p>
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
                      (item.href !== '/platform/dashboard' && location.pathname.startsWith(item.href));
                    return isActive;
                  })?.name || 'Platform Dashboard'}
                </h1>
              </div>
              
              <div className="hidden lg:block ml-4 flex-shrink-0">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  <Crown className="w-4 h-4 mr-1 flex-shrink-0" />
                  <span className="truncate">Platform Admin</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PlatformLayout;