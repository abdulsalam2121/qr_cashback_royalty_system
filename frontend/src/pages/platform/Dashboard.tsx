import React, { useState, useEffect } from 'react';
import { Users, Building, DollarSign, CreditCard, TrendingUp, Activity, Plus, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../../components/StatCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { api } from '../../utils/api';
import { PlatformStats } from '../../types';

interface RecentActivity {
  id: string;
  type: 'tenant_created' | 'user_signup' | 'transaction' | 'card_activation';
  message: string;
  timestamp: string;
  tenantName?: string;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await api.platform.getStats();
        setStats(data);
        
        // Generate recent activity from actual data
        const activities: RecentActivity[] = [
          {
            id: '1',
            type: 'tenant_created',
            message: `${data.totalTenants} total tenants in system`,
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          },
          {
            id: '2',
            type: 'user_signup',
            message: `${data.activeTenants} active tenants`,
            timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          },
          {
            id: '3',
            type: 'transaction',
            message: `${data.totalStores} stores across all tenants`,
            timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
          },
          {
            id: '4',
            type: 'card_activation',
            message: `${data.totalCustomers} total customers registered`,
            timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          },
        ];
        setRecentActivity(activities);
      } catch (error) {
        console.error('Failed to load platform stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'tenant_created':
        return <Building className="h-4 w-4 text-blue-600" />;
      case 'user_signup':
        return <Users className="h-4 w-4 text-green-600" />;
      case 'transaction':
        return <DollarSign className="h-4 w-4 text-yellow-600" />;
      case 'card_activation':
        return <CreditCard className="h-4 w-4 text-purple-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load platform statistics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Platform Dashboard</h1>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Tenants"
          value={stats.totalTenants.toString()}
          icon={Building}
          trend={{ value: 8.2, isPositive: true }}
        />
        <StatCard
          title="Active Tenants"
          value={stats.activeTenants.toString()}
          icon={Activity}
          trend={{ value: 4.1, isPositive: true }}
        />
        <StatCard
          title="Total Customers"
          value={stats.totalCustomers.toString()}
          icon={Users}
          trend={{ value: 12.5, isPositive: true }}
        />
        <StatCard
          title="Total Revenue"
          value={`$${stats.totalRevenue ? (stats.totalRevenue / 100).toFixed(2) : '0.00'}`}
          icon={DollarSign}
          trend={{ value: 23.1, isPositive: true }}
        />
        <StatCard
          title="Monthly Revenue"
          value={`$${stats.monthlyRevenue ? (stats.monthlyRevenue / 100).toFixed(2) : '0.00'}`}
          icon={TrendingUp}
          trend={{ value: 5.8, isPositive: true }}
        />
        <StatCard
          title="Total Stores"
          value={stats.totalStores.toString()}
          icon={CreditCard}
          trend={{ value: 15.3, isPositive: true }}
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getActivityIcon(activity.type)}
                <div>
                  <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                  {activity.tenantName && (
                    <p className="text-xs text-gray-500">Tenant: {activity.tenantName}</p>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {formatDate(activity.timestamp)}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 bg-gray-50 text-center">
          <button 
            onClick={() => navigate('/platform/analytics')}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View All Activity
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => navigate('/platform/tenants?action=create')}
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Tenant
          </button>
          <button 
            onClick={() => navigate('/platform/tenants')}
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Users className="h-4 w-4 mr-2" />
            View All Tenants
          </button>
          <button 
            onClick={() => navigate('/platform/analytics')}
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
