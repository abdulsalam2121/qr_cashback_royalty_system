import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { User, CreditCard, Receipt, TrendingUp, Gift, Calendar, DollarSign } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getTierColor } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { Customer as CustomerType, Card, Transaction } from '../types';

const Customer: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { user } = useAuthStore();
  const [customer, setCustomer] = useState<CustomerType | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchCustomerData();
    }
  }, [user, tenantSlug]);

  const fetchCustomerData = async () => {
    if (!tenantSlug) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('👤 Fetching customer data for user:', {
        id: user?.id,
        email: user?.email,
        role: user?.role,
        tenantSlug
      });
      
      // Check user role to determine which data to fetch
      if (user?.role === 'customer') {
        console.log('🔍 Fetching data for customer role...');
        // Customer users: fetch their own profile data
        const [customerData, cardsData, transactionsData] = await Promise.all([
          api.tenant.getMyProfile(tenantSlug),
          api.tenant.getMyCards(tenantSlug),
          api.tenant.getMyTransactions(tenantSlug)
        ]);

        setCustomer(customerData.customer);
        setCards(cardsData.cards);
        setTransactions(transactionsData.transactions);
      } else if (user?.role === 'tenant_admin') {
        console.log('🔍 Fetching data for tenant_admin role...');
        // Admin users: fetch all customers data (for demo, show first customer)
        const [customersData, cardsData, transactionsData] = await Promise.all([
          api.tenant.getCustomers(tenantSlug),
          api.tenant.getCards(tenantSlug),
          api.tenant.getTransactions(tenantSlug)
        ]);

        if (customersData.customers && customersData.customers.length > 0) {
          const customerData = customersData.customers[0];
          setCustomer(customerData);
          
          // Filter cards and transactions for this customer
          const customerCards = cardsData.cards?.filter(card => card.customerId === customerData.id) || [];
          const customerTransactions = transactionsData.transactions?.filter(tx => tx.customerId === customerData.id) || [];
          
          setCards(customerCards);
          setTransactions(customerTransactions);
        }
      } else {
        throw new Error(`Unsupported user role: ${user?.role}`);
      }
    } catch (error) {
      console.error('Failed to fetch customer data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch customer data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <User className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-600 font-medium mb-2">Error loading customer data</p>
        <p className="text-gray-500 text-sm">{error}</p>
        <button 
          onClick={fetchCustomerData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Customer profile not found</p>
      </div>
    );
  }

  const totalBalance = cards.reduce((sum, card) => sum + card.balanceCents, 0);
  const totalEarned = transactions
    .filter(tx => tx.type === 'EARN')
    .reduce((sum, tx) => sum + tx.cashbackCents, 0);
  const totalRedeemed = transactions
    .filter(tx => tx.type === 'REDEEM')
    .reduce((sum, tx) => sum + tx.amountCents, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xl font-bold">
              {customer.firstName[0]}{customer.lastName[0]}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {user?.role === 'customer' 
                ? `Welcome back, ${customer.firstName}!`
                : `Customer: ${customer.firstName} ${customer.lastName}`
              }
            </h1>
            <div className="flex items-center space-x-4 mt-2">
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getTierColor(customer.tier)}`}>
                {customer.tier} Member
              </span>
              <span className="text-sm text-gray-500">
                Member since {formatDate(customer.createdAt)}
              </span>
              {/* Debug info - remove in production */}
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                User Role: {user?.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Balance</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalBalance)}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Earned</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalEarned)}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Redeemed</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalRedeemed)}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Gift className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Cards</p>
              <p className="text-3xl font-bold text-gray-900">{cards.length}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <CreditCard className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Customer Profile */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <User className="w-5 h-5 mr-2" />
          Profile Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <p className="text-gray-900">{customer.firstName} {customer.lastName}</p>
          </div>
          {customer.email && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <p className="text-gray-900">{customer.email}</p>
            </div>
          )}
          {customer.phone && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <p className="text-gray-900">{customer.phone}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loyalty Tier</label>
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getTierColor(customer.tier)}`}>
              {customer.tier}
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Spend</label>
            <p className="text-gray-900">{formatCurrency(customer.totalSpend * 100)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
            <p className="text-gray-900">{formatDate(customer.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Active Cards */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <CreditCard className="w-5 h-5 mr-2" />
          Your Loyalty Cards
        </h2>
        {cards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map((card) => (
              <div key={card.id} className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm opacity-90">Card #{card.cardUid}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    card.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {card.status}
                  </span>
                </div>
                <div className="text-2xl font-bold mb-2">
                  {formatCurrency(card.balanceCents)}
                </div>
                <div className="text-sm opacity-90">
                  Store: {card.storeName || 'Not assigned'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No active cards found</p>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Receipt className="w-5 h-5 mr-2" />
          Recent Transactions
        </h2>
        {transactions.length > 0 ? (
          <div className="space-y-4">
            {transactions.slice(0, 10).map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    transaction.type === 'EARN' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {transaction.type === 'EARN' ? (
                      <TrendingUp className={`w-5 h-5 ${
                        transaction.type === 'EARN' ? 'text-green-600' : 'text-red-600'
                      }`} />
                    ) : (
                      <Gift className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.type === 'EARN' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type}
                      </span>
                      <span className="text-sm text-gray-600">{transaction.category}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(transaction.createdAt)} • {transaction.storeName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">
                    {formatCurrency(transaction.amountCents)}
                  </p>
                  {transaction.type === 'EARN' && transaction.cashbackCents > 0 && (
                    <p className="text-sm text-green-600">
                      +{formatCurrency(transaction.cashbackCents)} cashback
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Customer;