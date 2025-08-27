import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Users, CreditCard, Receipt, DollarSign, TrendingUp, Gift } from 'lucide-react';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { DashboardStats, Transaction } from '../types';

const Dashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!tenantSlug) return;
      
      try {
        const [statsData, transactionsData] = await Promise.all([
          api.tenant.getDashboardStats(tenantSlug),
          api.tenant.getTransactions(tenantSlug)
        ]);
        
        setStats(statsData);
        setRecentTransactions(transactionsData.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tenantSlug]);

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
        <p className="text-gray-500">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Customers"
          value={stats.totalCustomers}
          icon={Users}
          color="blue"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Active Cards"
          value={stats.totalCards}
          icon={CreditCard}
          color="green"
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Total Transactions"
          value={stats.totalTransactions}
          icon={Receipt}
          color="purple"
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="Cashback Issued"
          value={formatCurrency(stats.totalCashbackIssued)}
          icon={DollarSign}
          color="orange"
          trend={{ value: 22, isPositive: true }}
        />
        <StatCard
          title="Cashback Redeemed"
          value={formatCurrency(stats.totalCashbackRedeemed)}
          icon={TrendingUp}
          color="red"
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          title="Active Offers"
          value={stats.activeOffers}
          icon={Gift}
          color="purple"
        />
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cashback
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {transaction.customerName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {transaction.cardUid}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      transaction.type === 'EARN' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(transaction.amountCents)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.type === 'EARN' ? formatCurrency(transaction.cashbackCents) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;