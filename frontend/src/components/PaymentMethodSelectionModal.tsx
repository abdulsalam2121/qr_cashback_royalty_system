import React, { useState } from 'react';
import { X, CreditCard, Plus, CheckCircle } from 'lucide-react';
import PaymentMethodModal from './PaymentMethodModal';
import { Plan } from '../types';
import { formatCurrency } from '../utils/format';

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

interface PaymentMethodSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethodId: string) => void;
  paymentMethods: PaymentMethod[];
  plan: Plan;
  tenantSlug: string;
  onPaymentMethodAdded: () => void;
}

const PaymentMethodSelectionModal: React.FC<PaymentMethodSelectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  paymentMethods,
  plan,
  tenantSlug,
  onPaymentMethodAdded,
}) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [showAddCard, setShowAddCard] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!selectedPaymentMethod) {
      alert('Please select a payment method');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting payment with method:', selectedPaymentMethod);
      console.log('Plan ID:', plan.id);
      console.log('Plan price (cents):', plan.priceMonthly);
      await onConfirm(selectedPaymentMethod);
    } catch (error) {
      console.error('Payment failed:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = () => {
    setShowAddCard(true);
  };

  const handleCardAdded = () => {
    setShowAddCard(false);
    onPaymentMethodAdded();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Complete Your Subscription</h2>
              <p className="text-sm text-gray-600">Choose a payment method for {plan.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Plan Summary */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-600">{plan.description}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(plan.priceMonthly / 100)}
                </p>
                <p className="text-sm text-gray-600">/month</p>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Select Payment Method</h3>
              <button
                onClick={handleAddCard}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Card</span>
              </button>
            </div>

            {paymentMethods.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No payment methods</h3>
                <p className="text-gray-600 mb-4">Add a credit or debit card to complete your subscription</p>
                <button
                  onClick={handleAddCard}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Your First Card
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedPaymentMethod === method.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={selectedPaymentMethod === method.id}
                      onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-gray-600" />
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
                      {selectedPaymentMethod === method.id && (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {paymentMethods.length > 0 && (
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
                <p>Your card will be charged {formatCurrency(plan.priceMonthly / 100)} today</p>
                <p>and then monthly until you cancel.</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!selectedPaymentMethod || loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : `Subscribe for ${formatCurrency(plan.priceMonthly / 100)}/month`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Payment Method Modal */}
      {showAddCard && (
        <PaymentMethodModal
          isOpen={showAddCard}
          onClose={() => setShowAddCard(false)}
          onSuccess={handleCardAdded}
          tenantSlug={tenantSlug}
        />
      )}
    </>
  );
};

export default PaymentMethodSelectionModal;
