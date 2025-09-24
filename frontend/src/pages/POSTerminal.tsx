import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { QrCode, Scan, DollarSign, Gift, CreditCard, User, AlertCircle, CheckCircle, Copy, ExternalLink, Banknote, Smartphone } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'react-qr-code';
import LoadingSpinner from '../components/LoadingSpinner';
import StripePaymentElement from '../components/StripePaymentElement';
import { api } from '../utils/api';
import { formatCurrency, getTierColor } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { Card } from '../types';

const POSTerminal: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'scan' | 'purchase' | 'redeem'>('scan');
  const [scannedCard, setScannedCard] = useState<Card | null>(null);
  const [manualCardUid, setManualCardUid] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<'PURCHASE' | 'REPAIR' | 'OTHER'>('PURCHASE');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'QR_PAYMENT' | 'CASH' | 'CARD'>('CASH');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [redemptionType, setRedemptionType] = useState<'CASH' | 'STORE_CREDIT'>('CASH');
  
  // Stripe payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cardPaymentPending, setCardPaymentPending] = useState(false);
  
  // Customer information for new customers
  const [customerInfo, setCustomerInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  
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
      console.log('🔍 Card API Response:', card);
      console.log('🔍 Card customer:', card.customer);
      console.log('🔍 Card status:', card.status);
      console.log('🔍 Card customerId:', card.customerId);
      
      setScannedCard(card);
      setActiveTab('purchase');
      setMessage({
        type: 'success',
        text: `Card loaded successfully! ${card.customer ? 
          `Customer: ${card.customer.firstName} ${card.customer.lastName}` : 
          'Card is not linked to a customer - transaction will proceed without cashback rewards'
        }`
      });
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

  const handleCreatePurchase = async () => {
    if (!amount || !tenantSlug) return;
    
    if (!isSubscriptionActive) {
      setMessage({
        type: 'error',
        text: 'Subscription required to process transactions'
      });
      return;
    }

    // Validate customer info for QR payments without cards
    if (paymentMethod === 'QR_PAYMENT' && !scannedCard && 
        (!customerInfo.firstName || !customerInfo.lastName)) {
      setMessage({
        type: 'error',
        text: 'Customer name is required for QR payments'
      });
      return;
    }

    setLoading(true);
    setMessage(null);
    setPaymentUrl(null);

    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      
      const data: any = {
        amountCents,
        category,
        description: description || undefined,
        paymentMethod,
      };

      // Add card if scanned
      if (scannedCard) {
        data.cardUid = scannedCard.cardUid;
      }

      // Add customer info for non-card transactions or QR payments
      if (!scannedCard || paymentMethod === 'QR_PAYMENT') {
        if (customerInfo.firstName && customerInfo.lastName) {
          data.customerInfo = customerInfo;
        }
      }

      // Special handling for card payments - create payment intent
      if (paymentMethod === 'CARD') {
        // First create the purchase transaction to get a payment link
        const result = await api.tenant.createPurchaseTransaction(tenantSlug, { ...data, paymentMethod: 'QR_PAYMENT' });
        
        if (result.paymentUrl) {
          // Extract token from the payment URL
          const urlParts = result.paymentUrl.split('/');
          const token = urlParts[urlParts.length - 1];
          
          // Create payment intent using the token
          const intent = await api.tenant.createPaymentIntent(token);
          setClientSecret(intent.client_secret);
          setCardPaymentPending(true);
          setMessage({
            type: 'info',
            text: 'Complete the card payment below to finalize the transaction.'
          });
        }
      } else {
        const result = await api.tenant.createPurchaseTransaction(tenantSlug, data);

        if (paymentMethod === 'QR_PAYMENT' && result.paymentUrl) {
          setPaymentUrl(result.paymentUrl);
          setMessage({
            type: 'info',
            text: 'QR Payment link generated! Share this link with the customer to complete payment.'
          });
        } else {
          // For CASH payments - they are completed immediately
          setMessage({
            type: 'success',
            text: `${paymentMethod} transaction completed successfully! ${
              result.transaction.cashbackCents ? 
              `Cashback earned: ${formatCurrency(result.transaction.cashbackCents / 100)}` : ''
            }`
          });
          
          // Update card balance if applicable
          if (scannedCard && result.transaction.cashbackCents) {
            setScannedCard(prev => prev ? {
              ...prev,
              balanceCents: prev.balanceCents + result.transaction.cashbackCents
            } : null);
          }
          
          // Clear form after successful transaction
          setTimeout(() => {
            setAmount('');
            setDescription('');
            setCustomerInfo({ firstName: '', lastName: '', email: '', phone: '' });
          }, 1000);
        }
      }
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({
        type: 'success',
        text: 'Payment link copied to clipboard!'
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to copy to clipboard'
      });
    }
  };

  const handleStripePaymentSuccess = async () => {
    // Card payment was successful, now complete the transaction
    setCardPaymentPending(false);
    setClientSecret(null);
    setMessage({
      type: 'success',
      text: 'Card payment completed successfully!'
    });
    
    // Clear form after successful transaction
    setTimeout(() => {
      setAmount('');
      setDescription('');
      setCustomerInfo({ firstName: '', lastName: '', email: '', phone: '' });
    }, 1000);
  };

  const handleStripePaymentError = (error: string) => {
    setMessage({
      type: 'error',
      text: `Card payment failed: ${error}`
    });
  };

  const resetSession = () => {
    setScannedCard(null);
    setAmount('');
    setDescription('');
    setMessage(null);
    setPaymentUrl(null);
    setCustomerInfo({ firstName: '', lastName: '', email: '', phone: '' });
    setActiveTab('scan');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">POS Terminal</h1>
            <p className="text-gray-600 mt-1">Process customer purchases and manage loyalty rewards</p>
          </div>
          <button
            onClick={resetSession}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            New Transaction
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center space-x-2 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200'
            : message.type === 'info'
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : message.type === 'info' ? (
            <AlertCircle className="w-5 h-5 text-blue-500" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Scanner/Card Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <QrCode className="w-5 h-5 mr-2" />
              Customer Card (Optional)
            </h2>

            {!scannedCard ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Scan a customer card to earn cashback rewards, or create a transaction without a card.
                </p>
                
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

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Note:</strong> You can process transactions without scanning a card. 
                    Customers will still be able to earn cashback if they provide their information.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <User className="w-5 h-5" />
                      <span className="font-medium">
                        {scannedCard.customer ? 
                          `${scannedCard.customer.firstName} ${scannedCard.customer.lastName}` : 
                          'Card Not Activated'
                        }
                      </span>
                    </div>
                    {scannedCard.customer && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium bg-white text-gray-800`}>
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
                        {formatCurrency((scannedCard.balanceCents || 0) / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-90">Store:</span>
                      <span>{scannedCard.storeName || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setScannedCard(null)}
                  className="w-full px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Remove Card
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Transaction Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('purchase')}
                className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'purchase'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Create Purchase
              </button>
              {scannedCard && scannedCard.customer && (
                <button
                  onClick={() => setActiveTab('redeem')}
                  className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'redeem'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Gift className="w-4 h-4 mr-1" />
                  Redeem Cashback
                </button>
              )}
            </div>

            {/* Purchase Transaction */}
            {activeTab === 'purchase' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Create Purchase Transaction</h3>
                
                {/* Transaction Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Purchase Amount ($) *
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

                {/* Category */}
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

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., iPhone 15 Pro"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Customer Information (if no card scanned) */}
                {!scannedCard && (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                    <h4 className="font-medium text-gray-900">Customer Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          First Name {paymentMethod === 'QR_PAYMENT' ? '*' : ''}
                        </label>
                        <input
                          type="text"
                          value={customerInfo.firstName}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, firstName: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name {paymentMethod === 'QR_PAYMENT' ? '*' : ''}
                        </label>
                        <input
                          type="text"
                          value={customerInfo.lastName}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, lastName: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email (Optional)
                        </label>
                        <input
                          type="email"
                          value={customerInfo.email}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone (Optional)
                        </label>
                        <input
                          type="tel"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setPaymentMethod('CASH')}
                      className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg transition-colors ${
                        paymentMethod === 'CASH'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <Banknote className="w-5 h-5 mr-2" />
                      Cash
                    </button>
                    <button
                      onClick={() => setPaymentMethod('CARD')}
                      className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg transition-colors ${
                        paymentMethod === 'CARD'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 mr-2" />
                      Card Payment
                    </button>
                    <button
                      onClick={() => setPaymentMethod('QR_PAYMENT')}
                      className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg transition-colors ${
                        paymentMethod === 'QR_PAYMENT'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <Smartphone className="w-5 h-5 mr-2" />
                      QR Payment
                    </button>
                  </div>
                </div>

                {paymentMethod === 'QR_PAYMENT' && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>QR Payment:</strong> A payment link will be generated for the customer. 
                      They can scan the QR code or use the link to complete payment online.
                    </p>
                  </div>
                )}

                {paymentMethod === 'CARD' && (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                    <h4 className="font-medium text-gray-900">Card Payment</h4>
                    {!cardPaymentPending ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-700">
                          <strong>Secure Card Payment:</strong> Click "Create Purchase" below to prepare the secure card payment form.
                          Payment will be processed using Stripe's secure payment system.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600">Complete the card payment to finalize the transaction:</p>
                        <StripePaymentElement
                          clientSecret={clientSecret!}
                          amount={Math.round(parseFloat(amount) * 100)}
                          onSuccess={handleStripePaymentSuccess}
                          onError={handleStripePaymentError}
                          submitButtonText="Complete Card Payment"
                        />
                        <button
                          onClick={() => {
                            setCardPaymentPending(false);
                            setClientSecret(null);
                            setMessage(null);
                          }}
                          className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel Card Payment
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!cardPaymentPending && (
                  <button
                    onClick={handleCreatePurchase}
                    disabled={!amount || loading || !isSubscriptionActive}
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
                    {paymentMethod === 'CARD' ? 'Prepare Card Payment' : 'Create Purchase'}
                  </button>
                )}

                {/* Payment URL Display */}
                {paymentUrl && (
                  <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                    <div className="text-center">
                      <h4 className="font-medium text-gray-900 mb-4 flex items-center justify-center">
                        <QrCode className="w-5 h-5 mr-2" />
                        QR Payment Generated
                      </h4>
                      
                      {/* QR Code Display */}
                      <div className="bg-white p-4 rounded-lg border-2 border-dashed border-gray-300 inline-block mb-4">
                        <QRCode
                          size={200}
                          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                          value={paymentUrl}
                          viewBox={`0 0 200 200`}
                        />
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-4">
                        Customer can scan this QR code with their phone to pay {formatCurrency(parseFloat(amount) || 0)}
                      </p>
                    </div>
                    
                    {/* Payment Link */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Or share this payment link:
                      </label>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 truncate mr-2">{paymentUrl}</span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => copyToClipboard(paymentUrl)}
                            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                            title="Copy Link"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => window.open(paymentUrl, '_blank')}
                            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                            title="Open Link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-700 flex items-center">
                        <Smartphone className="w-4 h-4 mr-1" />
                        Instructions: Ask customer to scan QR code or open the link on their phone to complete payment
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Redeem Cashback */}
            {activeTab === 'redeem' && scannedCard && scannedCard.customer && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Gift className="w-5 h-5 mr-2" />
                  Redeem Cashback
                </h3>
                
                {/* Customer Info */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{scannedCard.customer.firstName} {scannedCard.customer.lastName}</h4>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getTierColor(scannedCard.customer.tier)}`}>
                      {scannedCard.customer.tier} Tier
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Card: {scannedCard.cardUid}</p>
                    <p className="font-semibold text-green-600">Available Balance: {formatCurrency((scannedCard.balanceCents || 0) / 100)}</p>
                  </div>
                </div>

                {/* Redemption Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Redemption Type
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
                        <Banknote className="w-5 h-5 mr-2" />
                        <div>
                          <p className="font-medium">Cash Payout</p>
                          <p className="text-xs text-gray-500">Direct cash payment</p>
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
                        <Gift className="w-5 h-5 mr-2" />
                        <div>
                          <p className="font-medium">Store Credit</p>
                          <p className="text-xs text-gray-500">Credit for future purchases</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Quick Amount Buttons */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Quick Amounts
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 25, 50].map((quickAmount) => (
                      <button
                        key={quickAmount}
                        onClick={() => setAmount(quickAmount.toString())}
                        disabled={(quickAmount * 100) > (scannedCard.balanceCents || 0)}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          (quickAmount * 100) > (scannedCard.balanceCents || 0)
                            ? 'border-gray-200 text-gray-400 cursor-not-allowed'
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
                    Custom Amount ($)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={(scannedCard.balanceCents || 0) / 100}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {amount && parseFloat(amount) > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      <p>Remaining balance after redemption: {formatCurrency(((scannedCard.balanceCents || 0) - (parseFloat(amount) * 100)) / 100)}</p>
                    </div>
                  )}
                </div>

                {/* Process Redemption */}
                <div className="space-y-3">
                  <button
                    onClick={handleRedeemCashback}
                    disabled={!amount || loading || (parseFloat(amount) * 100) > (scannedCard.balanceCents || 0) || !isSubscriptionActive}
                    className={`w-full flex items-center justify-center px-4 py-4 rounded-lg text-white font-semibold transition-colors ${
                      !isSubscriptionActive 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : redemptionType === 'CASH'
                        ? 'bg-green-600 hover:bg-green-700 disabled:opacity-50'
                        : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
                    }`}
                  >
                    {loading ? (
                      <LoadingSpinner size="sm" className="mr-3" />
                    ) : redemptionType === 'CASH' ? (
                      <Banknote className="w-5 h-5 mr-3" />
                    ) : (
                      <Gift className="w-5 h-5 mr-3" />
                    )}
                    {loading 
                      ? 'Processing...' 
                      : `${redemptionType === 'CASH' ? 'Pay Cash' : 'Issue Store Credit'} ${amount ? formatCurrency(parseFloat(amount)) : ''}`
                    }
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center">
                    {redemptionType === 'CASH' 
                      ? '💵 Customer will receive cash payment immediately'
                      : '🎁 Store credit will be added for future use'
                    }
                  </p>
                </div>

                {/* Redemption History Preview */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Redemptions</h4>
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    <p>Last redemption data would show here</p>
                    <p className="text-blue-600 cursor-pointer hover:underline">View full history →</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSTerminal;