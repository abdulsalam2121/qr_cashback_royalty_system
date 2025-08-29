import React, { useState } from 'react';
import { CreditCard, Package, ArrowRight } from 'lucide-react';
import { Layout } from '../components/Layout';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface CardOrderForm {
  cardType: 'SINGLE_SIDED' | 'DOUBLE_SIDED_CUSTOM';
  quantity: number;
  designNotes?: string;
  shippingAddress: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export default function CardOrders() {
  const [orderForm, setOrderForm] = useState<CardOrderForm>({
    cardType: 'SINGLE_SIDED',
    quantity: 100,
    shippingAddress: {
      name: '',
      address1: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US'
    }
  });
  const [loading, setLoading] = useState(false);

  const cardTypes = [
    {
      type: 'SINGLE_SIDED' as const,
      name: 'Single-Sided Cards',
      price: 2.10,
      description: 'Standard cards with QR code and basic branding on front only',
      features: [
        'QR code for customer activation',
        'Your logo and branding',
        'Durable plastic material',
        'Standard credit card size'
      ]
    },
    {
      type: 'DOUBLE_SIDED_CUSTOM' as const,
      name: 'Double-Sided Custom',
      price: 3.90,
      description: 'Premium cards with full custom design on both sides',
      features: [
        'QR code for customer activation',
        'Full custom design on both sides',
        'Premium finish and materials',
        'Scratch-resistant coating',
        'Custom colors and graphics'
      ]
    }
  ];

  const selectedCardType = cardTypes.find(ct => ct.type === orderForm.cardType)!;
  const totalPrice = selectedCardType.price * orderForm.quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // This would integrate with the card ordering API
      console.log('Submitting order:', orderForm);
      alert('Order submitted successfully! You will receive a confirmation email shortly.');
    } catch (error) {
      console.error('Failed to submit order:', error);
      alert('Failed to submit order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Package className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Order Physical Cards</h1>
          <p className="mt-2 text-lg text-gray-600">
            Get high-quality loyalty cards delivered to your location
          </p>
        </div>

        {/* Card Type Selection */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Select Card Type</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {cardTypes.map((cardType) => (
              <div
                key={cardType.type}
                className={`relative rounded-lg border-2 p-6 cursor-pointer transition-all ${
                  orderForm.cardType === cardType.type
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setOrderForm(prev => ({ ...prev, cardType: cardType.type }))}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">{cardType.name}</h3>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-900">
                      ${cardType.price.toFixed(2)}
                    </span>
                    <p className="text-sm text-gray-500">per card</p>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-4">{cardType.description}</p>
                
                <ul className="space-y-2">
                  {cardType.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                {orderForm.cardType === cardType.type && (
                  <div className="absolute top-4 right-4">
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Order Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Order Details</h2>
          
          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity (minimum 100 cards)
            </label>
            <input
              type="number"
              min="100"
              step="50"
              value={orderForm.quantity}
              onChange={(e) => setOrderForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 100 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Design Notes for Custom Cards */}
          {orderForm.cardType === 'DOUBLE_SIDED_CUSTOM' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Design Notes (Optional)
              </label>
              <textarea
                value={orderForm.designNotes || ''}
                onChange={(e) => setOrderForm(prev => ({ ...prev, designNotes: e.target.value }))}
                placeholder="Describe your design requirements, colors, logos, etc."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Our design team will contact you to finalize the design before production.
              </p>
            </div>
          )}

          {/* Shipping Address */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Shipping Address</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={orderForm.shippingAddress.name}
                  onChange={(e) => setOrderForm(prev => ({
                    ...prev,
                    shippingAddress: { ...prev.shippingAddress, name: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={orderForm.shippingAddress.address1}
                  onChange={(e) => setOrderForm(prev => ({
                    ...prev,
                    shippingAddress: { ...prev.shippingAddress, address1: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  value={orderForm.shippingAddress.address2 || ''}
                  onChange={(e) => setOrderForm(prev => ({
                    ...prev,
                    shippingAddress: { ...prev.shippingAddress, address2: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={orderForm.shippingAddress.city}
                  onChange={(e) => setOrderForm(prev => ({
                    ...prev,
                    shippingAddress: { ...prev.shippingAddress, city: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={orderForm.shippingAddress.state}
                  onChange={(e) => setOrderForm(prev => ({
                    ...prev,
                    shippingAddress: { ...prev.shippingAddress, state: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code
                </label>
                <input
                  type="text"
                  value={orderForm.shippingAddress.zipCode}
                  onChange={(e) => setOrderForm(prev => ({
                    ...prev,
                    shippingAddress: { ...prev.shippingAddress, zipCode: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h3 className="text-lg font-medium text-gray-900">Order Summary</h3>
            <div className="flex justify-between text-sm">
              <span>{selectedCardType.name}</span>
              <span>${selectedCardType.price.toFixed(2)} per card</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Quantity</span>
              <span>{orderForm.quantity} cards</span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <LoadingSpinner />
            ) : (
              <>
                Place Order
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </button>
          
          <p className="text-sm text-gray-500 text-center">
            Production time is 5-7 business days. Shipping takes an additional 3-5 business days.
          </p>
        </form>
      </div>
    </Layout>
  );
}
