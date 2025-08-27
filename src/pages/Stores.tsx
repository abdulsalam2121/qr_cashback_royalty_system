import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Store, Plus, Edit, MapPin, Users, CreditCard, Receipt } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../utils/api';
import { formatDate } from '../utils/format';
import { Store as StoreType } from '../types';

const Stores: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: ''
  });

  useEffect(() => {
    fetchStores();
  }, [tenantSlug]);

  const fetchStores = async () => {
    if (!tenantSlug) return;
    
    try {
      const data = await api.tenant.getStores(tenantSlug);
      setStores(data.stores || []);
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantSlug) return;
    
    try {
      if (editingStore) {
        const { store } = await api.tenant.updateStore(tenantSlug, editingStore.id, formData);
        setStores(prev => prev.map(s => s.id === store.id ? store : s));
      } else {
        const { store } = await api.tenant.createStore(tenantSlug, formData);
        setStores(prev => [store, ...prev]);
      }
      
      resetForm();
    } catch (error) {
      console.error('Failed to save store:', error);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', address: '' });
    setShowCreateModal(false);
    setEditingStore(null);
  };

  const handleEdit = (store: StoreType) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      address: store.address || ''
    });
    setShowCreateModal(true);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Store className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
            <p className="text-gray-600">Manage store locations and settings</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Store
        </button>
      </div>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stores.map((store) => (
          <div key={store.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Store className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{store.name}</h3>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    store.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {store.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleEdit(store)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
            </div>

            {store.address && (
              <div className="flex items-start space-x-2 mb-4">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <p className="text-sm text-gray-600">{store.address}</p>
              </div>
            )}

            {/* Store Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-sm font-medium text-gray-900">{store._count?.users || 0}</p>
                <p className="text-xs text-gray-500">Staff</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <CreditCard className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-sm font-medium text-gray-900">{store._count?.cards || 0}</p>
                <p className="text-xs text-gray-500">Cards</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Receipt className="w-4 h-4 text-purple-500" />
                </div>
                <p className="text-sm font-medium text-gray-900">{store._count?.transactions || 0}</p>
                <p className="text-xs text-gray-500">Transactions</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Created {formatDate(store.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {stores.length === 0 && (
        <div className="text-center py-12">
          <Store className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No stores created yet</p>
        </div>
      )}

      {/* Create/Edit Store Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingStore ? 'Edit Store' : 'Create New Store'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter store name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter store address"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingStore ? 'Update Store' : 'Create Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stores;