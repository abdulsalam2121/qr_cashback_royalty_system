import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, CheckCircle, AlertCircle, Clock, Store, User, DollarSign } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';

interface PaymentLinkData {
  paymentLink: {
    id: string;
    token: string;
    amountCents: number;
    description?: string;
    expiresAt: string;
    tenantName?: string;
  };
  transaction: {
    id: string;
    amountCents: number;
    category: string;
    description?: string;
    storeName?: string;
    customerName?: string;
  };
}

const PaymentPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [paymentData, setPaymentData] = useState<PaymentLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      loadPaymentData();
    }
  }, [token]);

  const loadPaymentData = async () => {
    if (!token) return;
    
    try {
      const data = await api.tenant.getPaymentLink(token);
      setPaymentData(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load payment information');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!token || !paymentData) return;
    
    setProcessing(true);
    setError(null);

    try {
      await api.tenant.processPaymentLink(token);
      setSuccess(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setProcessing(false);
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
              This payment link may have expired or been used already. Please contact the merchant for a new payment link.
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
              Your payment of {formatCurrency(paymentData?.paymentLink.amountCents || 0)} has been processed successfully.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg text-left">
              <h3 className="font-medium text-gray-900 mb-2">Transaction Details</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-medium">{formatCurrency(paymentData?.paymentLink.amountCents || 0)}</span>
                </div>
                {paymentData?.transaction.description && (
                  <div className="flex justify-between">
                    <span>Description:</span>
                    <span className="font-medium">{paymentData.transaction.description}</span>
                  </div>
                )}
                {paymentData?.transaction.storeName && (
                  <div className="flex justify-between">
                    <span>Store:</span>
                    <span className="font-medium">{paymentData.transaction.storeName}</span>
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

  if (!paymentData) {
    return null;
  }

  const isExpired = new Date() > new Date(paymentData.paymentLink.expiresAt);
  const timeRemaining = new Date(paymentData.paymentLink.expiresAt).getTime() - new Date().getTime();
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

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
                {paymentData.paymentLink.tenantName && `${paymentData.paymentLink.tenantName} • `}
                Secure Payment Processing
              </p>
            </div>
          </div>

          {/* Payment Information */}
          <div className="p-6 space-y-6">
            {/* Expiry Warning */}
            {!isExpired && timeRemaining < 24 * 60 * 60 * 1000 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center space-x-3">
                <Clock className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Payment Link Expires Soon</p>
                  <p className="text-xs text-yellow-600">
                    {hoursRemaining > 0 
                      ? `${hoursRemaining} hours and ${minutesRemaining} minutes remaining`
                      : `${minutesRemaining} minutes remaining`
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Expired Notice */}
            {isExpired && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">Payment Link Expired</p>
                  <p className="text-xs text-red-600">
                    This payment link expired on {new Date(paymentData.paymentLink.expiresAt).toLocaleString()}
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
                    {formatCurrency(paymentData.paymentLink.amountCents)}
                  </span>
                </div>
                
                {paymentData.transaction.description && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Item/Service</span>
                    <span className="font-medium text-gray-900">
                      {paymentData.transaction.description}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Category</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {paymentData.transaction.category.toLowerCase()}
                  </span>
                </div>

                {paymentData.transaction.storeName && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center">
                      <Store className="w-4 h-4 mr-1" />
                      Store
                    </span>
                    <span className="font-medium text-gray-900">
                      {paymentData.transaction.storeName}
                    </span>
                  </div>
                )}

                {paymentData.transaction.customerName && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center">
                      <User className="w-4 h-4 mr-1" />
                      Customer
                    </span>
                    <span className="font-medium text-gray-900">
                      {paymentData.transaction.customerName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Button */}
            {!isExpired && (
              <div className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <button
                  onClick={handlePayment}
                  disabled={processing || isExpired}
                  className="w-full flex items-center justify-center px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {processing ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-3" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-5 h-5 mr-3" />
                      Pay {formatCurrency(paymentData.paymentLink.amountCents)}
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  By clicking "Pay", you confirm that you want to complete this payment. 
                  This action cannot be undone.
                </p>
              </div>
            )}

            {/* Expired Action */}
            {isExpired && (
              <div className="text-center py-4">
                <p className="text-gray-600 mb-4">
                  This payment link has expired. Please contact the merchant to get a new payment link.
                </p>
                <button
                  onClick={() => window.close()}
                  className="px-6 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close Window
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              🔒 This is a secure payment processed by the QR Cashback & Loyalty System. 
              Your payment information is encrypted and protected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;