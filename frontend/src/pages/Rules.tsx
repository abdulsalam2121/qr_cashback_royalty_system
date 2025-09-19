import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Save, Plus, Edit, Trash2, Calendar, Percent, Gift, Target } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../utils/api';
import { formatPercentage, formatCurrency, formatDate } from '../utils/format';
import { useToast } from '../hooks/useToast';
import { CashbackRule, TierRule, Offer } from '../types';

const Rules: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'cashback' | 'tiers' | 'offers'>('cashback');
  const [cashbackRules, setCashbackRules] = useState<CashbackRule[]>([]);
  const [tierRules, setTierRules] = useState<TierRule[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [offerForm, setOfferForm] = useState({
    name: '',
    description: '',
    rateMultiplierBps: 0,
    startAt: '',
    endAt: '',
    isActive: true
  });

  useEffect(() => {
    fetchData();
  }, [tenantSlug]);

  const fetchData = async () => {
    if (!tenantSlug) return;
    
    try {
      setLoading(true);
      const [cashbackData, tierData, offersData] = await Promise.all([
        api.tenant.getCashbackRules(tenantSlug),
        api.tenant.getTierRules(tenantSlug),
        api.tenant.getOffers(tenantSlug)
      ]);
      
      setCashbackRules(cashbackData.rules || []);
      setTierRules(tierData.rules || []);
      setOffers(offersData.offers || []);
    } catch (error: any) {
      console.error('Failed to fetch rules:', error);
      showToast('Failed to load rules and offers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveCashbackRules = async () => {
    if (!tenantSlug) return;
    
    try {
      setSaving(true);
      const { rules } = await api.tenant.updateCashbackRules(tenantSlug, cashbackRules);
      setCashbackRules(rules);
      showToast('Cashback rules saved successfully', 'success');
    } catch (error: any) {
      console.error('Failed to save cashback rules:', error);
      showToast(
        error.response?.data?.message || 'Failed to save cashback rules. Please try again.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const saveTierRules = async () => {
    if (!tenantSlug) return;
    
    try {
      setSaving(true);
      const { rules } = await api.tenant.updateTierRules(tenantSlug, tierRules);
      setTierRules(rules);
      showToast('Tier rules saved successfully', 'success');
    } catch (error: any) {
      console.error('Failed to save tier rules:', error);
      showToast(
        error.response?.data?.message || 'Failed to save tier rules. Please try again.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const initializeDefaultRules = async () => {
    if (!tenantSlug) return;
    
    try {
      setSaving(true);
      const { cashbackRules: newCashbackRules, tierRules: newTierRules } = await api.tenant.initializeDefaultRules(tenantSlug);
      setCashbackRules(newCashbackRules);
      setTierRules(newTierRules);
      showToast('Default rules initialized successfully', 'success');
    } catch (error: any) {
      console.error('Failed to initialize default rules:', error);
      showToast(
        error.response?.data?.message || 'Failed to initialize default rules. Please try again.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

    const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantSlug) return;
    
    // Convert date strings to ISO datetime strings
    const formData = {
      ...offerForm,
      startAt: new Date(offerForm.startAt).toISOString(),
      endAt: new Date(offerForm.endAt).toISOString(),
    };
    
    try {
      setSaving(true);
      if (editingOffer) {
        const { offer } = await api.tenant.updateOffer(tenantSlug, editingOffer.id, formData);
        setOffers(prev => prev.map(o => o.id === offer.id ? offer : o));
        showToast('Offer updated successfully', 'success');
      } else {
        const { offer } = await api.tenant.createOffer(tenantSlug, formData);
        setOffers(prev => [offer, ...prev]);
        showToast('Offer created successfully', 'success');
      }
      resetOfferForm();
    } catch (error) {
      console.error('Failed to save offer:', error);
      showToast('Failed to save offer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetOfferForm = () => {
    setOfferForm({
      name: '',
      description: '',
      rateMultiplierBps: 0,
      startAt: '',
      endAt: '',
      isActive: true
    });
    setShowOfferModal(false);
    setEditingOffer(null);
  };

  const handleEditOffer = (offer: Offer) => {
    setEditingOffer(offer);
    setOfferForm({
      name: offer.name,
      description: offer.description || '',
      rateMultiplierBps: offer.rateMultiplierBps,
      startAt: new Date(offer.startAt).toISOString().split('T')[0],
      endAt: new Date(offer.endAt).toISOString().split('T')[0],
      isActive: offer.isActive
    });
    setShowOfferModal(true);
  };

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
      <div className="flex items-center space-x-3">
        <Settings className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rules & Settings</h1>
          <p className="text-gray-600">Configure cashback rates, loyalty tiers, and special offers</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('cashback')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'cashback'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Percent className="w-4 h-4" />
                <span>Cashback Rules</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('tiers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'tiers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4" />
                <span>Loyalty Tiers</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('offers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'offers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Gift className="w-4 h-4" />
                <span>Special Offers</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Cashback Rules Tab */}
          {activeTab === 'cashback' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Cashback Rates by Category</h2>
                <button
                  onClick={saveCashbackRules}
                  disabled={saving}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <LoadingSpinner size="sm" className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </button>
              </div>

              <div className="grid gap-4">
                {cashbackRules.length === 0 ? (
                  <div className="text-center py-12">
                    <Percent className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Cashback Rules Found</h3>
                    <p className="text-gray-500 mb-4">
                      Get started by creating default cashback rules for your store.
                    </p>
                    <button
                      onClick={initializeDefaultRules}
                      disabled={saving}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors mx-auto"
                    >
                      {saving ? <LoadingSpinner size="sm" className="mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                      Initialize Default Rules
                    </button>
                  </div>
                ) : (
                  cashbackRules.map((rule, index) => (
                  <div key={rule.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Percent className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 capitalize">{rule.category.toLowerCase()}</h3>
                          <p className="text-sm text-gray-500">Base cashback rate for {rule.category.toLowerCase()} transactions</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={rule.baseRateBps / 100}
                            onChange={(e) => {
                              const newRules = [...cashbackRules];
                              newRules[index].baseRateBps = Math.round(parseFloat(e.target.value) * 100);
                              setCashbackRules(newRules);
                            }}
                            className="w-20 px-3 py-2 text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="text-sm text-gray-500 ml-1">%</span>
                        </div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={rule.isActive}
                            onChange={(e) => {
                              const newRules = [...cashbackRules];
                              newRules[index].isActive = e.target.checked;
                              setCashbackRules(newRules);
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Active</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))
                )}
              </div>
            </div>
          )}

          {/* Tier Rules Tab */}
          {activeTab === 'tiers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Loyalty Tier Configuration</h2>
                <button
                  onClick={saveTierRules}
                  disabled={saving}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <LoadingSpinner size="sm" className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </button>
              </div>

              <div className="grid gap-4">
                {tierRules.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Tier Rules Found</h3>
                    <p className="text-gray-500 mb-4">
                      Get started by creating default loyalty tier rules for your store.
                    </p>
                    <button
                      onClick={initializeDefaultRules}
                      disabled={saving}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors mx-auto"
                    >
                      {saving ? <LoadingSpinner size="sm" className="mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                      Initialize Default Rules
                    </button>
                  </div>
                ) : (
                  tierRules.map((rule, index) => (
                  <div key={rule.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          rule.tier === 'SILVER' ? 'bg-gray-100' :
                          rule.tier === 'GOLD' ? 'bg-yellow-100' : 'bg-purple-100'
                        }`}>
                          <Target className={`w-6 h-6 ${
                            rule.tier === 'SILVER' ? 'text-gray-600' :
                            rule.tier === 'GOLD' ? 'text-yellow-600' : 'text-purple-600'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{rule.name}</h3>
                          <p className="text-sm text-gray-500">
                            Minimum spend: {formatCurrency(rule.minTotalSpendCents)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <label className="block text-xs text-gray-500 mb-1">Min Spend ($)</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={rule.minTotalSpendCents / 100}
                            onChange={(e) => {
                              const newRules = [...tierRules];
                              newRules[index].minTotalSpendCents = Math.round(parseFloat(e.target.value) * 100);
                              setTierRules(newRules);
                            }}
                            className="w-24 px-3 py-2 text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="text-right">
                          <label className="block text-xs text-gray-500 mb-1">Bonus Rate (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={rule.baseRateBps / 100}
                            onChange={(e) => {
                              const newRules = [...tierRules];
                              newRules[index].baseRateBps = Math.round(parseFloat(e.target.value) * 100);
                              setTierRules(newRules);
                            }}
                            className="w-20 px-3 py-2 text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={rule.isActive}
                            onChange={(e) => {
                              const newRules = [...tierRules];
                              newRules[index].isActive = e.target.checked;
                              setTierRules(newRules);
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Active</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))
                )}
              </div>
            </div>
          )}

          {/* Offers Tab */}
          {activeTab === 'offers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Special Offers & Campaigns</h2>
                <button
                  onClick={() => setShowOfferModal(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Offer
                </button>
              </div>

              <div className="grid gap-4">
                {offers.map((offer) => (
                  <div key={offer.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                          <Gift className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{offer.name}</h3>
                          <p className="text-sm text-gray-500">{offer.description}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-gray-500">
                              {formatDate(offer.startAt)} - {formatDate(offer.endAt)}
                            </span>
                            <span className="text-xs font-medium text-green-600">
                              +{formatPercentage(offer.rateMultiplierBps)} bonus
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          offer.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {offer.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => handleEditOffer(offer)}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {offers.length === 0 && (
                <div className="text-center py-12">
                  <Gift className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No special offers created yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingOffer ? 'Edit Offer' : 'Create New Offer'}
              </h2>
            </div>
            
            <form onSubmit={handleOfferSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Offer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={offerForm.name}
                    onChange={(e) => setOfferForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Double Cashback Week"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={offerForm.description}
                    onChange={(e) => setOfferForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Describe the offer..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bonus Rate (%) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={offerForm.rateMultiplierBps / 100}
                    onChange={(e) => setOfferForm(prev => ({ 
                      ...prev, 
                      rateMultiplierBps: Math.round(parseFloat(e.target.value) * 100) 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="5.0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Additional cashback percentage on top of base rates</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={offerForm.startAt}
                      onChange={(e) => setOfferForm(prev => ({ ...prev, startAt: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={offerForm.endAt}
                      onChange={(e) => setOfferForm(prev => ({ ...prev, endAt: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={offerForm.isActive}
                      onChange={(e) => setOfferForm(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={resetOfferForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
                >
                  {saving && <LoadingSpinner size="sm" className="mr-2" />}
                  {editingOffer ? 'Update Offer' : 'Create Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rules;