import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, Search, Plus, QrCode, User, Eye, Ban, CheckCircle, UserPlus, Store, Users } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getStatusColor } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../hooks/useToast';
import { Card, Customer, Store as StoreType } from '../types';

const Cards: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useAuthStore();
  const { showToast } = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStoreAssignModal, setShowStoreAssignModal] = useState(false);
  const [cardToAssign, setCardToAssign] = useState<Card | null>(null);
  const [cardToReassign, setCardToReassign] = useState<Card | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [batchCount, setBatchCount] = useState(10);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [assigningCard, setAssigningCard] = useState(false);
  const [assignmentData, setAssignmentData] = useState({
    customerId: '',
    storeId: '',
    newCustomer: {
      firstName: '',
      lastName: '',
      email: '',
      phone: ''
    }
  });
  const [createNewCustomer, setCreateNewCustomer] = useState(false);
  
  const isSubscriptionActive = tenant?.subscriptionStatus === 'ACTIVE' || 
    tenant?.subscriptionStatus === 'TRIALING' ||
    (tenant?.subscriptionStatus === 'PAST_DUE' && tenant?.graceEndsAt && new Date(tenant.graceEndsAt) > new Date());

  // Check if trial limit has been reached
  // Use actual card count instead of cached activation count for real-time accuracy
  const currentCardCount = tenant?._count?.cards || 0;
  const trialLimit = tenant?.freeTrialLimit || 40;
  const remainingCards = Math.max(0, trialLimit - currentCardCount);
  const isTrialLimitReached = tenant?.freeTrialLimit !== undefined && 
    currentCardCount >= tenant.freeTrialLimit &&
    tenant.subscriptionStatus !== 'ACTIVE';

  const canCreateCards = isSubscriptionActive && !isTrialLimitReached;

  useEffect(() => {
    fetchCards();
    fetchTenantInfo();
    fetchCustomers();
    fetchStores();
  }, [statusFilter]);

  useEffect(() => {
    console.log('Stores data:', stores);
    console.log('Stores length:', stores.length);
  }, [stores]);

  const fetchTenantInfo = async () => {
    if (!tenantSlug) return;
    
    try {
      const { tenant: latestTenant } = await api.tenant.getTenant(tenantSlug);
      // Update the tenant data in the auth store to ensure we have latest trial info
      useAuthStore.getState().updateTenant(latestTenant);
    } catch (error) {
      console.error('Failed to fetch tenant info:', error);
    }
  };

  const fetchCards = async () => {
    if (!tenantSlug) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);

      const data = await api.tenant.getCards(tenantSlug, params.toString());
      console.log('Cards data from API:', data.cards);
      setCards(data.cards || []);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    if (!tenantSlug) return;
    
    try {
      const data = await api.tenant.getCustomers(tenantSlug);
      setCustomers(data.customers || []);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const fetchStores = async () => {
    if (!tenantSlug) return;
    
    try {
      const data = await api.tenant.getStores(tenantSlug);
      setStores(data.stores || []);
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCards();
  };

  const createCardBatch = async () => {
    if (!tenantSlug) return;
    
    // Validate batch count doesn't exceed remaining limit
    if (tenant?.subscriptionStatus !== 'ACTIVE' && remainingCards < batchCount) {
      showToast(
        `You can only create ${remainingCards} more cards. You currently have ${currentCardCount}/${trialLimit} cards in your trial.`,
        'warning'
      );
      return;
    }
    
    try {
      setCreatingBatch(true);
      const result = await api.tenant.createCardBatch(tenantSlug, batchCount);
      setCards(prev => [...result.cards, ...prev]);
      setShowCreateBatch(false);
      setBatchCount(10);
      
      // Refresh tenant info to get updated card count
      await fetchTenantInfo();
      
      showToast(`Successfully created ${result.cards.length} cards`, 'success');
    } catch (error: any) {
      console.error('Failed to create card batch:', error);
      
      // Handle trial limit error specifically
      if (error.response?.status === 403 && error.response?.data?.error === 'Subscription required') {
        showToast(error.response.data.message, 'error');
      } else {
        showToast('Failed to create card batch. Please try again.', 'error');
      }
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

      showToast(`Card ${card.status === 'BLOCKED' ? 'unblocked' : 'blocked'} successfully`, 'success');
    } catch (error) {
      console.error('Failed to toggle card status:', error);
      showToast('Failed to update card status', 'error');
    }
  };

  const handleAssignCard = (card: Card) => {
    setCardToAssign(card);
    setAssignmentData({
      customerId: '',
      storeId: stores.length > 0 ? stores[0].id : '',
      newCustomer: {
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
      }
    });
    setCreateNewCustomer(false);
    setShowAssignModal(true);
  };

  const handleCardAssignment = async () => {
    if (!tenantSlug || !cardToAssign) return;

    try {
      setAssigningCard(true);
      
      let response;
      if (createNewCustomer) {
        response = await api.tenant.activateCard(
          tenantSlug, 
          cardToAssign.cardUid, 
          assignmentData.newCustomer,
          assignmentData.storeId
        );
      } else {
        response = await api.tenant.activateCard(
          tenantSlug, 
          cardToAssign.cardUid, 
          null,
          assignmentData.storeId,
          assignmentData.customerId
        );
      }
      
      // Update local state
      setCards(prev => prev.map(c => 
        c.cardUid === cardToAssign.cardUid ? response.card : c
      ));

      if (createNewCustomer) {
        // Refresh customers list to include the new customer
        fetchCustomers();
      }

      setShowAssignModal(false);
      setCardToAssign(null);
      showToast('Card assigned successfully', 'success');
    } catch (error: any) {
      console.error('Failed to assign card:', error);
      showToast(error.response?.data?.message || 'Failed to assign card', 'error');
    } finally {
      setAssigningCard(false);
    }
  };

  const handleStoreAssignment = (card: Card) => {
    setCardToReassign(card);
    setSelectedStoreId(card.storeId || '');
    setShowStoreAssignModal(true);
  };

  const handleStoreReassignment = async () => {
    if (!tenantSlug || !cardToReassign || !selectedStoreId) return;

    try {
      setAssigningCard(true);
      
      const response = await api.tenant.updateCardStore(tenantSlug, cardToReassign.cardUid, selectedStoreId);
      
      // Update local state
      setCards(prev => prev.map(c => 
        c.cardUid === cardToReassign.cardUid ? response.card : c
      ));

      // Update selectedCard if it's the one being updated
      if (selectedCard && selectedCard.cardUid === cardToReassign.cardUid) {
        setSelectedCard(response.card);
      }

      setShowStoreAssignModal(false);
      setCardToReassign(null);
      setSelectedStoreId('');
      showToast('Card store assignment updated successfully', 'success');
    } catch (error: any) {
      console.error('Failed to update card store:', error);
      showToast(error.response?.data?.message || 'Failed to update card store assignment', 'error');
    } finally {
      setAssigningCard(false);
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
      {/* Trial Status Banner */}
      {tenant?.freeTrialLimit !== undefined && 
       tenant.subscriptionStatus !== 'ACTIVE' && (
        <div className={`rounded-xl p-4 border ${
          isTrialLimitReached 
            ? 'bg-red-50 border-red-200 text-red-800' 
            : currentCardCount >= tenant.freeTrialLimit * 0.8 
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CreditCard className="w-5 h-5" />
              <div>
                {isTrialLimitReached ? (
                  <p className="font-medium">Trial Limit Reached</p>
                ) : (
                  <p className="font-medium">
                    Trial Status: {currentCardCount}/{trialLimit} cards created
                  </p>
                )}
                <p className="text-sm">
                  {isTrialLimitReached 
                    ? 'You\'ve reached your free trial limit. Upgrade to a paid plan to continue creating cards.'
                    : `${remainingCards} cards remaining in your free trial.`
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                {currentCardCount}/{trialLimit}
              </div>
              <div className="text-sm opacity-75">
                Cards Used
              </div>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  isTrialLimitReached 
                    ? 'bg-red-500' 
                    : currentCardCount >= tenant.freeTrialLimit * 0.8 
                      ? 'bg-yellow-500'
                      : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, (currentCardCount / trialLimit) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CreditCard className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cards Management</h1>
            <p className="text-gray-600">Create, activate, and manage loyalty cards</p>
          </div>
        </div>
        <div className="flex flex-col items-end space-y-2">
          <button
            onClick={() => setShowCreateBatch(true)}
            disabled={!canCreateCards}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              canCreateCards 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-400 text-white cursor-not-allowed'
            }`}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Card Batch
          </button>
          {isTrialLimitReached && (
            <p className="text-sm text-red-600 text-right max-w-xs">
              Trial limit reached ({currentCardCount}/{trialLimit} cards). 
              <br />
              Upgrade to continue creating cards.
            </p>
          )}
          {!isTrialLimitReached && tenant?.subscriptionStatus !== 'ACTIVE' && (
            <p className="text-sm text-blue-600 text-right max-w-xs">
              {remainingCards} cards remaining in trial
            </p>
          )}
        </div>
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
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedCard(card)}
                  className="flex items-center px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </button>
                
                {card.status === 'UNASSIGNED' && (
                  <button
                    onClick={() => handleAssignCard(card)}
                    className="flex items-center px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Assign
                  </button>
                )}

                {card.status !== 'UNASSIGNED' && stores.length > 1 && (
                  <button
                    onClick={() => handleStoreAssignment(card)}
                    className="flex items-center px-3 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <Store className="w-4 h-4 mr-1" />
                    Assign Store
                  </button>
                )}
              </div>
              
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
              {tenant?.subscriptionStatus !== 'ACTIVE' && (
                <p className="text-sm text-gray-600 mt-1">
                  Cards remaining in trial: {remainingCards}
                </p>
              )}
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of cards to create
                </label>
                <input
                  type="number"
                  min="1"
                  max={tenant?.subscriptionStatus === 'ACTIVE' ? 1000 : remainingCards}
                  value={batchCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    const maxAllowed = tenant?.subscriptionStatus === 'ACTIVE' ? 1000 : remainingCards;
                    setBatchCount(Math.min(value, maxAllowed));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500">
                    {tenant?.subscriptionStatus === 'ACTIVE' 
                      ? 'Maximum 1000 cards per batch' 
                      : `Maximum ${remainingCards} cards available in trial`
                    }
                  </p>
                  {tenant?.subscriptionStatus !== 'ACTIVE' && batchCount > remainingCards && (
                    <p className="text-xs text-red-500">
                      Exceeds trial limit!
                    </p>
                  )}
                </div>
              </div>
              
              {/* Trial Warning */}
              {tenant?.subscriptionStatus !== 'ACTIVE' && batchCount > remainingCards && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    You can only create {remainingCards} more cards in your trial. 
                    The batch count has been adjusted automatically.
                  </p>
                </div>
              )}
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
                disabled={creatingBatch || batchCount < 1 || batchCount > remainingCards && tenant?.subscriptionStatus !== 'ACTIVE'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
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
                  <p className="text-sm text-green-600 font-medium">Assigned Store</p>
                  <p className="text-lg font-bold text-green-900">
                    {selectedCard.storeName || 'Not assigned'}
                  </p>
                  {stores.length > 1 && (
                    <p className="text-xs text-green-600 mt-1">
                      {stores.length - 1} other store{stores.length > 2 ? 's' : ''} available
                    </p>
                  )}
                </div>
              </div>

              {/* Store Management for Assigned Cards */}
              {selectedCard.status !== 'UNASSIGNED' && stores.length > 1 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Store Management</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">
                      This card is currently assigned to: <strong>{selectedCard.storeName}</strong>
                    </p>
                    <p className="text-xs text-gray-500">
                      You have {stores.length} stores total. Card reassignment can be done through the admin panel or by contacting support.
                    </p>
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-600">Available stores:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {stores.map(store => (
                          <span 
                            key={store.id}
                            className={`px-2 py-1 text-xs rounded-full ${
                              store.name === selectedCard.storeName 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {store.name}
                            {store.name === selectedCard.storeName && ' (current)'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Unassigned Card Actions */}
              {selectedCard.status === 'UNASSIGNED' && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Card Assignment</h4>
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800 mb-3">
                      This card is not yet assigned to any customer or store.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedCard(null);
                        handleAssignCard(selectedCard);
                      }}
                      className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Assign Card Now
                    </button>
                  </div>
                </div>
              )}

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

      {/* Assign Card Modal */}
      {showAssignModal && cardToAssign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Assign Card</h3>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setCardToAssign(null);
                  setCreateNewCustomer(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Card: <span className="font-mono font-medium">{cardToAssign.cardUid}</span>
              </p>
            </div>

            <div className="space-y-4">
              {/* Store Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Store className="w-4 h-4 inline mr-1" />
                  Assign to Store *
                </label>
                <select
                  value={assignmentData.storeId}
                  onChange={(e) => setAssignmentData(prev => ({ ...prev, storeId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {stores.length === 0 ? (
                    <option value="">No stores available</option>
                  ) : (
                    stores.map(store => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Customer Selection Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Customer Assignment
                </label>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      id="existing-customer"
                      name="customer-type"
                      type="radio"
                      checked={!createNewCustomer}
                      onChange={() => setCreateNewCustomer(false)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <label htmlFor="existing-customer" className="ml-2 text-sm text-gray-700">
                      Assign to existing customer
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="new-customer"
                      name="customer-type"
                      type="radio"
                      checked={createNewCustomer}
                      onChange={() => setCreateNewCustomer(true)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <label htmlFor="new-customer" className="ml-2 text-sm text-gray-700">
                      Create new customer
                    </label>
                  </div>
                </div>
              </div>

              {/* Existing Customer Selection */}
              {!createNewCustomer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Customer *
                  </label>
                  <select
                    value={assignmentData.customerId}
                    onChange={(e) => setAssignmentData(prev => ({ ...prev, customerId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required={!createNewCustomer}
                  >
                    <option value="">Select a customer...</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.firstName} {customer.lastName} 
                        {customer.email && ` (${customer.email})`}
                      </option>
                    ))}
                  </select>
                  {customers.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      No customers available. Create a new customer instead.
                    </p>
                  )}
                </div>
              )}

              {/* New Customer Form */}
              {createNewCustomer && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={assignmentData.newCustomer.firstName}
                        onChange={(e) => setAssignmentData(prev => ({ 
                          ...prev, 
                          newCustomer: { ...prev.newCustomer, firstName: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="John"
                        required={createNewCustomer}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        value={assignmentData.newCustomer.lastName}
                        onChange={(e) => setAssignmentData(prev => ({ 
                          ...prev, 
                          newCustomer: { ...prev.newCustomer, lastName: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Doe"
                        required={createNewCustomer}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={assignmentData.newCustomer.email}
                      onChange={(e) => setAssignmentData(prev => ({ 
                        ...prev, 
                        newCustomer: { ...prev.newCustomer, email: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={assignmentData.newCustomer.phone}
                      onChange={(e) => setAssignmentData(prev => ({ 
                        ...prev, 
                        newCustomer: { ...prev.newCustomer, phone: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setCardToAssign(null);
                    setCreateNewCustomer(false);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCardAssignment}
                  disabled={
                    assigningCard || 
                    !assignmentData.storeId || 
                    (!createNewCustomer && !assignmentData.customerId) ||
                    (createNewCustomer && (!assignmentData.newCustomer.firstName || !assignmentData.newCustomer.lastName))
                  }
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {assigningCard ? 'Assigning...' : 'Assign Card'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Store Assignment Modal */}
      {showStoreAssignModal && cardToReassign && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Assign Store to Card</h2>
              <p className="text-sm text-gray-600 mt-1">
                Card ID: {cardToReassign.cardUid}
              </p>
              {cardToReassign.customer && (
                <p className="text-sm text-gray-600">
                  Customer: {cardToReassign.customer.firstName} {cardToReassign.customer.lastName}
                </p>
              )}
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Store *
                </label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a store...</option>
                  {stores.map(store => (
                    <option key={store.id} value={store.id}>
                      {store.name} - {store.address}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Current Store:</strong> {cardToReassign.storeName || 'None assigned'}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  This will update which store this card is associated with. Transactions and points will remain with the customer.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowStoreAssignModal(false);
                    setCardToReassign(null);
                    setSelectedStoreId('');
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStoreReassignment}
                  disabled={!selectedStoreId || assigningCard}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {assigningCard ? 'Updating...' : 'Update Store'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cards;