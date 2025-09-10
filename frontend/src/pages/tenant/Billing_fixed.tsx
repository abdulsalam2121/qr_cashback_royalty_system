import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Check, Crown, Zap, Building, ExternalLink, CheckCircle, XCircle,
  Download, History, Settings, BarChart3, Calendar, DollarSign, Shield,
  Plus, Edit, Trash2, AlertCircle, Users, Store, Archive
} from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import TrialStatusBanner from '../../components/TrialStatusBanner';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { Plan } from '../../types';

interface TrialStatus {
  activationsUsed: number;
  activationsRemaining: number;
  trialLimit: number;
  isTrialActive: boolean;
  subscriptionRequired: boolean;
  subscriptionStatus: string;
}

interface PaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  is_default: boolean;
}

interface Invoice {
  id: string;
  amount_paid: number;
  created: number;
  status: string;
  currency: string;
  hosted_invoice_url: string;
  invoice_pdf: string;
  period_start: number;
  period_end: number;
}

interface UsageStats {
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cardsUsed: number;
  cardsLimit: number;
  transactionsThisMonth: number;
  storesUsed: number;
  storesLimit: number;
  staffUsed: number;
  staffLimit: number;
}

// Tab Components
const OverviewTab: React.FC<{
  tenant: any;
  plans: Plan[];
  trialStatus: TrialStatus | null;
  usageStats: UsageStats | null;
  onSubscribe: (planId: string) => void;
  subscribing: string | null;
}> = ({ tenant, plans, trialStatus, usageStats, onSubscribe, subscribing }) => {
  const currentPlan = plans.find(plan => plan.id === tenant?.planId);
  const isActive = tenant?.subscriptionStatus === 'ACTIVE';
  const isTrialing = tenant?.subscriptionStatus === 'TRIALING';
  const isPastDue = tenant?.subscriptionStatus === 'PAST_DUE';

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      {tenant && (
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isActive ? 'bg-green-100' :
                isTrialing ? 'bg-blue-100' :
                isPastDue ? 'bg-orange-100' :
                'bg-gray-100'
              }`}>
                <Crown className={`w-6 h-6 ${
                  isActive ? 'text-green-600' :
                  isTrialing ? 'text-blue-600' :
                  isPastDue ? 'text-orange-600' :
                  'text-gray-600'
                }`} />
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-gray-900">
                  {currentPlan?.name || 'Free Trial'}
                </h4>
                <p className="text-sm text-gray-500">
                  Status: <span className={`font-medium ${
                    isActive ? 'text-green-600' :
                    isTrialing ? 'text-blue-600' :
                    isPastDue ? 'text-orange-600' :
                    'text-gray-600'
                  }`}>
                    {isActive ? 'Active' :
                     isTrialing ? 'Trial' :
                     isPastDue ? 'Past Due' :
                     'Inactive'}
                  </span>
                </p>
              </div>
            </div>
            
            {currentPlan && (
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(currentPlan.priceMonthly)}
                </p>
                <p className="text-sm text-gray-500">per month</p>
              </div>
            )}
          </div>
          
          {trialStatus && isTrialing && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">Trial Status</p>
                  <p className="text-sm text-blue-700">
                    {trialStatus.activationsRemaining} of {trialStatus.trialLimit} activations remaining
                  </p>
                </div>
                <div className="w-24 bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ 
                      width: `${(trialStatus.activationsUsed / trialStatus.trialLimit) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      {usageStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cards Used</p>
                <p className="text-2xl font-bold text-gray-900">
                  {usageStats.cardsUsed}
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Stores</p>
                <p className="text-2xl font-bold text-gray-900">
                  {usageStats.storesUsed}
                </p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Store className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Staff Members</p>
                <p className="text-2xl font-bold text-gray-900">
                  {usageStats.staffUsed}
                </p>
              </div>
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {usageStats.transactionsThisMonth}
                </p>
              </div>
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-orange-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!isActive && (
            <button 
              onClick={() => {
                const recommendedPlan = plans.find(p => p.name.toLowerCase().includes('professional')) || plans[1];
                if (recommendedPlan) {
                  onSubscribe(recommendedPlan.id);
                }
              }}
              disabled={subscribing !== null}
              className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Crown className="w-5 h-5" />
              <span>Upgrade to Pro</span>
            </button>
          )}
          
          <button className="p-4 border-2 border-gray-200 text-gray-700 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 flex items-center justify-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Manage Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const PlansTab: React.FC<{
  plans: Plan[];
  tenant: any;
  onSubscribe: (planId: string) => void;
  subscribing: string | null;
}> = ({ plans, tenant, onSubscribe, subscribing }) => {
  const currentPlanId = tenant?.planId;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose Your Plan</h3>
        <p className="text-gray-600">Select the plan that best fits your business needs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlanId;
          const isPopular = plan.name.toLowerCase().includes('professional');
          
          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-xl border-2 p-6 ${
                isCurrentPlan
                  ? 'border-green-500 ring-2 ring-green-200'
                  : isPopular
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              } transition-all duration-200`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Most Popular
                  </span>
                </div>
              )}
              
              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>Current</span>
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">
                    {formatCurrency(plan.priceMonthly)}
                  </span>
                  <span className="text-gray-600 ml-1">/month</span>
                </div>
                <p className="text-gray-600 mb-6">{plan.description}</p>
              </div>

              <div className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => !isCurrentPlan && onSubscribe(plan.id)}
                disabled={isCurrentPlan || subscribing === plan.id}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  isCurrentPlan
                    ? 'bg-green-100 text-green-700 cursor-not-allowed'
                    : subscribing === plan.id
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : isPopular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {isCurrentPlan ? (
                  <span className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>Current Plan</span>
                  </span>
                ) : subscribing === plan.id ? (
                  <span>Processing...</span>
                ) : (
                  'Select Plan'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PaymentMethodsTab: React.FC<{
  paymentMethods: PaymentMethod[];
  onRefresh: () => void;
}> = ({ paymentMethods, onRefresh }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
          <p className="text-gray-600">Manage your credit and debit cards</p>
        </div>
        <button 
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Card</span>
        </button>
      </div>

      {paymentMethods.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No payment methods</h3>
          <p className="text-gray-600 mb-6">Add a credit or debit card to start your subscription</p>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Add Your First Card
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {paymentMethods.map((method) => (
            <div key={method.id} className="bg-white p-6 rounded-lg border border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    **** **** **** {method.card.last4}
                  </p>
                  <p className="text-sm text-gray-600">
                    {method.card.brand.toUpperCase()} • Expires {method.card.exp_month}/{method.card.exp_year}
                  </p>
                  {method.is_default && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                      Default
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const UsageTab: React.FC<{
  usageStats: UsageStats | null;
}> = ({ usageStats }) => {
  if (!usageStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const usageItems = [
    {
      name: 'Cards',
      used: usageStats.cardsUsed,
      limit: usageStats.cardsLimit,
      icon: CreditCard,
      color: 'blue'
    },
    {
      name: 'Stores',
      used: usageStats.storesUsed,
      limit: usageStats.storesLimit,
      icon: Store,
      color: 'green'
    },
    {
      name: 'Staff Members',
      used: usageStats.staffUsed,
      limit: usageStats.staffLimit,
      icon: Users,
      color: 'purple'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Usage Statistics</h3>
        <p className="text-gray-600">
          Current billing period: {formatDate(usageStats.currentPeriodStart)} - {formatDate(usageStats.currentPeriodEnd)}
        </p>
      </div>

      <div className="space-y-4">
        {usageItems.map((item) => {
          const percentage = item.limit > 0 ? (item.used / item.limit) * 100 : 0;
          const colorClasses = {
            blue: 'bg-blue-500',
            green: 'bg-green-500',
            purple: 'bg-purple-500'
          };

          return (
            <div key={item.name} className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    item.color === 'blue' ? 'bg-blue-100' :
                    item.color === 'green' ? 'bg-green-100' :
                    'bg-purple-100'
                  }`}>
                    <item.icon className={`w-4 h-4 ${
                      item.color === 'blue' ? 'text-blue-600' :
                      item.color === 'green' ? 'text-green-600' :
                      'text-purple-600'
                    }`} />
                  </div>
                  <h4 className="font-medium text-gray-900">{item.name}</h4>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {item.used} of {item.limit === -1 ? '∞' : item.limit}
                  </p>
                  {item.limit > 0 && (
                    <p className="text-xs text-gray-600">{percentage.toFixed(0)}% used</p>
                  )}
                </div>
              </div>
              
              {item.limit > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${colorClasses[item.color as keyof typeof colorClasses]}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  ></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium text-blue-900">Transactions This Month</h4>
            <p className="text-2xl font-bold text-blue-900">{usageStats.transactionsThisMonth}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const InvoicesTab: React.FC<{
  invoices: Invoice[];
}> = ({ invoices }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Billing History</h3>
        <p className="text-gray-600">Download invoices and view payment history</p>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-12">
          <Archive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h3>
          <p className="text-gray-600">Your billing history will appear here once you start a subscription</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        #{invoice.id.slice(-8)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(invoice.created * 1000)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.amount_paid)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : invoice.status === 'open'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(invoice.period_start * 1000)} - {formatDate(invoice.period_end * 1000)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <a
                          href={invoice.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>View</span>
                        </a>
                        <a
                          href={invoice.invoice_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                        >
                          <Download className="w-4 h-4" />
                          <span>PDF</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const TenantBilling: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const { tenant } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'payment-methods' | 'usage' | 'invoices'>('overview');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Check for payment/subscription status in URL params
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    const updated = searchParams.get('updated');
    const demo = searchParams.get('demo');
    
    if (success === 'true') {
      setMessage({ type: 'success', text: 'Subscription created successfully! Welcome to your new plan.' });
    } else if (canceled === 'true') {
      setMessage({ type: 'error', text: 'Payment was canceled. You can try again anytime.' });
    } else if (updated === 'true') {
      if (demo === 'true') {
        setMessage({ type: 'success', text: 'Demo subscription activated! (Note: This is a demo mode - no payment was processed)' });
      } else {
        setMessage({ type: 'success', text: 'Subscription updated successfully!' });
      }
    }

    fetchData();
  }, [searchParams]);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchPlans(),
        fetchTrialStatus(),
        fetchPaymentMethods(),
        fetchInvoices(),
        fetchUsageStats()
      ]);
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
      setMessage({ type: 'error', text: 'Failed to load billing information. Please refresh the page.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const plansData = await api.platform.getPlans();
      setPlans(plansData);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  };

  const fetchTrialStatus = async () => {
    if (!tenantSlug) return;
    try {
      const status = await api.tenant.getTrialStatus(tenantSlug);
      setTrialStatus(status);
    } catch (error) {
      console.error('Failed to fetch trial status:', error);
    }
  };

  const fetchPaymentMethods = async () => {
    if (!tenantSlug) return;
    try {
      const methods = await api.tenant.getPaymentMethods(tenantSlug);
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
    }
  };

  const fetchInvoices = async () => {
    if (!tenantSlug) return;
    try {
      const invoiceData = await api.tenant.getInvoices(tenantSlug);
      setInvoices(invoiceData);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    }
  };

  const fetchUsageStats = async () => {
    if (!tenantSlug) return;
    try {
      const stats = await api.tenant.getUsageStats(tenantSlug);
      setUsageStats(stats);
    } catch (error) {
      console.error('Failed to fetch usage stats:', error);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!tenantSlug) return;
    
    try {
      setSubscribing(planId);
      const response = await api.tenant.subscribe(tenantSlug, planId) as { checkoutUrl?: string; redirectUrl?: string; message?: string };
      
      // If there's a redirectUrl, it means subscription was updated without checkout
      if (response.redirectUrl) {
        window.location.href = response.redirectUrl;
      } else if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      }
    } catch (error) {
      console.error('Failed to create subscription:', error);
      setMessage({ type: 'error', text: 'Failed to start subscription. Please try again.' });
      setSubscribing(null);
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'plans', name: 'Plans', icon: Crown },
    { id: 'payment-methods', name: 'Payment Methods', icon: CreditCard },
    { id: 'usage', name: 'Usage', icon: Settings },
    { id: 'invoices', name: 'Invoices', icon: History },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Trial Status Banner */}
        {trialStatus && trialStatus.subscriptionRequired && (
          <div className="mb-6">
            <TrialStatusBanner 
              activationsUsed={trialStatus.activationsUsed}
              trialLimit={trialStatus.trialLimit}
              subscriptionRequired={trialStatus.subscriptionRequired}
            />
          </div>
        )}

        {/* Success/Error Messages */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center space-x-2">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
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
              <OverviewTab 
                tenant={tenant}
                plans={plans}
                trialStatus={trialStatus}
                usageStats={usageStats}
                onSubscribe={handleSubscribe}
                subscribing={subscribing}
              />
            )}
            {activeTab === 'plans' && (
              <PlansTab 
                plans={plans}
                tenant={tenant}
                onSubscribe={handleSubscribe}
                subscribing={subscribing}
              />
            )}
            {activeTab === 'payment-methods' && (
              <PaymentMethodsTab 
                paymentMethods={paymentMethods}
                onRefresh={fetchPaymentMethods}
              />
            )}
            {activeTab === 'usage' && (
              <UsageTab 
                usageStats={usageStats}
              />
            )}
            {activeTab === 'invoices' && (
              <InvoicesTab 
                invoices={invoices}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantBilling;
