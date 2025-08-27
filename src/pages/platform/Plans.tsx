import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Edit, Users, Building2, Check, X } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { mockApi } from '../../utils/mockApi';
import { formatCurrency } from '../../utils/format';
import { Plan } from '../../types';

const PlatformPlans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load mock plans data
    try {
      const mockPlans = mockApi.getPlatformPlans();
      setPlans(mockPlans);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
          <p className="text-gray-600">Manage pricing plans and features for tenants</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Plan
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Plan Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                <button className="text-gray-400 hover:text-gray-600">
                  <Edit className="w-4 h-4" />
                </button>
              </div>
              <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
              <div className="flex items-baseline">
                <span className="text-3xl font-bold text-gray-900">
                  {formatCurrency(plan.priceMonthly)}
                </span>
                <span className="text-gray-600 ml-1">/month</span>
              </div>
            </div>

            {/* Features */}
            <div className="p-6">
              <h4 className="font-medium text-gray-900 mb-3">Features:</h4>
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Limits */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <h4 className="font-medium text-gray-900 mb-3">Limits:</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center">
                  <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">
                    {plan.limits.stores === -1 ? 'Unlimited' : plan.limits.stores} stores
                  </span>
                </div>
                <div className="flex items-center">
                  <Users className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">
                    {plan.limits.staff === -1 ? 'Unlimited' : plan.limits.staff} staff
                  </span>
                </div>
                <div className="flex items-center">
                  <CreditCard className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">
                    {plan.limits.cards === -1 ? 'Unlimited' : plan.limits.cards} cards
                  </span>
                </div>
                <div className="flex items-center">
                  <X className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">
                    {plan.limits.transactions === -1 ? 'Unlimited' : `${plan.limits.transactions}`} txns/mo
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-200">
              <div className="flex gap-2">
                <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded text-sm hover:bg-blue-700">
                  Edit Plan
                </button>
                <button className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
                  View Details
                </button>
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
            <div className="text-2xl font-bold text-blue-600">67%</div>
            <div className="text-gray-600">Basic Plan Users</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">28%</div>
            <div className="text-gray-600">Pro Plan Users</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">5%</div>
            <div className="text-gray-600">Enterprise Users</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformPlans;
