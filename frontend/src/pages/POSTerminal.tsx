import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { QrCode, Scan, DollarSign, Gift, CreditCard, User, AlertCircle, CheckCircle } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../utils/api';
import { formatCurrency, getTierColor } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { Card, Transaction } from '../types';

const POSTerminal: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'scan' | 'earn' | 'redeem'>('scan');
  const [scannedCard, setScannedCard] = useState<Card | null>(null);
  const [manualCardUid, setManualCardUid] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<'PURCHASE' | 'REPAIR' | 'OTHER'>('PURCHASE');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  
  // Check subscription status
  const isSubscriptionActive = tenant?.subscriptionStatus === 'ACTIVE' || 
    tenant?.subscriptionStatus === 'TRIALING' ||
    (tenant?.subscriptionStatus === 'PAST_DUE' && tenant?.graceEndsAt && new Date(tenant.graceEndsAt) > new Date());

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, []);

  const initializeScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (decodedText) => {
        handleScan(decodedText);
        scanner.clear();
        setShowScanner(false);
      },
      (error) => {
        console.warn('QR scan error:', error);
      }
    );

    scannerRef.current = scanner;
  };

  const handleScan = async (scannedData: string) => {
    if (!tenantSlug) return;
    
    setLoading(true);
    setMessage(null);

    try {
      // Extract card UID from QR code data
      // QR codes contain URLs like: https://www.loyalty-qr.com/c/A1WPKN0NBR5Y
      // We need to extract just the card UID (A1WPKN0NBR5Y)
      let cardUid = scannedData;
      
      // Check if scannedData is a URL
      if (scannedData.includes('/c/')) {
        const match = scannedData.match(/\/c\/([A-Z0-9]+)$/);
        if (match && match[1]) {
          cardUid = match[1];
        }
      }
      
      if (import.meta.env.DEV) {
        console.log('Scanned data:', scannedData);
        console.log('Extracted card UID:', cardUid);
      }
      
      const card = await api.tenant.getCard(tenantSlug, cardUid);
      setScannedCard(card);
      setActiveTab('earn');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Card not found'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = async () => {
    if (!manualCardUid.trim()) return;
    await handleScan(manualCardUid.trim());
    setManualCardUid('');
  };

  const handleEarnCashback = async () => {
    if (!scannedCard || !amount || !tenantSlug) return;
    
    if (!isSubscriptionActive) {
      setMessage({
        type: 'error',
        text: 'Subscription required to process transactions'
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      const transaction = await api.tenant.earnCashback(tenantSlug, scannedCard.cardUid, amountCents, category, scannedCard.storeId!);
      
      // Update card balance
      setScannedCard(prev => prev ? {
        ...prev,
        balanceCents: transaction.newBalance
      } : null);

      setMessage({
        type: 'success',
        text: `Earned ${formatCurrency(transaction.cashbackEarned)} cashback!`
      });
      setAmount('');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Transaction failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemCashback = async () => {
    if (!scannedCard || !amount || !tenantSlug) return;
    
    if (!isSubscriptionActive) {
      setMessage({
        type: 'error',
        text: 'Subscription required to process transactions'
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      const transaction = await api.tenant.redeemCashback(tenantSlug, scannedCard.cardUid, amountCents, scannedCard.storeId!);
      
      // Update card balance
      setScannedCard(prev => prev ? {
        ...prev,
        balanceCents: transaction.newBalance
      } : null);

      setMessage({
        type: 'success',
        text: `Redeemed ${formatCurrency(transaction.amountRedeemed)} successfully!`
      });
      setAmount('');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Redemption failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setScannedCard(null);
    setAmount('');
    setMessage(null);
    setActiveTab('scan');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">POS Terminal</h1>
            <p className="text-gray-600 mt-1">Scan cards to process transactions</p>
          </div>
          {scannedCard && (
            <button
              onClick={resetSession}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              New Transaction
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center space-x-2 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Scanner/Card Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {!scannedCard ? (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <QrCode className="w-5 h-5 mr-2" />
                Scan Customer Card
              </h2>

              {/* QR Scanner */}
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setShowScanner(true);
                    setTimeout(initializeScanner, 100);
                  }}
                  disabled={showScanner}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Scan className="w-5 h-5 mr-2" />
                  {showScanner ? 'Scanner Active' : 'Start Camera Scanner'}
                </button>

                {showScanner && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <div id="qr-reader" className="w-full"></div>
                    <button
                      onClick={() => {
                        if (scannerRef.current) {
                          scannerRef.current.clear();
                        }
                        setShowScanner(false);
                      }}
                      className="mt-4 w-full px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Stop Scanner
                    </button>
                  </div>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or</span>
                  </div>
                </div>

                {/* Manual Entry */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Enter Card UID manually
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={manualCardUid}
                      onChange={(e) => setManualCardUid(e.target.value)}
                      placeholder="e.g., CARD001"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={handleManualEntry}
                      disabled={!manualCardUid.trim() || loading}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? <LoadingSpinner size="sm" /> : 'Load'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Card Information
              </h2>

              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span className="font-medium">
                      {scannedCard.customer ? 
                        `${scannedCard.customer.firstName} ${scannedCard.customer.lastName}` : 
                        'Unknown Customer'
                      }
                    </span>
                  </div>
                  {scannedCard.customer && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium bg-white ${
                      getTierColor(scannedCard.customer.tier).replace('bg-', 'text-').replace('text-', '')
                    }`}>
                      {scannedCard.customer.tier}
                    </span>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="opacity-90">Card ID:</span>
                    <span className="font-mono">{scannedCard.cardUid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-90">Balance:</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(scannedCard.balanceCents)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-90">Store:</span>
                    <span>{scannedCard.storeName}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Transaction Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {scannedCard ? (
            <div className="space-y-6">
              {/* Tab Navigation */}
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('earn')}
                  className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'earn'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  Earn Cashback
                </button>
                <button
                  onClick={() => setActiveTab('redeem')}
                  className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'redeem'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Gift className="w-4 h-4 mr-1" />
                  Redeem
                </button>
              </div>

              {/* Earn Cashback */}
              {activeTab === 'earn' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Earn Cashback</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transaction Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as 'PURCHASE' | 'REPAIR' | 'OTHER')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="PURCHASE">Purchase</option>
                      <option value="REPAIR">Repair</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <button
                    onClick={handleEarnCashback}
                    disabled={!amount || loading}
                    className={`w-full flex items-center justify-center px-4 py-3 rounded-lg transition-colors ${
                      !isSubscriptionActive 
                        ? 'bg-gray-400 text-white cursor-not-allowed' 
                        : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                    }`}
                  >
                    {loading ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <DollarSign className="w-5 h-5 mr-2" />
                    )}
                    Process Transaction
                  </button>
                </div>
              )}

              {/* Redeem Cashback */}
              {activeTab === 'redeem' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Redeem Cashback</h3>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-700">
                      Available Balance: <span className="font-semibold">
                        {formatCurrency(scannedCard.balanceCents)}
                      </span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Redemption Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={scannedCard.balanceCents / 100}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <button
                    onClick={handleRedeemCashback}
                    disabled={!amount || loading || (parseFloat(amount) * 100) > scannedCard.balanceCents}
                    className={`w-full flex items-center justify-center px-4 py-3 rounded-lg transition-colors ${
                      !isSubscriptionActive 
                        ? 'bg-gray-400 text-white cursor-not-allowed' 
                        : 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
                    }`}
                  >
                    {loading ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <Gift className="w-5 h-5 mr-2" />
                    )}
                    Process Redemption
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Scan a customer card to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default POSTerminal;