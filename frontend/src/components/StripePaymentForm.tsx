import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Lock } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface StripePaymentFormProps {
  amount: number; // Amount in cents
  currency?: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  token: string;
  disabled?: boolean;
}

const PaymentForm: React.FC<{
  onSuccess: () => void;
  onError: (error: string) => void;
  disabled?: boolean;
}> = ({ onSuccess, onError, disabled = false }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || disabled) {
      return;
    }

    setProcessing(true);

    try {
      // For now, we'll simulate the payment process
      // In a real implementation, you would create a PaymentIntent on your backend
      // and pass the client_secret to confirmPayment
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For demo purposes, we'll just validate that the payment element is complete
      const { error: submitError } = await elements.submit();
      
      if (submitError) {
        onError(submitError.message || 'Payment validation failed');
        return;
      }

      // In a real implementation, you would do:
      // const { error } = await stripe.confirmPayment({
      //   elements,
      //   confirmParams: {
      //     return_url: window.location.origin + '/payment-success',
      //   },
      // });
      
      // For now, simulate success
      onSuccess();
      
    } catch (err: any) {
      console.error('Payment error:', err);
      onError(err.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <PaymentElement 
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
            fields: {
              billingDetails: {
                name: 'auto',
                email: 'never',
                phone: 'never',
                address: 'never'
              }
            }
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
            Pay Securely
          </>
        )}
      </button>
    </form>
  );
};

const StripePaymentForm: React.FC<StripePaymentFormProps> = ({ 
  amount, 
  currency = 'usd',
  onSuccess, 
  onError,
  disabled = false
}) => {
  // In a real implementation, you would create a PaymentIntent on your backend
  // and get the client_secret to initialize Elements
  // For now, we'll use a mock setup
  
  const options = {
    mode: 'payment' as const,
    amount: amount,
    currency: currency,
    // In production, you would get this from your backend after creating a PaymentIntent
    // clientSecret: 'pi_..._secret_...',
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#2563eb',
        colorBackground: '#ffffff',
        colorText: '#1f2937',
        colorDanger: '#dc2626',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px'
      }
    }
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm 
        onSuccess={onSuccess} 
        onError={onError}
        disabled={disabled}
      />
    </Elements>
  );
};

export default StripePaymentForm;