import React, { useState } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { X, CreditCard, Lock, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantSlug: string;
}

const PaymentMethodForm: React.FC<{
  onSuccess: () => void;
  onClose: () => void;
  tenantSlug: string;
}> = ({ onSuccess, onClose, tenantSlug }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create setup intent
      const response = await api.tenant.createSetupIntent(tenantSlug);
      
      // Check if we're in demo mode
      if (response.demo) {
        // Simulate successful card addition in demo mode
        onSuccess();
        onClose();
        return;
      }

      const { clientSecret } = response;
      const cardElement = elements.getElement(CardElement);
      
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Confirm setup intent
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (stripeError) {
        setError(stripeError.message || 'An error occurred');
        return;
      }

      if (setupIntent?.status === 'succeeded') {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Payment method setup error:', err);
      
      // Provide user-friendly error messages
      if (err.message?.includes('authentication')) {
        setError('Stripe authentication failed. Please contact support.');
      } else if (err.message?.includes('configuration')) {
        setError('Payment system configuration error. Please contact support.');
      } else if (err.message?.includes('connection')) {
        setError('Unable to connect to payment processor. Please check your internet connection.');
      } else {
        setError(err.message || 'Failed to add payment method. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
    hidePostalCode: false,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Information
        </label>
        <div className="border border-gray-300 rounded-lg p-4 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
        <Lock className="w-4 h-4" />
        <p>Your payment information is encrypted and secure.</p>
      </div>

      <div className="flex space-x-3 pt-6">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          <CreditCard className="w-4 h-4" />
          <span>{loading ? 'Adding...' : 'Add Card'}</span>
        </button>
      </div>
    </form>
  );
};

const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tenantSlug,
}) => {
  if (!isOpen) return null;

  const elementsOptions: StripeElementsOptions = {
    appearance: {
      theme: 'stripe',
    },
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Add Payment Method</h3>
                  <p className="text-sm text-gray-600">Add a new credit or debit card</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <Elements stripe={stripePromise} options={elementsOptions}>
              <PaymentMethodForm
                onSuccess={onSuccess}
                onClose={onClose}
                tenantSlug={tenantSlug}
              />
            </Elements>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodModal;
