import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Gift, Banknote, User, Clock, CheckCircle, AlertCircle, Star, CreditCard } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../utils/api';
import { formatCurrency, getTierColor } from '../utils/format';
import { Card } from '../types';

const RedemptionPage: React.FC = () => {
  const { cardUid } = useParams<{ cardUid: string }>();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [amount, setAmount] = useState('');
  const [redemptionType, setRedemptionType] = useState<'CASH' | 'STORE_CREDIT'>('CASH');

  useEffect(() => {
    if (cardUid) {
      loadCardData();
    }
  }, [cardUid]);

  const loadCardData = async () => {
    if (!cardUid) return;
    
    try {
      // This would need to be implemented in the API
      const cardData = await api.tenant.getCardByUid(cardUid);
      setCard(cardData);
      
      // Load redemption history
      // const history = await api.tenant.getRedemptionHistory(cardUid);
      // setRedemptionHistory(history);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load card information');
    } finally {
      setLoading(false);
    }
  };

  const handleRedemption = async () => {
    if (!card || !amount) return;
    
    setProcessing(true);
    setError(null);

    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      
      if (amountCents > (card.balanceCents || 0)) {
        throw new Error('Insufficient cashback balance');
      }

      // Process redemption request
      await api.tenant.redeemCashback(
        card.tenantSlug!,
        cardUid!,
        amountCents,
        card.storeId!
      );

      setSuccess(true);
      
      // Update card balance
      setCard(prev => prev ? {
        ...prev,
        balanceCents: (prev.balanceCents || 0) - amountCents
      } : null);

      // Clear amount
      setAmount('');
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Redemption failed');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading your cashback information...</p>
        </div>
      </div>
    );
  }

  if (error && !card) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 max-w-md w-full mx-4">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Card Not Found</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <p className="text-sm text-gray-500">
              Please check your card details or contact the store for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6">
            <div className="text-center">
              <Gift className="w-12 h-12 mx-auto mb-4" />
              <h1 className="text-2xl font-bold">Cashback Redemption</h1>
              <p className="text-blue-100 mt-2">
                Redeem your earned cashback rewards
              </p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Redemption Successful!</p>
                  <p className="text-sm text-green-600">Your cashback has been processed successfully.</p>
                </div>
              </div>
            )}

            {/* Card Information */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <User className="w-6 h-6 text-blue-600" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {card.customer?.firstName} {card.customer?.lastName}
                    </h2>
                    <p className="text-sm text-gray-600">Card: {card.cardUid}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getTierColor(card.tier || card.customer?.tier || 'SILVER')}`}>
                  <Star className="w-4 h-4 inline mr-1" />
                  {card.tier || card.customer?.tier || 'SILVER'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Available Balance</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency((card.balanceCents || 0) / 100)}
                  </p>
                </div>
                <div className="text-center bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Store</p>
                  <p className="text-lg font-medium text-gray-900">
                    {card.store?.name || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Redemption Form */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Redeem Your Cashback</h3>

              {/* Redemption Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Choose Redemption Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setRedemptionType('CASH')}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      redemptionType === 'CASH'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <Banknote className="w-5 h-5 mr-3" />
                      <div>
                        <p className="font-medium">Cash Payout</p>
                        <p className="text-xs text-gray-500">Get cash at store</p>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setRedemptionType('STORE_CREDIT')}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      redemptionType === 'STORE_CREDIT'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <CreditCard className="w-5 h-5 mr-3" />
                      <div>
                        <p className="font-medium">Store Credit</p>
                        <p className="text-xs text-gray-500">For future purchases</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Quick Amount Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Amount
                </label>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[5, 10, 25, 50].map((quickAmount) => (
                    <button
                      key={quickAmount}
                      onClick={() => setAmount(quickAmount.toString())}
                      disabled={(quickAmount * 100) > (card.balanceCents || 0)}
                      className={`py-3 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        (quickAmount * 100) > (card.balanceCents || 0)
                          ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                          : amount === quickAmount.toString()
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-300 hover:border-blue-500 hover:text-blue-600'
                      }`}
                    >
                      ${quickAmount}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or Enter Custom Amount
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={(card.balanceCents || 0) / 100}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {amount && parseFloat(amount) > 0 && (
                  <p className="mt-2 text-sm text-gray-600">
                    Remaining balance: {formatCurrency(((card.balanceCents || 0) - (parseFloat(amount) * 100)) / 100)}
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleRedemption}
                disabled={!amount || processing || (parseFloat(amount) * 100) > (card.balanceCents || 0)}
                className={`w-full flex items-center justify-center px-6 py-4 text-white font-semibold rounded-lg transition-colors ${
                  redemptionType === 'CASH'
                    ? 'bg-green-600 hover:bg-green-700 disabled:opacity-50'
                    : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
                }`}
              >
                {processing ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-3" />
                    Processing Redemption...
                  </>
                ) : (
                  <>
                    {redemptionType === 'CASH' ? (
                      <Banknote className="w-5 h-5 mr-3" />
                    ) : (
                      <CreditCard className="w-5 h-5 mr-3" />
                    )}
                    {`Request ${redemptionType === 'CASH' ? 'Cash Payout' : 'Store Credit'} ${
                      amount ? formatCurrency(parseFloat(amount)) : ''
                    }`}
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                {redemptionType === 'CASH' 
                  ? '💵 Visit the store to collect your cash payout after approval'
                  : '🛍️ Store credit will be available immediately for your next purchase'
                }
              </p>
            </div>

            {/* Redemption Instructions */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                How Redemption Works
              </h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>1. Choose your preferred redemption method above</p>
                <p>2. Select or enter the amount you want to redeem</p>
                <p>3. Submit your redemption request</p>
                <p>4. {redemptionType === 'CASH' 
                  ? 'Visit the store to collect your cash payout'
                  : 'Your store credit will be added to your account instantly'
                }</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedemptionPage;