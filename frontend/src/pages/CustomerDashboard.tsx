import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

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
}

function AddFundsForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const createPaymentIntent = async (amountCents: number) => {
    try {
      const response = await fetch('/api/customer/add-funds/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('customerSession')}`,
        },
        body: JSON.stringify({
          amountCents,
          savePaymentMethod: false,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment');
      }

      return data;
    } catch (error) {
      console.error('Payment intent creation error:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements || !amount) {
      return;
    }

    const amountCents = Math.round(parseFloat(amount) * 100);
    
    if (amountCents < 100 || amountCents > 50000) {
      setError('Amount must be between $1.00 and $500.00');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Create payment intent
      const { clientSecret: newClientSecret } = await createPaymentIntent(amountCents);
      setClientSecret(newClientSecret);

      // Confirm payment
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(newClientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (paymentIntent?.status === 'succeeded') {
        // Confirm with backend
        const response = await fetch('/api/customer/add-funds/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('customerSession')}`,
          },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
          }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to confirm payment');
        }

        onSuccess();
        setAmount('');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setError(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
          Amount to Add
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            name="amount"
            id="amount"
            className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            max="500"
            step="0.01"
            required
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">USD</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">Minimum: $1.00, Maximum: $500.00</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Payment Method
        </label>
        <div className="border border-gray-300 rounded-md p-3">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
              },
            }}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing || !amount}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          `Add $${amount || '0.00'} to Card`
        )}
      </button>
    </form>
  );
}

export default function CustomerDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'add-funds'>('overview');
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

  const handleAddFundsSuccess = () => {
    loadDashboardData(); // Refresh data
    setActiveTab('overview'); // Switch back to overview
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
        return 'text-green-600 bg-green-100';
      case 'REDEEM':
        return 'text-red-600 bg-red-100';
      case 'ADJUST':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboardData || !customerData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error || 'Failed to load dashboard'}</p>
            <button
              onClick={() => loadDashboardData()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome, {dashboardData.customer.firstName}!
              </h1>
              <p className="text-sm text-gray-600">
                {customerData.tenant.name} • {customerData.card.cardUid}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {[
              { id: 'overview', name: 'Overview' },
              { id: 'transactions', name: 'Transactions' },
              { id: 'add-funds', name: 'Add Funds' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Current Balance</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {formatCurrency(dashboardData.stats.currentBalanceCents)}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Earned</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {formatCurrency(dashboardData.stats.totalEarnedCents)}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 13.586V3a1 1 0 012 0v10.586l3.293-3.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Added</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {formatCurrency(dashboardData.stats.totalAddedCents)}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Redeemed</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {formatCurrency(dashboardData.stats.totalRedeemedCents)}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Recent Transactions
                </h3>
                <div className="flow-root">
                  <ul className="-my-5 divide-y divide-gray-200">
                    {dashboardData.transactions.slice(0, 5).map((transaction) => (
                      <li key={transaction.id} className="py-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionTypeColor(
                                transaction.type
                              )}`}
                            >
                              {getTransactionTypeLabel(transaction.type)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {transaction.type === 'EARN' && `+${formatCurrency(transaction.cashbackCents)} cashback`}
                              {transaction.type === 'REDEEM' && `${formatCurrency(transaction.amountCents)} redeemed`}
                              {transaction.type === 'ADJUST' && `+${formatCurrency(transaction.amountCents)} added`}
                            </p>
                            <p className="text-sm text-gray-500">
                              {transaction.store?.name || 'Store'} • {formatDate(transaction.createdAt)}
                            </p>
                          </div>
                          <div className="text-sm text-gray-900">
                            {formatCurrency(transaction.afterBalanceCents)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Transaction History
              </h3>
              <div className="flow-root">
                <ul className="-my-5 divide-y divide-gray-200">
                  {dashboardData.transactions.map((transaction) => (
                    <li key={transaction.id} className="py-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionTypeColor(
                              transaction.type
                            )}`}
                          >
                            {getTransactionTypeLabel(transaction.type)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {transaction.type === 'EARN' && `+${formatCurrency(transaction.cashbackCents)} cashback`}
                            {transaction.type === 'REDEEM' && `${formatCurrency(transaction.amountCents)} redeemed`}
                            {transaction.type === 'ADJUST' && `+${formatCurrency(transaction.amountCents)} added`}
                          </p>
                          <p className="text-sm text-gray-500">
                            {transaction.store?.name || 'Store'} • {formatDate(transaction.createdAt)}
                          </p>
                          {transaction.note && (
                            <p className="text-xs text-gray-400 mt-1">{transaction.note}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-900">
                            Balance: {formatCurrency(transaction.afterBalanceCents)}
                          </div>
                          <div className="text-xs text-gray-500">
                            From: {formatCurrency(transaction.beforeBalanceCents)}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'add-funds' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Add Funds to Your Card
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Use your credit or debit card to add funds to your loyalty card balance.
              </p>
              <Elements stripe={stripePromise}>
                <AddFundsForm onSuccess={handleAddFundsSuccess} />
              </Elements>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}