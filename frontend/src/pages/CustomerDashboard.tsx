import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface CustomerData {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    tier: string;
    totalSpend: number;
  };
  card: {
    id: string;
    cardUid: string;
    balanceCents: number;
    status: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}

interface DashboardData {
  customer: CustomerData['customer'];
  cards: Array<{
    id: string;
    cardUid: string;
    balanceCents: number;
    status: string;
    store?: {
      id: string;
      name: string;
      address?: string;
    };
    activatedAt?: string;
  }>;
  transactions: Array<{
    id: string;
    type: 'EARN' | 'REDEEM' | 'ADJUST';
    category: string;
    amountCents: number;
    cashbackCents: number;
    beforeBalanceCents: number;
    afterBalanceCents: number;
    note?: string;
    store?: {
      id: string;
      name: string;
    };
    createdAt: string;
  }>;
  stats: {
    totalEarnedCents: number;
    totalRedeemedCents: number;
    totalAddedCents: number;
    currentBalanceCents: number;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function CustomerDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const sessionToken = localStorage.getItem('customerSession');
    const storedCustomerData = localStorage.getItem('customerData');
    
    if (!sessionToken || !storedCustomerData) {
      navigate('/customer/login');
      return;
    }

    try {
      setCustomerData(JSON.parse(storedCustomerData));
      loadDashboardData();
    } catch (error) {
      console.error('Error parsing customer data:', error);
      navigate('/customer/login');
    }
  }, [navigate]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/customer/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('customerSession')}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Session expired
          localStorage.removeItem('customerSession');
          localStorage.removeItem('customerData');
          navigate('/customer/login');
          return;
        }
        throw new Error('Failed to load dashboard data');
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Dashboard load error:', error);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/customer-auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('customerSession')}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('customerSession');
      localStorage.removeItem('customerData');
      navigate('/customer/login');
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'EARN':
        return 'bg-green-100 text-green-800';
      case 'REDEEM':
        return 'bg-blue-100 text-blue-800';
      case 'ADJUST':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'EARN':
        return 'Earned';
      case 'REDEEM':
        return 'Redeemed';
      case 'ADJUST':
        return 'Added';
      default:
        return type;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'EARN':
        return (
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
          </div>
        );
      case 'REDEEM':
        return (
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
            </svg>
          </div>
        );
      case 'ADJUST':
        return (
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
          <p className="text-gray-400 text-sm mt-1">Please wait while we fetch your latest data</p>
        </div>
      </div>
    );
  }

  if (error || !dashboardData || !customerData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Oops! Something went wrong</h3>
            <p className="text-red-600 mb-6">{error || 'Failed to load dashboard'}</p>
            <button
              onClick={() => loadDashboardData()}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="h-10 w-auto transition-transform hover:scale-105"
              />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Welcome back, {dashboardData.customer.firstName}! 👋
                </h1>
                <p className="text-sm text-gray-500 flex items-center space-x-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {customerData.tenant.name}
                  </span>
                  <span>•</span>
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                    {customerData.card.cardUid}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1">
          <nav className="flex space-x-1" aria-label="Tabs">
            {[
              { id: 'overview', name: 'Overview', icon: '📊' },
              { id: 'transactions', name: 'Transaction History', icon: '📜' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg transform scale-[1.02]'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Current Balance</p>
                    <p className="text-3xl font-bold mt-2">
                      {formatCurrency(dashboardData.stats.currentBalanceCents)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 flex items-center">
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div className="bg-white h-2 rounded-full" style={{width: '75%'}}></div>
                  </div>
                  <span className="ml-2 text-xs">75%</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Total Earned</p>
                    <p className="text-3xl font-bold mt-2">
                      {formatCurrency(dashboardData.stats.totalEarnedCents)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <p className="text-blue-100 text-sm mt-4">
                  🎉 Keep earning rewards with every purchase!
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Total Redeemed</p>
                    <p className="text-3xl font-bold mt-2">
                      {formatCurrency(dashboardData.stats.totalRedeemedCents)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 13.586V3a1 1 0 012 0v10.586l3.293-3.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <p className="text-purple-100 text-sm mt-4">
                  💰 Great savings from your rewards!
                </p>
              </div>
            </div>

            {/* Recent Transactions Preview */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                    <span className="mr-2">🔄</span>
                    Recent Activity
                  </h3>
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center transition-colors"
                  >
                    View All
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6">
                {dashboardData.transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No transactions yet</h4>
                    <p className="text-gray-500">Start making purchases to see your transaction history here!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.transactions.slice(0, 5).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center space-x-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all duration-200 hover:shadow-md"
                      >
                        {getTransactionIcon(transaction.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionTypeColor(
                                transaction.type
                              )}`}
                            >
                              {getTransactionTypeLabel(transaction.type)}
                            </span>
                            {transaction.store?.name && (
                              <span className="text-xs text-gray-500">at {transaction.store.name}</span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            {transaction.type === 'EARN' && `+${formatCurrency(transaction.cashbackCents)} cashback earned`}
                            {transaction.type === 'REDEEM' && `${formatCurrency(transaction.amountCents)} redeemed`}
                            {transaction.type === 'ADJUST' && `+${formatCurrency(transaction.amountCents)} balance adjustment`}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(transaction.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(transaction.afterBalanceCents)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Balance
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Customer Tier Info */}
            <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 rounded-2xl shadow-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2 flex items-center">
                    <span className="mr-2">👑</span>
                    Your Tier: {dashboardData.customer.tier}
                  </h3>
                  <p className="text-yellow-100">
                    Total Lifetime Spend: {formatCurrency(dashboardData.customer.totalSpend)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-2xl">⭐</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                <span className="mr-2">📜</span>
                Complete Transaction History
              </h3>
              <p className="text-gray-600 text-sm mt-1">
                All your earning and redemption activities
              </p>
            </div>
            <div className="p-6">
              {dashboardData.transactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  </div>
                  <h4 className="text-xl font-medium text-gray-900 mb-2">No transactions yet</h4>
                  <p className="text-gray-500 max-w-sm mx-auto">
                    Start making purchases with your loyalty card to see your transaction history here. 
                    Every purchase earns you valuable rewards!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.transactions.map((transaction, index) => (
                    <div
                      key={transaction.id}
                      className="flex items-center space-x-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all duration-200 hover:shadow-md"
                      style={{
                        animationDelay: `${index * 0.1}s`,
                        animation: 'fadeInUp 0.5s ease-out forwards'
                      }}
                    >
                      {getTransactionIcon(transaction.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionTypeColor(
                              transaction.type
                            )}`}
                          >
                            {getTransactionTypeLabel(transaction.type)}
                          </span>
                          {transaction.store?.name && (
                            <span className="text-xs text-gray-500">
                              📍 {transaction.store.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {transaction.type === 'EARN' && `+${formatCurrency(transaction.cashbackCents)} cashback earned`}
                          {transaction.type === 'REDEEM' && `${formatCurrency(transaction.amountCents)} redeemed`}
                          {transaction.type === 'ADJUST' && `+${formatCurrency(transaction.amountCents)} balance adjustment`}
                        </p>
                        {transaction.note && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            💬 {transaction.note}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          🕒 {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {formatCurrency(transaction.afterBalanceCents)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Balance after transaction
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Previous: {formatCurrency(transaction.beforeBalanceCents)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add custom CSS for animations */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}