import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface TrialStatus {
  activationsUsed: number;
  activationsRemaining: number;
  trialLimit: number;
  isTrialActive: boolean;
  subscriptionRequired: boolean;
  subscriptionStatus: string;
}

interface SubscriptionInfo {
  status: string;
  isActive: boolean;
  isTrial: boolean;
  planName: string | null;
  cardLimit: number;
  cardsUsed: number;
  cardsRemaining: number;
  showUpgradePrompt: boolean;
}

export default function TrialStatusBanner() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useAuthStore();
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrialStatus();
    fetchSubscriptionInfo();
  }, [tenantSlug, tenant]);

  const fetchTrialStatus = async () => {
    if (!tenantSlug) return;
    
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
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionInfo = async () => {
    if (!tenantSlug) return;
    
    try {
      const response = await fetch(`/api/t/${tenantSlug}/tenant`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSubscriptionInfo(data.tenant.subscriptionInfo);
      }
    } catch (error) {
      console.error('Failed to fetch subscription info:', error);
    }
  };

  if (loading) {
    return null;
  }

  // Show subscription status banner for active subscriptions
  if (subscriptionInfo?.isActive && subscriptionInfo.planName) {
    const percentage = subscriptionInfo.cardLimit > 0 
      ? (subscriptionInfo.cardsUsed / subscriptionInfo.cardLimit) * 100 
      : 0;
    const isWarning = subscriptionInfo.cardsRemaining <= 50; // Warning when less than 50 cards remaining

    return (
      <div className={`border-l-4 p-4 mb-6 ${
        isWarning 
          ? 'bg-yellow-50 border-yellow-400' 
          : 'bg-green-50 border-green-400'
      }`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg 
              className={`h-5 w-5 ${isWarning ? 'text-yellow-400' : 'text-green-400'}`} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              {isWarning ? (
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              )}
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className={`text-sm font-medium ${
              isWarning ? 'text-yellow-800' : 'text-green-800'
            }`}>
              {subscriptionInfo.planName} Plan - Active
            </h3>
            <div className={`mt-2 text-sm ${
              isWarning ? 'text-yellow-700' : 'text-green-700'
            }`}>
              <p>
                You've used <strong>{subscriptionInfo.cardsUsed}</strong> of{' '}
                <strong>{subscriptionInfo.cardLimit}</strong> subscription cards.
                {subscriptionInfo.cardsRemaining > 0 ? (
                  <>
                    {' '}<strong>{subscriptionInfo.cardsRemaining}</strong> cards remaining.
                  </>
                ) : (
                  <span className="text-red-600 font-semibold"> No cards remaining.</span>
                )}
              </p>
              
              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>Card Usage</span>
                  <span>{Math.round(percentage)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isWarning ? 'bg-yellow-400' : 'bg-green-400'
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            
            {subscriptionInfo.cardsRemaining <= 0 && (
              <div className="mt-4">
                <div className="flex space-x-3">
                  <button
                    onClick={() => window.location.href = `/t/${tenantSlug}/billing`}
                    className="bg-blue-100 px-3 py-2 rounded-md text-sm font-medium text-blue-800 hover:bg-blue-200 transition-colors"
                  >
                    Upgrade Plan
                  </button>
                  <button
                    onClick={() => window.location.href = `/t/${tenantSlug}/card-orders`}
                    className="bg-gray-100 px-3 py-2 rounded-md text-sm font-medium text-gray-800 hover:bg-gray-200 transition-colors"
                  >
                    Order More Cards
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle trial users
  if (!trialStatus) {
    return null;
  }

  const percentage = (trialStatus.activationsUsed / trialStatus.trialLimit) * 100;
  const isWarning = trialStatus.activationsRemaining <= 5;
  const isExpired = trialStatus.subscriptionRequired;

  if (isExpired) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800">
              Free Trial Expired
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>
                You've used all {trialStatus.trialLimit} free card activations. 
                Upgrade to our <strong>$19.99/month</strong> plan to continue activating cards.
              </p>
            </div>
            <div className="mt-4">
              <div className="flex space-x-3">
                <button
                  onClick={() => window.location.href = '/billing'}
                  className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200 transition-colors"
                >
                  Upgrade Now
                </button>
                <button
                  onClick={() => window.location.href = '/card-orders'}
                  className="bg-gray-100 px-3 py-2 rounded-md text-sm font-medium text-gray-800 hover:bg-gray-200 transition-colors"
                >
                  Order More Cards
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border-l-4 p-4 mb-6 ${
      isWarning 
        ? 'bg-yellow-50 border-yellow-400' 
        : 'bg-blue-50 border-blue-400'
    }`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg 
            className={`h-5 w-5 ${isWarning ? 'text-yellow-400' : 'text-blue-400'}`} 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            {isWarning ? (
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            )}
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${
            isWarning ? 'text-yellow-800' : 'text-blue-800'
          }`}>
            Free Trial Status
          </h3>
          <div className={`mt-2 text-sm ${
            isWarning ? 'text-yellow-700' : 'text-blue-700'
          }`}>
            <p>
              You've used <strong>{trialStatus.activationsUsed}</strong> of{' '}
              <strong>{trialStatus.trialLimit}</strong> free card activations.
              {trialStatus.activationsRemaining > 0 ? (
                <>
                  {' '}<strong>{trialStatus.activationsRemaining}</strong> activations remaining.
                </>
              ) : null}
            </p>
            
            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>Progress</span>
                <span>{Math.round(percentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isWarning ? 'bg-yellow-400' : 'bg-blue-400'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>
          
          {isWarning && (
            <div className="mt-4">
              <div className="flex space-x-3">
                <button
                  onClick={() => window.location.href = '/billing'}
                  className="bg-yellow-100 px-3 py-2 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-200 transition-colors"
                >
                  Upgrade for $19.99/month
                </button>
                <button
                  onClick={() => window.location.href = '/card-orders'}
                  className="bg-gray-100 px-3 py-2 rounded-md text-sm font-medium text-gray-800 hover:bg-gray-200 transition-colors"
                >
                  Order More Cards
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
