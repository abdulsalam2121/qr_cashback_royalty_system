import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, Search, Plus, QrCode, User, Eye, Ban, CheckCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getStatusColor } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { Card } from '../types';

const Cards: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useAuthStore();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [batchCount, setBatchCount] = useState(10);
  const [creatingBatch, setCreatingBatch] = useState(false);
  
  const isSubscriptionActive = tenant?.subscriptionStatus === 'ACTIVE' || 
    tenant?.subscriptionStatus === 'TRIALING' ||
    (tenant?.subscriptionStatus === 'PAST_DUE' && tenant?.graceEndsAt && new Date(tenant.graceEndsAt) > new Date());

  useEffect(() => {
    fetchCards();
  }, [statusFilter]);

  const fetchCards = async () => {
    if (!tenantSlug) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);

      const data = await api.tenant.getCards(tenantSlug, params.toString());
      setCards(data.cards || []);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCards();
  };

  const createCardBatch = async () => {
    if (!tenantSlug) return;
    
    try {
      setCreatingBatch(true);
      const result = await api.tenant.createCardBatch(tenantSlug, batchCount);
      setCards(prev => [...result.cards, ...prev]);
      setShowCreateBatch(false);
      setBatchCount(10);
    } catch (error) {
      console.error('Failed to create card batch:', error);
    } finally {
      setCreatingBatch(false);
    }
  };

  const toggleCardStatus = async (cardUid: string) => {
    if (!tenantSlug) return;
    
    try {
      const card = cards.find(c => c.cardUid === cardUid);
      if (!card) return;

      await api.tenant.blockCard(tenantSlug, cardUid, { reason: 'Admin action' });
      
      // Update local state
      setCards(prev => prev.map(c => 
        c.cardUid === cardUid 
          ? { ...c, status: c.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED' }
          : c
      ));

      if (selectedCard && selectedCard.cardUid === cardUid) {
        setSelectedCard(prev => prev ? { ...prev, status: prev.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED' } : null);
      }
    } catch (error) {
      console.error('Failed to toggle card status:', error);
    }
  };

  const filteredCards = cards.filter(card =>
    card.cardUid.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (card.customer && 
      `${card.customer.firstName} ${card.customer.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CreditCard className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cards Management</h1>
            <p className="text-gray-600">Create, activate, and manage loyalty cards</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateBatch(true)}
          disabled={!isSubscriptionActive}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
            isSubscriptionActive 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-400 text-white cursor-not-allowed'
          }`}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Card Batch
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by card UID or customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </form>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="ACTIVE">Active</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.map((card) => (
          <div key={card.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <span className="font-mono text-sm font-medium">{card.cardUid}</span>
              </div>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(card.status)}`}>
                {card.status}
              </span>
            </div>

            {card.qrUrl && (
              <div className="mb-4 flex justify-center">
                <img src={card.qrUrl} alt={`QR Code for ${card.cardUid}`} className="w-24 h-24" />
              </div>
            )}

            {card.customer ? (
              <div className="mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">
                    {card.customer.firstName} {card.customer.lastName}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Balance: {formatCurrency(card.balanceCents)}
                </p>
                <p className="text-sm text-gray-500">
                  Store: {card.storeName || 'Not assigned'}
                </p>
              </div>
            ) : (
              <div className="mb-4 text-center">
                <p className="text-sm text-gray-500">Unassigned card</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <button
                onClick={() => setSelectedCard(card)}
                className="flex items-center px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Eye className="w-4 h-4 mr-1" />
                View
              </button>
              
              {card.status !== 'UNASSIGNED' && (
                <button
                  onClick={() => toggleCardStatus(card.cardUid)}
                  className={`flex items-center px-3 py-1 text-sm rounded-lg transition-colors ${
                    card.status === 'BLOCKED'
                      ? 'text-green-600 hover:bg-green-50'
                      : 'text-red-600 hover:bg-red-50'
                  }`}
                >
                  {card.status === 'BLOCKED' ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Unblock
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4 mr-1" />
                      Block
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredCards.length === 0 && !loading && (
        <div className="text-center py-12">
          <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm || statusFilter ? 'No cards found matching your criteria' : 'No cards created yet'}
          </p>
        </div>
      )}

      {/* Create Batch Modal */}
      {showCreateBatch && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Create Card Batch</h2>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of cards to create
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum 1000 cards per batch</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowCreateBatch(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createCardBatch}
                disabled={creatingBatch || batchCount < 1}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
              >
                {creatingBatch && <LoadingSpinner size="sm" className="mr-2" />}
                Create {batchCount} Cards
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Card Details</h2>
                <button
                  onClick={() => setSelectedCard(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Card Info */}
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedCard.cardUid}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedCard.status)}`}>
                      {selectedCard.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      Created {formatDate(selectedCard.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code */}
              {selectedCard.qrUrl && (
                <div className="text-center">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">QR Code</h4>
                  <img 
                    src={selectedCard.qrUrl} 
                    alt={`QR Code for ${selectedCard.cardUid}`} 
                    className="mx-auto w-48 h-48 border border-gray-200 rounded-lg"
                  />
                </div>
              )}

              {/* Customer Info */}
              {selectedCard.customer ? (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Customer Information</h4>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <p><span className="font-medium">Name:</span> {selectedCard.customer.firstName} {selectedCard.customer.lastName}</p>
                    {selectedCard.customer.email && (
                      <p><span className="font-medium">Email:</span> {selectedCard.customer.email}</p>
                    )}
                    {selectedCard.customer.phone && (
                      <p><span className="font-medium">Phone:</span> {selectedCard.customer.phone}</p>
                    )}
                    <p><span className="font-medium">Tier:</span> {selectedCard.customer.tier}</p>
                    <p><span className="font-medium">Total Spend:</span> {formatCurrency(selectedCard.customer.totalSpend)}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Customer Information</h4>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-gray-500">This card is not assigned to any customer</p>
                  </div>
                </div>
              )}

              {/* Balance and Store */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Current Balance</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCurrency(selectedCard.balanceCents)}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Store</p>
                  <p className="text-2xl font-bold text-green-900">
                    {selectedCard.storeName || 'Not assigned'}
                  </p>
                </div>
              </div>

              {/* Activation Date */}
              {selectedCard.activatedAt && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Activation</h4>
                  <p className="text-gray-600">
                    Activated on {formatDate(selectedCard.activatedAt)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cards;