import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, X, Star, Crown, Zap } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { api } from '../../utils/api';
import { Plan } from '../../types';

const Plans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [newPlan, setNewPlan] = useState({
    name: '',
    description: '',
    priceMonthly: '',
    stripePriceId: '',
    features: [''],
    limits: {
      stores: '',
      staff: '',
      cards: '',
      transactions: ''
    }
  });

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const data = await api.platform.getPlans();
        setPlans(data.plans || []);
      } catch (error) {
        console.error('Failed to load plans:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const handleCreatePlan = async () => {
    try {
      const planData = {
        name: newPlan.name,
        description: newPlan.description,
        priceMonthly: parseInt(newPlan.priceMonthly) || 0,
        stripePriceId: newPlan.stripePriceId,
        features: newPlan.features.filter(f => f.trim() !== ''),
        limits: {
          stores: parseInt(newPlan.limits.stores) || -1,
          staff: parseInt(newPlan.limits.staff) || -1,
          cards: parseInt(newPlan.limits.cards) || -1,
          transactions: parseInt(newPlan.limits.transactions) || -1
        }
      };
      
      const response = await api.platform.createPlan(planData);
      setPlans(prev => [...prev, response.plan]);
      setNewPlan({
        name: '',
        description: '',
        priceMonthly: '',
        stripePriceId: '',
        features: [''],
        limits: {
          stores: '',
          staff: '',
          cards: '',
          transactions: ''
        }
      });
    } catch (error) {
      console.error('Failed to create plan:', error);
    }
  };

  const handleUpdatePlan = async (plan: Plan) => {
    try {
      // Update via API when backend supports it
      setPlans(prev => prev.map(p => p.id === plan.id ? plan : p));
      setEditingPlan(null);
    } catch (error) {
      console.error('Failed to update plan:', error);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (window.confirm('Are you sure you want to delete this plan?')) {
      try {
        // Delete via API when backend supports it
        setPlans(prev => prev.filter(p => p.id !== planId));
      } catch (error) {
        console.error('Failed to delete plan:', error);
      }
    }
  };

  const addFeature = () => {
    setNewPlan(prev => ({
      ...prev,
      features: [...prev.features, '']
    }));
  };

  const updateFeature = (index: number, value: string) => {
    setNewPlan(prev => ({
      ...prev,
      features: prev.features.map((f, i) => i === index ? value : f)
    }));
  };

  const removeFeature = (index: number) => {
    setNewPlan(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const getPlanIcon = (planName: string) => {
    const name = planName.toLowerCase();
    if (name.includes('basic') || name.includes('starter')) return Star;
    if (name.includes('pro') || name.includes('premium')) return Crown;
    if (name.includes('enterprise') || name.includes('ultimate')) return Zap;
    return Star;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
      </div>

      {/* Create New Plan */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            placeholder="Plan Name"
            value={newPlan.name}
            onChange={(e) => setNewPlan(prev => ({ ...prev, name: e.target.value }))}
            className="border border-gray-300 rounded-md px-3 py-2"
          />
          <input
            type="number"
            placeholder="Price Monthly (cents)"
            value={newPlan.priceMonthly}
            onChange={(e) => setNewPlan(prev => ({ ...prev, priceMonthly: e.target.value }))}
            className="border border-gray-300 rounded-md px-3 py-2"
          />
          <input
            type="text"
            placeholder="Stripe Price ID"
            value={newPlan.stripePriceId}
            onChange={(e) => setNewPlan(prev => ({ ...prev, stripePriceId: e.target.value }))}
            className="border border-gray-300 rounded-md px-3 py-2"
          />
          <textarea
            placeholder="Description"
            value={newPlan.description}
            onChange={(e) => setNewPlan(prev => ({ ...prev, description: e.target.value }))}
            className="border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <input
            type="number"
            placeholder="Max Stores (-1 for unlimited)"
            value={newPlan.limits.stores}
            onChange={(e) => setNewPlan(prev => ({ 
              ...prev, 
              limits: { ...prev.limits, stores: e.target.value }
            }))}
            className="border border-gray-300 rounded-md px-3 py-2"
          />
          <input
            type="number"
            placeholder="Max Staff (-1 for unlimited)"
            value={newPlan.limits.staff}
            onChange={(e) => setNewPlan(prev => ({ 
              ...prev, 
              limits: { ...prev.limits, staff: e.target.value }
            }))}
            className="border border-gray-300 rounded-md px-3 py-2"
          />
          <input
            type="number"
            placeholder="Max Cards (-1 for unlimited)"
            value={newPlan.limits.cards}
            onChange={(e) => setNewPlan(prev => ({ 
              ...prev, 
              limits: { ...prev.limits, cards: e.target.value }
            }))}
            className="border border-gray-300 rounded-md px-3 py-2"
          />
          <input
            type="number"
            placeholder="Max Transactions (-1 for unlimited)"
            value={newPlan.limits.transactions}
            onChange={(e) => setNewPlan(prev => ({ 
              ...prev, 
              limits: { ...prev.limits, transactions: e.target.value }
            }))}
            className="border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
        
        {/* Features */}
        <div className="mb-4">`
          <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
          {newPlan.features.map((feature, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Feature description"
                value={feature}
                onChange={(e) => updateFeature(index, e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
              />
              <button
                onClick={() => removeFeature(index)}
                className="px-3 py-2 text-red-600 hover:text-red-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addFeature}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            + Add Feature
          </button>
        </div>

        <button
          onClick={handleCreatePlan}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </button>
      </div>

      {/* Plans List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const IconComponent = getPlanIcon(plan.name);
          
          return (
            <div key={plan.id} className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <IconComponent className="h-6 w-6 text-blue-500 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">{plan.name}</h3>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingPlan(plan)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-gray-600 mb-4">{plan.description}</p>
              
              <div className="text-2xl font-bold text-gray-900 mb-4">
                ${(plan.priceMonthly / 100).toFixed(2)}/month
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="text-sm text-gray-600">
                  Stores: {plan.limits.stores === -1 ? 'Unlimited' : plan.limits.stores}
                </div>
                <div className="text-sm text-gray-600">
                  Staff: {plan.limits.staff === -1 ? 'Unlimited' : plan.limits.staff}
                </div>
                <div className="text-sm text-gray-600">
                  Cards: {plan.limits.cards === -1 ? 'Unlimited' : plan.limits.cards}
                </div>
                <div className="text-sm text-gray-600">
                  Transactions: {plan.limits.transactions === -1 ? 'Unlimited' : plan.limits.transactions}
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Features:</h4>
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center text-sm text-gray-600">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Plan</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Plan Name"
                value={editingPlan.name}
                onChange={(e) => setEditingPlan(prev => prev ? { ...prev, name: e.target.value } : null)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <input
                type="number"
                placeholder="Price Monthly (cents)"
                value={editingPlan.priceMonthly}
                onChange={(e) => setEditingPlan(prev => prev ? { ...prev, priceMonthly: parseInt(e.target.value) } : null)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <textarea
                placeholder="Description"
                value={editingPlan.description}
                onChange={(e) => setEditingPlan(prev => prev ? { ...prev, description: e.target.value } : null)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingPlan(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => editingPlan && handleUpdatePlan(editingPlan)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Plans;
