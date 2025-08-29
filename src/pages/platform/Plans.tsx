import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, X, Star, Crown, Zap } from 'lucide-react';
import { api } from '../../utils/api';
import { Plan } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';

const PlatformPlans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priceMonthly: 0,
    stripePriceId: '',
    features: [''],
    limits: {
      stores: 0,
      staff: 0,
      cards: 0,
      transactions: 0,
    },
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await api.platform.getPlans();
      setPlans(data.plans);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      setError(error instanceof Error ? error.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const planData = {
        ...formData,
        features: formData.features.filter(f => f.trim() !== ''),
      };
      const { plan } = await api.platform.createPlan(planData);
      setPlans(prev => [...prev, plan]);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create plan:', error);
      alert('Failed to create plan');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      priceMonthly: 0,
      stripePriceId: '',
      features: [''],
      limits: {
        stores: 0,
        staff: 0,
        cards: 0,
        transactions: 0,
      },
    });
  };

  const addFeature = () => {
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, ''],
    }));
  };

  const updateFeature = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.map((f, i) => i === index ? value : f),
    }));
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const getPlanIcon = (planName: string) => {
    const name = planName.toLowerCase();
    if (name.includes('basic') || name.includes('starter')) {
      return <Star className="w-6 h-6 text-blue-600" />;
    } else if (name.includes('pro') || name.includes('professional')) {
      return <Zap className="w-6 h-6 text-green-600" />;
    } else if (name.includes('enterprise') || name.includes('premium')) {
      return <Crown className="w-6 h-6 text-purple-600" />;
    }
    return <Star className="w-6 h-6 text-gray-600" />;
  };

  const getPlanColor = (planName: string) => {
    const name = planName.toLowerCase();
    if (name.includes('basic') || name.includes('starter')) {
      return 'border-blue-200 bg-blue-50';
    } else if (name.includes('pro') || name.includes('professional')) {
      return 'border-green-200 bg-green-50';
    } else if (name.includes('enterprise') || name.includes('premium')) {
      return 'border-purple-200 bg-purple-50';
    }
    return 'border-gray-200 bg-gray-50';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value === -1) return 'Unlimited';
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">⚠️ Error loading plans</div>
        <p className="text-gray-600">{error}</p>
        <button 
          onClick={fetchPlans}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
          <p className="text-gray-600">Manage pricing plans and features for tenants</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Plan
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className={`bg-white rounded-lg border-2 shadow-sm overflow-hidden ${getPlanColor(plan.name)}`}>
            {/* Plan Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getPlanIcon(plan.name)}
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1 text-gray-400 hover:text-blue-600">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(plan.priceMonthly)}
                <span className="text-sm font-normal text-gray-500">/month</span>
              </div>
            </div>

            {/* Features */}
            <div className="p-6 border-b border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Features</h4>
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Limits */}
            <div className="p-6">
              <h4 className="font-medium text-gray-900 mb-3">Limits</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Stores:</span>
                  <span className="font-medium text-gray-900 ml-1">
                    {formatNumber(plan.limits.stores)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Staff:</span>
                  <span className="font-medium text-gray-900 ml-1">
                    {formatNumber(plan.limits.staff)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Cards:</span>
                  <span className="font-medium text-gray-900 ml-1">
                    {formatNumber(plan.limits.cards)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Transactions:</span>
                  <span className="font-medium text-gray-900 ml-1">
                    {formatNumber(plan.limits.transactions)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{plans.length}</div>
            <div className="text-sm text-gray-500">Total Plans</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(plans.reduce((sum, plan) => sum + plan.priceMonthly, 0) / plans.length || 0)}
            </div>
            <div className="text-sm text-gray-500">Average Price</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {plans.filter(plan => plan.priceMonthly > 0).length}
            </div>
            <div className="text-sm text-gray-500">Paid Plans</div>
          </div>
        </div>
      </div>

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Create New Plan</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreatePlan} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plan Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Basic, Pro, Enterprise"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Price ($)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.priceMonthly}
                    onChange={(e) => setFormData(prev => ({ ...prev, priceMonthly: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Brief description of the plan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stripe Price ID
                </label>
                <input
                  type="text"
                  required
                  value={formData.stripePriceId}
                  onChange={(e) => setFormData(prev => ({ ...prev, stripePriceId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="price_xxxxxxxxxxxxx"
                />
              </div>

              {/* Limits */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Limits</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Stores</label>
                    <input
                      type="number"
                      min="-1"
                      value={formData.limits.stores}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        limits: { ...prev.limits, stores: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="-1 for unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Staff</label>
                    <input
                      type="number"
                      min="-1"
                      value={formData.limits.staff}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        limits: { ...prev.limits, staff: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cards</label>
                    <input
                      type="number"
                      min="-1"
                      value={formData.limits.cards}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        limits: { ...prev.limits, cards: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Transactions</label>
                    <input
                      type="number"
                      min="-1"
                      value={formData.limits.transactions}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        limits: { ...prev.limits, transactions: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Use -1 for unlimited</p>
              </div>

              {/* Features */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Features</label>
                  <button
                    type="button"
                    onClick={addFeature}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    + Add Feature
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => updateFeature(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter feature description"
                      />
                      {formData.features.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFeature(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Create Plan
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformPlans;
