import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { CreditCard, User, Store, Calendar, DollarSign, Receipt, Shield, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getTierColor, getStatusColor } from '../utils/format';
import { Card } from '../types';

const CardView: React.FC = () => {
  const { tenantSlug, cardUid } = useParams<{ tenantSlug: string; cardUid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('t');
  
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cardUid && tenantSlug) {
      fetchCard();
    }
  }, [cardUid, tenantSlug, token]);

  const fetchCard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const cardData = await api.getPublicCard(tenantSlug!, cardUid!);
      setCard(cardData);
    } catch (err: any) {
      setError(err.message || 'Failed to load card information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading card information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Card Not Available</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="text-sm text-gray-500">
            <p>Please check the QR code or contact the store if you believe this is an error.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-gray-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Card</h1>
          <p className="text-gray-600">This card could not be found in our system.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CreditCard className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Loyalty Card</h1>
          <p className="text-gray-600">View your cashback balance and transaction history</p>
        </div>

        {/* Card Information */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">Card #{card.cardUid}</h2>
                <p className="opacity-90">
                  {card.customer ? `${card.customer.firstName} ${card.customer.lastName}` : 'Unassigned Card'}
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  card.status === 'ACTIVE' 
                    ? 'bg-green-100 text-green-800' 
                    : card.status === 'BLOCKED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {card.status}
                </span>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-sm opacity-90 mb-1">Current Balance</p>
              <p className="text-4xl font-bold">{formatCurrency(card.balanceCents)}</p>
            </div>
          </div>

          {/* Card Details */}
          <div className="p-6 space-y-6">
            {card.customer && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium text-gray-900">
                      {card.customer.firstName} {card.customer.lastName}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Loyalty Tier</p>
                    <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${getTierColor(card.customer.tier)}`}>
                      {card.customer.tier}
                    </span>
                  </div>
                  {card.customer.email && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium text-gray-900">{card.customer.email}</p>
                    </div>
                  )}
                  {card.customer.phone && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium text-gray-900">{card.customer.phone}</p>
                    </div>
                  )}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Spend</p>
                    <p className="font-medium text-gray-900">
                      {formatCurrency(card.customer.totalSpend * 100)}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Member Since</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(card.customer.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {card.storeName && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Store className="w-5 h-5 mr-2" />
                  Store Information
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Assigned Store</p>
                  <p className="font-medium text-gray-900">{card.storeName}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    This card can only be used at this store location
                  </p>
                </div>
              </div>
            )}

            {card.activatedAt && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Card History
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Activated On</p>
                  <p className="font-medium text-gray-900">{formatDate(card.activatedAt)}</p>
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            {card.customer?.transactions && card.customer.transactions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Receipt className="w-5 h-5 mr-2" />
                  Recent Transactions
                </h3>
                <div className="space-y-3">
                  {card.customer.transactions.slice(0, 5).map((transaction) => (
                    <div key={transaction.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              transaction.type === 'EARN' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.type}
                            </span>
                            <span className="text-sm text-gray-600">{transaction.category}</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {formatDate(transaction.createdAt)} • {transaction.store?.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">
                            {formatCurrency(transaction.amountCents)}
                          </p>
                          {transaction.type === 'EARN' && transaction.cashbackCents > 0 && (
                            <p className="text-sm text-green-600">
                              +{formatCurrency(transaction.cashbackCents)} cashback
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Security Notice</h4>
              <p className="text-sm text-blue-700 mt-1">
                This card information is secure and can only be accessed with a valid QR code or by logging into your account.
                If you believe there's unauthorized access to your card, please contact the store immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        {card.status === 'ACTIVE' && (
          <div className="text-center mt-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Earn More?</h3>
              <p className="text-gray-600 mb-4">
                Visit our store to make purchases and earn cashback on every transaction!
              </p>
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center">
                  <DollarSign className="w-4 h-4 mr-1" />
                  <span>Earn cashback</span>
                </div>
                <div className="flex items-center">
                  <Receipt className="w-4 h-4 mr-1" />
                  <span>Track spending</span>
                </div>
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  <span>Tier upgrades</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardView;