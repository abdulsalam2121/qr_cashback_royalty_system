import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Lock } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { formatCurrency } from '../utils/format';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface StripeCheckoutFormProps {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
  disabled?: boolean;
  submitButtonText?: string;
}

const StripeCheckoutForm: React.FC<StripeCheckoutFormProps> = ({ 
  clientSecret, 
  amount, 
  onSuccess, 
  onError, 
  disabled = false,
  submitButtonText = 'Pay Securely'
}) => {
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
        onSuccess();
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
            {submitButtonText || `Pay ${formatCurrency(amount / 100)}`}
          </>
        )}
      </button>
    </form>
  );
};

interface StripePaymentElementProps {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
  disabled?: boolean;
  submitButtonText?: string;
}

const StripePaymentElement: React.FC<StripePaymentElementProps> = (props) => {
  const { clientSecret, ...formProps } = props;

  if (!clientSecret) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <LoadingSpinner size="sm" />
          <p className="text-sm text-yellow-800">Loading payment form...</p>
        </div>
      </div>
    );
  }

  return (
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
      <StripeCheckoutForm clientSecret={clientSecret} {...formProps} />
    </Elements>
  );
};

export default StripePaymentElement;