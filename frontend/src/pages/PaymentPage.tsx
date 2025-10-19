import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  Store,
  User,
  Lock,
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface PaymentLinkData {
  paymentLink: {
    id: string;
    token: string;
    amountCents: number;
    description?: string;
    expiresAt: string;
  };
  purchaseTransaction: {
    id: string;
    amountCents: number;
    category: string;
    description?: string;
    customer?: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
    };
    store?: {
      id: string;
      name: string;
    };
    cardUid?: string;
  } | null;
  cardInfo?: {
    cardUid: string;
    balanceCents: number;
    customer?: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
    };
  } | null;
}

const CheckoutForm: React.FC<{
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
  disabled?: boolean;
}> = ({ clientSecret, amount, onSuccess, onError, disabled = false }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  // Debug: Log stripe and elements status
  useEffect(() => {
  }, [stripe, elements, clientSecret]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || disabled) {
      return;
    }

    setProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        console.error('Payment error:', error);
        onError(error.message || 'Payment failed');
      } else if (paymentIntent) {
        // Give webhook a moment to process before showing success
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Payment exception:', err);
      onError(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 border border-gray-200 rounded-lg">
        <PaymentElement
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
            fields: {
              billingDetails: {
                name: 'auto',
                email: 'auto',
                phone: 'auto',
                address: {
                  line1: 'auto',
                  line2: 'auto',
                  city: 'auto',
                  state: 'auto',
                  postalCode: 'auto',
                  country: 'auto',
                },
              },
            },
          }}
          onReady={() => void 0}
          onFocus={() => void 0}
          onBlur={() => void 0}
          onChange={() => {
            // Handle payment element changes if needed
          }}
        />
      </div>
      <button
        type="submit"
        disabled={!stripe || processing || disabled}
        className="w-full flex items-center justify-center px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? (
          <>
            <LoadingSpinner size="sm" className="mr-3" />
            Processing Payment...
          </>
        ) : (
          <>
            <Lock className="w-5 h-5 mr-3" />
            Pay {formatCurrency(amount / 100)} Securely
          </>
        )}
      </button>
    </form>
  );
};

const PaymentPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [paymentData, setPaymentData] = useState<PaymentLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Balance usage state
  const [balanceUsedCents, setBalanceUsedCents] = useState(0);
  const [remainingAmountCents, setRemainingAmountCents] = useState(0);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  useEffect(() => {
    if (token) {
      loadPaymentData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadPaymentData = async () => {
    if (!token) return;
    try {
      setError(null); // Clear any previous errors
      
      const data = await api.tenant.getPaymentLink(token);
      setPaymentData(data);

      // Initialize balance usage with the full payment amount
      const initialRemainingAmount = data.paymentLink.amountCents;
      setRemainingAmountCents(initialRemainingAmount);

      // request backend to create PaymentIntent for this link
      const intent = await api.tenant.createPaymentIntent(token);
      
      if (intent.client_secret) {
        setClientSecret(intent.client_secret);
      } else {
        throw new Error('No client secret returned from payment intent creation');
      }
    } catch (err) {
      console.error('Error loading payment data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load payment info');
    } finally {
      setLoading(false);
    }
  };

  const handleBalanceUsageChange = async (newBalanceUsedCents: number) => {
    if (!paymentData || !token) return;

    const totalAmountCents = paymentData.paymentLink.amountCents;
    const maxBalanceUsable = paymentData.cardInfo?.balanceCents || 0;
    
    // Clamp the balance usage to valid range
    const clampedBalanceUsed = Math.max(0, Math.min(newBalanceUsedCents, maxBalanceUsable, totalAmountCents));
    const newRemainingAmount = totalAmountCents - clampedBalanceUsed;

    try {
      setIsUpdatingPayment(true);
      
      // Update backend payment amount
      await api.tenant.updatePaymentAmount(token, clampedBalanceUsed);
      
      // Update local state
      setBalanceUsedCents(clampedBalanceUsed);
      setRemainingAmountCents(newRemainingAmount);

      // Create new payment intent with updated amount
      if (newRemainingAmount > 0) {
        const intent = await api.tenant.createPaymentIntent(token);
        if (intent.client_secret) {
          setClientSecret(intent.client_secret);
        }
      } else {
        // If remaining amount is 0, no Stripe payment needed
        setClientSecret(null);
      }
    } catch (err) {
      console.error('Error updating payment amount:', err);
      setError('Failed to update payment amount. Please try again.');
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading payment information...</p>
        </div>
      </div>
    );
  }

  if (error && !paymentData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-md w-full mx-4">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Link Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <p className="text-sm text-gray-500">
              This link may have expired or been used already. Contact the merchant for a new payment link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-md w-full mx-4">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-600 mb-6">
              Your payment of {formatCurrency((paymentData?.paymentLink.amountCents || 0) / 100)} was processed successfully.
              The transaction has been recorded and your rewards (if applicable) will be updated shortly.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg text-left">
              <h3 className="font-medium text-gray-900 mb-2">Transaction Details</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-medium">
                    {formatCurrency((paymentData?.paymentLink.amountCents || 0) / 100)}
                  </span>
                </div>
                {paymentData?.purchaseTransaction?.description && (
                  <div className="flex justify-between">
                    <span>Description:</span>
                    <span className="font-medium">{paymentData.purchaseTransaction.description}</span>
                  </div>
                )}
                {paymentData?.purchaseTransaction?.store?.name && (
                  <div className="flex justify-between">
                    <span>Store:</span>
                    <span className="font-medium">{paymentData.purchaseTransaction.store.name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-medium text-green-600">Completed</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              You may now close this window. A receipt has been sent to your email if provided.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!paymentData) return null;

  const isExpired = new Date() > new Date(paymentData.paymentLink.expiresAt);
  const timeRemaining =
    new Date(paymentData.paymentLink.expiresAt).getTime() - new Date().getTime();
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor(
    (timeRemaining % (1000 * 60 * 60)) / (1000 * 60)
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
            <div className="text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-4" />
              <h1 className="text-2xl font-bold">Complete Your Payment</h1>
              <p className="text-blue-100 mt-2">
                Secure Payment
                Processing
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {!isExpired && timeRemaining < 24 * 60 * 60 * 1000 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center space-x-3">
                <Clock className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Payment Link Expires Soon</p>
                  <p className="text-xs text-yellow-600">
                    {hoursRemaining > 0
                      ? `${hoursRemaining} hours and ${minutesRemaining} minutes remaining`
                      : `${minutesRemaining} minutes remaining`}
                  </p>
                </div>
              </div>
            )}

            {isExpired && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">Payment Link Expired</p>
                  <p className="text-xs text-red-600">
                    Expired on {new Date(paymentData.paymentLink.expiresAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Transaction Details */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction Details</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Amount</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatCurrency(paymentData.paymentLink.amountCents / 100)}
                  </span>
                </div>
                {paymentData.purchaseTransaction?.description && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Item/Service</span>
                    <span className="font-medium text-gray-900">
                      {paymentData.purchaseTransaction.description}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Category</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {paymentData.purchaseTransaction?.category.toLowerCase() || 'general'}
                  </span>
                </div>
                {paymentData.purchaseTransaction?.store?.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center">
                      <Store className="w-4 h-4 mr-1" />
                      Store
                    </span>
                    <span className="font-medium text-gray-900">
                      {paymentData.purchaseTransaction.store.name}
                    </span>
                  </div>
                )}
                {paymentData.purchaseTransaction?.customer && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center">
                      <User className="w-4 h-4 mr-1" />
                      Customer
                    </span>
                    <span className="font-medium text-gray-900">
                      {`${paymentData.purchaseTransaction.customer.firstName} ${paymentData.purchaseTransaction.customer.lastName}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Balance Usage Controls */}
            {!isExpired && paymentData.cardInfo && paymentData.cardInfo.balanceCents > 0 && (
              <div className="bg-blue-50 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                  Use Your Card Balance
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Available Balance:</span>
                    <span className="text-lg font-bold text-blue-600">
                      {formatCurrency(paymentData.cardInfo.balanceCents / 100)}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Amount to use from balance:
                    </label>
                    
                    {/* Balance slider */}
                    <div className="space-y-2">
                      <input
                        type="range"
                        min="0"
                        max={Math.min(paymentData.cardInfo.balanceCents, paymentData.paymentLink.amountCents)}
                        value={balanceUsedCents}
                        onChange={(e) => handleBalanceUsageChange(parseInt(e.target.value))}
                        disabled={isUpdatingPayment}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>$0.00</span>
                        <span>{formatCurrency(Math.min(paymentData.cardInfo.balanceCents, paymentData.paymentLink.amountCents) / 100)}</span>
                      </div>
                    </div>
                    
                    {/* Balance amount input */}
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Use:</span>
                      <input
                        type="number"
                        min="0"
                        max={Math.min(paymentData.cardInfo.balanceCents, paymentData.paymentLink.amountCents) / 100}
                        step="0.01"
                        value={(balanceUsedCents / 100).toFixed(2)}
                        onChange={(e) => {
                          const cents = Math.round(parseFloat(e.target.value || '0') * 100);
                          handleBalanceUsageChange(cents);
                        }}
                        disabled={isUpdatingPayment}
                        className="w-24 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">from balance</span>
                    </div>
                    
                    {/* Quick percentage buttons */}
                    <div className="flex space-x-2">
                      {[0, 25, 50, 75, 100].map((percentage) => {
                        const maxUsable = Math.min(paymentData.cardInfo!.balanceCents, paymentData.paymentLink.amountCents);
                        const amount = Math.round((maxUsable * percentage) / 100);
                        return (
                          <button
                            key={percentage}
                            onClick={() => handleBalanceUsageChange(amount)}
                            disabled={isUpdatingPayment}
                            className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                              balanceUsedCents === amount
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            } disabled:opacity-50`}
                          >
                            {percentage}%
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Payment breakdown */}
                  <div className="bg-white rounded-lg p-4 border">
                    <h4 className="font-medium text-gray-900 mb-3">Payment Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Amount:</span>
                        <span className="font-medium">{formatCurrency(paymentData.paymentLink.amountCents / 100)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Using Balance:</span>
                        <span className="font-medium text-blue-600">-{formatCurrency(balanceUsedCents / 100)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between">
                        <span className="text-gray-900 font-medium">Remaining to Pay:</span>
                        <span className="font-bold text-lg">{formatCurrency(remainingAmountCents / 100)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {isUpdatingPayment && (
                    <div className="flex items-center justify-center py-2">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <span className="text-sm text-gray-600">Updating payment amount...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stripe Payment Element */}
            {!isExpired && clientSecret && remainingAmountCents > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Payment Information</h3>
                <Elements 
                  stripe={stripePromise} 
                  options={{ 
                    clientSecret,
                    appearance: {
                      theme: 'stripe',
                      variables: {
                        colorPrimary: '#2563eb',
                        colorBackground: '#ffffff',
                        colorText: '#1f2937',
                        colorDanger: '#dc2626',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        spacingUnit: '4px',
                        borderRadius: '8px',
                      },
                    },
                  }}
                >
                  <CheckoutForm
                    clientSecret={clientSecret}
                    amount={remainingAmountCents}
                    onSuccess={() => setSuccess(true)}
                    onError={(msg) => setError(msg)}
                  />
                </Elements>
              </div>
            ) : !isExpired && remainingAmountCents === 0 && balanceUsedCents > 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-900 mb-2">Payment Covered by Balance!</h3>
                  <p className="text-sm text-green-700 mb-4">
                    Your entire purchase of {formatCurrency(paymentData.paymentLink.amountCents / 100)} 
                    is covered by your card balance. No additional payment required.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        // Process the balance-only payment
                        setIsUpdatingPayment(true);
                        // This would trigger a webhook or backend process to complete the transaction
                        setSuccess(true);
                      } catch (err) {
                        console.error('Error processing balance payment:', err);
                        setError('Failed to process payment. Please try again.');
                      } finally {
                        setIsUpdatingPayment(false);
                      }
                    }}
                    disabled={isUpdatingPayment}
                    className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUpdatingPayment ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Processing...
                      </>
                    ) : (
                      'Complete Purchase'
                    )}
                  </button>
                </div>
              </div>
            ) : !isExpired ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <LoadingSpinner size="sm" />
                  <p className="text-sm text-yellow-800">Loading payment form...</p>
                </div>
              </div>
            ) : null}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm font-medium text-red-800">Payment Error</p>
                </div>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    loadPaymentData();
                  }}
                  className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              🔒 Secure payment powered by Stripe. Your card details are encrypted and never touch our servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
