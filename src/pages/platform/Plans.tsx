import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Check, X, Star, Crown, Zap } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PlanFormComponent from '../../components/PlanForm';
import { useToast } from '../../hooks/useToast';
import { api } from '../../utils/api';
import { Plan } from '../../types';

interface PlanForm {
  name: string;
  description: string;
  priceMonthly: string;
  billingPeriod: 'monthly' | '3months' | '6months' | 'yearly';
  stripePriceId: string;
  features: string[];
  limits: {
    stores: string;
    staff: string;
    cards: string;
    transactions: string;
  };
}

const Plans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const [newPlan, setNewPlan] = useState<PlanForm>({
    name: '',
    description: '',
    priceMonthly: '',
    billingPeriod: 'monthly',
    stripePriceId: '',
    features: [''],
    limits: {
      stores: '',
      staff: '',
      cards: '',
      transactions: ''
    }
  });

  const [editForm, setEditForm] = useState<PlanForm>({
    name: '',
    description: '',
    priceMonthly: '',
    billingPeriod: 'monthly',
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
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await api.platform.getPlans();
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Failed to load plans:', error);
      showToast('Failed to load plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetNewPlanForm = () => {
    setNewPlan({
      name: '',
      description: '',
      priceMonthly: '',
      billingPeriod: 'monthly',
      stripePriceId: '',
      features: [''],
      limits: {
        stores: '',
        staff: '',
        cards: '',
        transactions: ''
      }
    });
  };

  const handleCreatePlan = async () => {
    try {
      setSubmitting(true);
      const planData = {
        name: newPlan.name,
        description: newPlan.description,
        priceMonthly: parseInt(newPlan.priceMonthly) || 0,
        billingPeriod: newPlan.billingPeriod,
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
      setShowCreateModal(false);
      resetNewPlanForm();
      showToast('Plan created successfully!', 'success');
    } catch (error) {
      console.error('Failed to create plan:', error);
      showToast('Failed to create plan. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (plan: Plan) => {
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      description: plan.description,
      priceMonthly: plan.priceMonthly.toString(),
      billingPeriod: plan.billingPeriod,
      stripePriceId: plan.stripePriceId,
      features: [...plan.features],
      limits: {
        stores: plan.limits.stores.toString(),
        staff: plan.limits.staff.toString(),
        cards: plan.limits.cards.toString(),
        transactions: plan.limits.transactions.toString()
      }
    });
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;
    
    try {
      setSubmitting(true);
      const planData = {
        name: editForm.name,
        description: editForm.description,
        priceMonthly: parseInt(editForm.priceMonthly) || 0,
        billingPeriod: editForm.billingPeriod,
        stripePriceId: editForm.stripePriceId,
        features: editForm.features.filter(f => f.trim() !== ''),
        limits: {
          stores: parseInt(editForm.limits.stores) || -1,
          staff: parseInt(editForm.limits.staff) || -1,
          cards: parseInt(editForm.limits.cards) || -1,
          transactions: parseInt(editForm.limits.transactions) || -1
        }
      };

      const response = await api.platform.updatePlan(editingPlan.id, planData);
      setPlans(prev => prev.map(p => p.id === editingPlan.id ? response.plan : p));
      setEditingPlan(null);
      showToast('Plan updated successfully!', 'success');
    } catch (error) {
      console.error('Failed to update plan:', error);
      showToast('Failed to update plan. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlan = async (plan: Plan) => {
    if (!confirm(`Are you sure you want to delete the "${plan.name}" plan? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.platform.deletePlan(plan.id);
      setPlans(prev => prev.filter(p => p.id !== plan.id));
      showToast('Plan deleted successfully!', 'success');
    } catch (error) {
      console.error('Failed to delete plan:', error);
      showToast('Failed to delete plan. Please try again.', 'error');
    }
  };

  const addFeature = useCallback((isEdit = false) => {
    if (isEdit) {
      setEditForm(prev => ({
        ...prev,
        features: [...prev.features, '']
      }));
    } else {
      setNewPlan(prev => ({
        ...prev,
        features: [...prev.features, '']
      }));
    }
  }, []);

  const updateFeature = useCallback((index: number, value: string, isEdit = false) => {
    if (isEdit) {
      setEditForm(prev => ({
        ...prev,
        features: prev.features.map((f, i) => i === index ? value : f)
      }));
    } else {
      setNewPlan(prev => ({
        ...prev,
        features: prev.features.map((f, i) => i === index ? value : f)
      }));
    }
  }, []);

  const removeFeature = useCallback((index: number, isEdit = false) => {
    if (isEdit) {
      setEditForm(prev => ({
        ...prev,
        features: prev.features.filter((_, i) => i !== index)
      }));
    } else {
      setNewPlan(prev => ({
        ...prev,
        features: prev.features.filter((_, i) => i !== index)
      }));
    }
  }, []);

  // Create plan form handlers
  const handleAddFeatureCreate = useCallback(() => addFeature(false), [addFeature]);
  const handleUpdateFeatureCreate = useCallback((index: number, value: string) => updateFeature(index, value, false), [updateFeature]);
  const handleRemoveFeatureCreate = useCallback((index: number) => removeFeature(index, false), [removeFeature]);

  // Edit plan form handlers
  const handleAddFeatureEdit = useCallback(() => addFeature(true), [addFeature]);
  const handleUpdateFeatureEdit = useCallback((index: number, value: string) => updateFeature(index, value, true), [updateFeature]);
  const handleRemoveFeatureEdit = useCallback((index: number) => removeFeature(index, true), [removeFeature]);

  const getPlanIcon = (planName: string) => {
    const name = planName.toLowerCase();
    if (name.includes('basic') || name.includes('starter')) return Star;
    if (name.includes('pro') || name.includes('premium')) return Crown;
    if (name.includes('enterprise') || name.includes('ultimate')) return Zap;
    return Star;
  };

  const getBillingPeriodDisplay = (period: string) => {
    switch (period) {
      case 'monthly': return '/month';
      case '3months': return '/3 months';
      case '6months': return '/6 months';
      case 'yearly': return '/year';
      default: return '/month';
    }
  };

  const getTotalPrice = (monthlyPrice: number, period: string) => {
    const multiplierMap: Record<string, number> = {
      'monthly': 1,
      '3months': 3,
      '6months': 6,
      'yearly': 12
    };
    
    const multiplier = multiplierMap[period] || 1;
    return monthlyPrice * multiplier;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Plan
        </button>
      </div>

      {/* Plans List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const IconComponent = getPlanIcon(plan.name);
          const totalPrice = getTotalPrice(plan.priceMonthly, plan.billingPeriod);
          
          return (
            <div key={plan.id} className="bg-white shadow rounded-lg p-6 border border-gray-200 hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <IconComponent className="h-6 w-6 text-blue-500 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">{plan.name}</h3>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditClick(plan)}
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                    title="Edit Plan"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                    title="Delete Plan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-gray-600 mb-4">{plan.description}</p>
              
              <div className="text-2xl font-bold text-gray-900 mb-1">
                ${(totalPrice / 100).toFixed(2)}{getBillingPeriodDisplay(plan.billingPeriod)}
              </div>
              {plan.billingPeriod !== 'monthly' && (
                <div className="text-sm text-gray-500 mb-4">
                  ${(plan.priceMonthly / 100).toFixed(2)}/month
                </div>
              )}
              
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
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12">
          <Star className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No plans found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new subscription plan.</p>
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Create New Plan</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetNewPlanForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <PlanFormComponent 
              form={newPlan} 
              setForm={setNewPlan}
              onAddFeature={handleAddFeatureCreate}
              onUpdateFeature={handleUpdateFeatureCreate}
              onRemoveFeature={handleRemoveFeatureCreate}
            />
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetNewPlanForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlan}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center transition-colors disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Plan: {editingPlan.name}</h3>
              <button
                onClick={() => setEditingPlan(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <PlanFormComponent 
              form={editForm} 
              setForm={setEditForm}
              isEdit={true}
              onAddFeature={handleAddFeatureEdit}
              onUpdateFeature={handleUpdateFeatureEdit}
              onRemoveFeature={handleRemoveFeatureEdit}
            />
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingPlan(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePlan}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center transition-colors disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Update Plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Plans;
