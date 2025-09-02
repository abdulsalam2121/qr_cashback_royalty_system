import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, Building2, BarChart3, PieChart } from 'lucide-react';
import StatCard from '../../components/StatCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { api } from '../../utils/api';
import { PlatformStats } from '../../types';

interface AnalyticsData extends PlatformStats {
  monthlyGrowth: number;
  recentActivity: Array<{
    id: string;
    tenantName: string;
    action: string;
    timestamp: string;
  }>;
}

const Analytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const stats = await api.platform.getStats();
        
        // Combine real stats with mock data for features not yet implemented
        setAnalytics({
          ...stats,
          monthlyGrowth: 15.2, // This could be calculated from real data
          recentActivity: [
            {
              id: '1',
              tenantName: 'Recent tenant activity',
              action: 'System activity logged',
              timestamp: new Date().toISOString()
            }
          ]
        });
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Tenants"
          value={analytics.totalTenants.toString()}
          icon={Building2}
          trend={{ value: Math.abs(analytics.monthlyGrowth), isPositive: analytics.monthlyGrowth > 0 }}
        />
        <StatCard
          title="Total Customers"
          value={analytics.totalCustomers.toString()}
          icon={Users}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Total Revenue"
          value={`$${(analytics.totalRevenue / 100).toFixed(2)}`}
          icon={DollarSign}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Active Tenants"
          value={analytics.activeTenants.toString()}
          icon={TrendingUp}
          trend={{ value: 15, isPositive: true }}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center mb-4">
            <BarChart3 className="h-5 w-5 text-blue-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Revenue Trends</h3>
          </div>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Revenue chart will be displayed here</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center mb-4">
            <PieChart className="h-5 w-5 text-green-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Tenant Distribution</h3>
          </div>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <PieChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Distribution chart will be displayed here</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {analytics.recentActivity.map((activity) => (
            <div key={activity.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Building2 className="h-6 w-6 text-blue-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">{activity.tenantName}</p>
                  <p className="text-sm text-gray-500">{activity.action}</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {new Date(activity.timestamp).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
