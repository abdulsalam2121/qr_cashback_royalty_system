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

            {/* Stripe Payment Element */}
            {!isExpired && clientSecret ? (
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
                    amount={paymentData.paymentLink.amountCents}
                    onSuccess={() => setSuccess(true)}
                    onError={(msg) => setError(msg)}
                  />
                </Elements>
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
