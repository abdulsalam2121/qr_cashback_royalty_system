import React from 'react';
import { X } from 'lucide-react';

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

interface PlanFormComponentProps {
  form: PlanForm;
  setForm: React.Dispatch<React.SetStateAction<PlanForm>>;
  isEdit?: boolean;
  onAddFeature: () => void;
  onUpdateFeature: (index: number, value: string) => void;
  onRemoveFeature: (index: number) => void;
}

const PlanFormComponent: React.FC<PlanFormComponentProps> = ({
  form,
  setForm,
  isEdit = false,
  onAddFeature,
  onUpdateFeature,
  onRemoveFeature
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter plan name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Price (cents)</label>
          <input
            type="number"
            value={form.priceMonthly}
            onChange={(e) => setForm(prev => ({ ...prev, priceMonthly: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Price in cents (e.g., 2999 for $29.99)"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Billing Period</label>
          <select
            value={form.billingPeriod}
            onChange={(e) => setForm(prev => ({ ...prev, billingPeriod: e.target.value as PlanForm['billingPeriod'] }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="monthly">Monthly</option>
            <option value="3months">3 Months</option>
            <option value="6months">6 Months</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Price ID</label>
          <input
            type="text"
            value={form.stripePriceId}
            onChange={(e) => setForm(prev => ({ ...prev, stripePriceId: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="price_xxxxxxxxx"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="Describe the plan features and benefits"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Stores</label>
          <input
            type="number"
            value={form.limits.stores}
            onChange={(e) => setForm(prev => ({ 
              ...prev, 
              limits: { ...prev.limits, stores: e.target.value }
            }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="-1 for unlimited"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Staff</label>
          <input
            type="number"
            value={form.limits.staff}
            onChange={(e) => setForm(prev => ({ 
              ...prev, 
              limits: { ...prev.limits, staff: e.target.value }
            }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="-1 for unlimited"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Cards</label>
          <input
            type="number"
            value={form.limits.cards}
            onChange={(e) => setForm(prev => ({ 
              ...prev, 
              limits: { ...prev.limits, cards: e.target.value }
            }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="-1 for unlimited"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Transactions</label>
          <input
            type="number"
            value={form.limits.transactions}
            onChange={(e) => setForm(prev => ({ 
              ...prev, 
              limits: { ...prev.limits, transactions: e.target.value }
            }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="-1 for unlimited"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
        {form.features.map((feature, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Feature description"
              value={feature}
              onChange={(e) => onUpdateFeature(index, e.target.value)}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {form.features.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveFeature(index)}
                className="px-3 py-2 text-red-600 hover:text-red-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={onAddFeature}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
        >
          + Add Feature
        </button>
      </div>
    </div>
  );
};

export default PlanFormComponent;
