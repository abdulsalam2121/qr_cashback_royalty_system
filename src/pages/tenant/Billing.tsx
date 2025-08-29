import React, { useState, useEffect } from 'react';
import { CreditCard, Check, Crown, Zap, Building, ExternalLink } from 'lucide-react';
import { useParams } from 'react-router-dom';
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

const TenantBilling: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, updateTenant } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchPlans(),
        fetchTrialStatus()
      ]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const { plans } = await api.platform.getPlans();
      setPlans(plans);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  };

  const fetchTrialStatus = async () => {
    try {
      const response = await fetch(`/api/t/${tenantSlug}/trial/status`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setTrialStatus(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch trial status:', error);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!tenantSlug) return;
    
    try {
      setSubscribing(planId);
      const { checkoutUrl } = await api.tenant.subscribe(tenantSlug, planId);
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Failed to create subscription:', error);
      setSubscribing(null);
    }
  };

  const handleManageBilling = async () => {
    if (!tenantSlug) return;
    
    try {
      const { portalUrl } = await api.tenant.getBillingPortal(tenantSlug);
      window.open(portalUrl, '_blank');
    } catch (error) {
      console.error('Failed to open billing portal:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const currentPlan = plans.find(plan => plan.id === tenant?.planId);
  const isActive = tenant?.subscriptionStatus === 'ACTIVE';
  const isTrialing = tenant?.subscriptionStatus === 'TRIALING';
  const isPastDue = tenant?.subscriptionStatus === 'PAST_DUE';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <CreditCard className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-gray-600">Manage your subscription and billing information</p>
        </div>
      </div>

      {/* Trial Status Banner */}
      <TrialStatusBanner />

      {/* Current Subscription Status */}
      {tenant && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h2>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isActive ? 'bg-green-100' :
                isTrialing ? 'bg-blue-100' :
                isPastDue ? 'bg-orange-100' :
                'bg-gray-100'
              }`}>
                {currentPlan ? (
                  <Crown className={`w-6 h-6 ${
                    isActive ? 'text-green-600' :
                    isTrialing ? 'text-blue-600' :
                    isPastDue ? 'text-orange-600' :
                    'text-gray-600'
                  }`} />
                ) : (
                  <CreditCard className="w-6 h-6 text-gray-600" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {currentPlan ? currentPlan.name : 'No Active Plan'}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    isActive ? 'bg-green-100 text-green-800' :
                    isTrialing ? 'bg-blue-100 text-blue-800' :
                    isPastDue ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {tenant.subscriptionStatus}
                  </span>
                  {isTrialing && tenant.trialEndsAt && (
                    <span className="text-sm text-gray-500">
                      Trial ends {formatDate(tenant.trialEndsAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {(isActive || isPastDue) && (
              <button
                onClick={handleManageBilling}
                className="flex items-center px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Manage Billing
              </button>
            )}
          </div>
        </div>
      )}

      {/* Available Plans */}
      {(!isActive || tenant?.subscriptionStatus === 'NONE') && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Choose Your Plan</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className="border border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(plan.priceMonthly)}
                    </div>
                    <div className="text-sm text-gray-500">per month</div>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-6">{plan.description}</p>
                
                <div className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Plan Limits</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>Stores: {plan.limits.stores === -1 ? 'Unlimited' : plan.limits.stores}</div>
                    <div>Staff: {plan.limits.staff === -1 ? 'Unlimited' : plan.limits.staff}</div>
                    <div>Cards: {plan.limits.cards === -1 ? 'Unlimited' : plan.limits.cards}</div>
                    <div>Transactions: {plan.limits.transactions === -1 ? 'Unlimited' : `${plan.limits.transactions}/mo`}</div>
                  </div>
                </div>
                
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={subscribing === plan.id}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {subscribing === plan.id ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      {isTrialing ? 'Upgrade Now' : 'Start Free Trial'}
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantBilling;