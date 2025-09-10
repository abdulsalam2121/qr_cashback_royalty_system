import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Users, TrendingUp, Calendar, CreditCard, 
  BarChart3, RefreshCw
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/format';

interface Analytics {
  totalRevenue: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  revenueByDay: Array<{ date: string; revenue: number; payments: number }>;
  topPlans: Array<{
    planId: string;
    _sum: { amount: number };
    _count: { id: number };
    plan: { id: string; name: string; priceMonthly: number };
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    status: string;
    description: string;
    createdAt: string;
    tenant: { id: string; name: string; slug: string };
    plan: { id: string; name: string; priceMonthly: number };
  }>;
  subscriptionEvents: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    tenant: { id: string; name: string; slug: string };
    plan: { id: string; name: string; priceMonthly: number };
  }>;
}

const SubscriptionAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'events'>('overview');

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`http://localhost:3002/api/admin/analytics/subscriptions?timeframe=${timeframe}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, response.statusText, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Analytics data received:', data);
      setAnalytics(data.analytics);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Failed to load analytics data</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'payments', name: 'Payments', icon: CreditCard },
    { id: 'events', name: 'Events', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Subscription Analytics</h1>
              <p className="text-gray-600 mt-2">Monitor subscription revenue, payments, and customer activity</p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
              <button
                onClick={fetchAnalytics}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(analytics.totalRevenue / 100)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">New Subscriptions</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalSubscriptions}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.activeSubscriptions}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Revenue/Day</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(
                    analytics.revenueByDay.length > 0
                      ? analytics.revenueByDay.reduce((sum, day) => sum + Number(day.revenue), 0) / analytics.revenueByDay.length / 100
                      : 0
                  )}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Top Plans */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Plans</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {analytics.topPlans.slice(0, 3).map((planStat, index) => (
                      <div key={planStat.planId} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{planStat.plan?.name}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            #{index + 1}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 mb-1">
                          {formatCurrency((planStat._sum.amount || 0) / 100)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {planStat._count.id} subscription{planStat._count.id !== 1 ? 's' : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Subscription Events */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Subscription Activity</h3>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      {analytics.subscriptionEvents.map((event) => (
                        <div key={event.id} className="p-4 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                  event.eventType === 'created' ? 'bg-green-100 text-green-800' :
                                  event.eventType === 'updated' ? 'bg-blue-100 text-blue-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {event.eventType}
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                  {event.tenant.name || event.tenant.slug}
                                </span>
                                <span className="text-sm text-gray-600">→ {event.plan.name}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(event.createdAt)}
                              </p>
                            </div>
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(event.plan.priceMonthly / 100)}/month
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Payments</h3>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tenant
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Plan
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {analytics.recentPayments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {payment.tenant.name || payment.tenant.slug}
                                </div>
                                <div className="text-sm text-gray-500">{payment.tenant.slug}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{payment.plan.name}</div>
                              <div className="text-sm text-gray-500">
                                {formatCurrency(payment.plan.priceMonthly / 100)}/month
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(payment.amount / 100)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                payment.status === 'paid' ? 'bg-green-100 text-green-800' :
                                payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {payment.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(payment.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'events' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Events</h3>
                <div className="space-y-4">
                  {analytics.subscriptionEvents.map((event) => (
                    <div key={event.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                            event.eventType === 'created' ? 'bg-green-100 text-green-800' :
                            event.eventType === 'updated' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {event.tenant.name || event.tenant.slug}
                            </p>
                            <p className="text-sm text-gray-600">
                              {event.eventType === 'created' ? 'Subscribed to' : 'Changed to'} {event.plan.name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(event.plan.priceMonthly / 100)}/month
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(event.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionAnalytics;
