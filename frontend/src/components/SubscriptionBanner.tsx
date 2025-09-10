import React from 'react';
import { AlertTriangle, CreditCard, Clock, X } from 'lucide-react';
import { Tenant } from '../types';
import { formatDate } from '../utils/format';

interface SubscriptionBannerProps {
  tenant: Tenant;
  onManageBilling?: () => void;
  onSubscribe?: () => void;
  onDismiss?: () => void;
}

const SubscriptionBanner: React.FC<SubscriptionBannerProps> = ({
  tenant,
  onManageBilling,
  onSubscribe,
  onDismiss
}) => {
  const { subscriptionStatus, trialEndsAt, graceEndsAt } = tenant;

  if (subscriptionStatus === 'ACTIVE') {
    // Show subscription status even when active
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-white">
            <CreditCard className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-green-800">Subscription Active</h3>
            <p className="text-sm text-green-800 opacity-90 mt-1">
              Your subscription is active and all features are available.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {onManageBilling && (
              <button
                onClick={onManageBilling}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-green-600 text-white hover:bg-green-700"
              >
                Manage Billing
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const getBannerConfig = () => {
    switch (subscriptionStatus) {
      case 'NONE':
        return {
          icon: CreditCard,
          title: 'Start Your Free Trial',
          message: 'Get started with a 14-day free trial. No credit card required.',
          bgColor: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
          actionText: 'Start Free Trial',
          action: onSubscribe,
        };
      
      case 'TRIALING':
        return {
          icon: Clock,
          title: 'Free Trial Active',
          message: 'You are currently on a free trial with card activation limits. Upgrade when ready to unlock unlimited activations.',
          bgColor: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
          actionText: 'View Trial Status',
          action: onSubscribe,
        };
      
      case 'PAST_DUE':
        const graceDays = graceEndsAt ? Math.ceil((new Date(graceEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
        return {
          icon: AlertTriangle,
          title: 'Payment Past Due',
          message: graceDays > 0 
            ? `Update your payment method within ${graceDays} days to avoid service interruption.`
            : 'Update your payment method to restore full access.',
          bgColor: 'bg-red-50 border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
          actionText: 'Update Payment',
          action: onManageBilling,
        };
      
      case 'CANCELED':
        return {
          icon: X,
          title: 'Subscription Canceled',
          message: 'Your subscription has been canceled. Reactivate to continue using the service.',
          bgColor: 'bg-gray-50 border-gray-200',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
          actionText: 'Reactivate',
          action: onSubscribe,
        };
      
      default:
        return null;
    }
  };

  const config = getBannerConfig();
  if (!config) return null;

  const { icon: Icon, title, message, bgColor, textColor, iconColor, actionText, action } = config;

  return (
    <div className={`${bgColor} border rounded-xl p-4 mb-6`}>
      <div className="flex items-start space-x-3">
        <div className={`p-2 rounded-lg bg-white`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${textColor}`}>{title}</h3>
          <p className={`text-sm ${textColor} opacity-90 mt-1`}>{message}</p>
        </div>
        <div className="flex items-center space-x-2">
          {action && (
            <button
              onClick={action}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                subscriptionStatus === 'PAST_DUE' || subscriptionStatus === 'CANCELED'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {actionText}
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className={`p-1 rounded-lg hover:bg-white hover:bg-opacity-50 ${textColor}`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionBanner;