import { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Printer, 
  Truck, 
  MapPin, 
  Check,
  Clock,
  AlertCircle,
  RefreshCw,
  Eye,
  User,
  Store,
  Calendar
} from 'lucide-react';
import { api } from '../../utils/api';
import LoadingSpinner from '../../components/LoadingSpinner';

interface CardPrintOrder {
  id: string;
  tenantId: string;
  quantity: number;
  status: string;
  notes?: string;
  storeName?: string;
  storeAddress?: string;
  tenantAdminEmail?: string;
  tenantAdminName?: string;
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  deliveryAddress?: string;
  trackingInfo?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  printedAt?: string;
  deliveredAt?: string;
  collectedAt?: string;
  tenant: {
    name: string;
    slug: string;
  };
  cards: Array<{
    id: string;
    cardUid: string;
    status: string;
  }>;
}

const statusColors = {
  CREATED: 'bg-blue-100 text-blue-800',
  PRINTING_ACCEPTED: 'bg-yellow-100 text-yellow-800',
  PRINTING_IN_PROGRESS: 'bg-orange-100 text-orange-800',
  PRINTED: 'bg-green-100 text-green-800',
  READY_FOR_DELIVERY: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  READY_FOR_PICKUP: 'bg-indigo-100 text-indigo-800',
  COLLECTED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800'
};

const statusIcons = {
  CREATED: Clock,
  PRINTING_ACCEPTED: Check,
  PRINTING_IN_PROGRESS: Printer,
  PRINTED: Package,
  READY_FOR_DELIVERY: Truck,
  DELIVERED: Check,
  READY_FOR_PICKUP: MapPin,
  COLLECTED: Check,
  CANCELLED: AlertCircle
};

const statusOptions = [
  { value: 'CREATED', label: 'Created' },
  { value: 'PRINTING_ACCEPTED', label: 'Printing Accepted' },
  { value: 'PRINTING_IN_PROGRESS', label: 'Printing In Progress' },
  { value: 'PRINTED', label: 'Printed' },
  { value: 'READY_FOR_DELIVERY', label: 'Ready for Delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { value: 'COLLECTED', label: 'Collected' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

export default function CardPrintOrders() {
  const [orders, setOrders] = useState<CardPrintOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<CardPrintOrder | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: '',
    notes: '',
    trackingInfo: ''
  });

  useEffect(() => {
    fetchOrders();
  }, [searchTerm, statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      
      const { orders: fetchedOrders } = await api.platform.getCardPrintOrders(params.toString());
      setOrders(fetchedOrders);
    } catch (error) {
      console.error('Failed to fetch print orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = async (orderId: string) => {
    try {
      const { order } = await api.platform.getCardPrintOrder(orderId);
      setSelectedOrder(order);
      setUpdateData({
        status: order.status,
        notes: order.notes || '',
        trackingInfo: order.trackingInfo || ''
      });
      setShowModal(true);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
    }
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;

    try {
      setUpdating(true);
      await api.platform.updateCardPrintOrder(selectedOrder.id, updateData);
      setShowModal(false);
      fetchOrders(); // Refresh the list
    } catch (error) {
      console.error('Failed to update order:', error);
      alert('Failed to update order. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const IconComponent = statusIcons[status as keyof typeof statusIcons] || Clock;
    return <IconComponent className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.tenant.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.tenantAdminName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.storeName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Card Print Orders</h1>
            <p className="text-gray-600">Manage card printing requests from tenant admins</p>
          </div>
          <button
            onClick={fetchOrders}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by tenant, admin, or store..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-sm border">
          {loading ? (
            <div className="p-8 text-center">
              <LoadingSpinner />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No print orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tenant & Admin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Store
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="w-5 h-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {order.quantity} cards
                            </div>
                            <div className="text-sm text-gray-500">
                              {order.deliveryMethod === 'PICKUP' ? 'Pickup' : 'Delivery'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-5 h-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {order.tenant.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {order.tenantAdminName || 'Unknown Admin'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Store className="w-5 h-5 text-gray-400 mr-3" />
                          <div className="text-sm text-gray-900">
                            {order.storeName || 'Unknown Store'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status as keyof typeof statusColors]}`}>
                          {getStatusIcon(order.status)}
                          <span className="ml-1">{order.status.replace(/_/g, ' ')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                          {formatDate(order.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewOrder(order.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View & Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Update Order Modal */}
        {showModal && selectedOrder && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Update Print Order
                </h3>
                
                <div className="space-y-6">
                  {/* Order Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Order Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Tenant:</span>
                        <p className="font-medium">{selectedOrder.tenant.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Quantity:</span>
                        <p className="font-medium">{selectedOrder.quantity} cards</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Admin:</span>
                        <p className="font-medium">{selectedOrder.tenantAdminName}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Store:</span>
                        <p className="font-medium">{selectedOrder.storeName}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Delivery Method:</span>
                        <p className="font-medium">{selectedOrder.deliveryMethod}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Created:</span>
                        <p className="font-medium">{formatDate(selectedOrder.createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Status Update */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={updateData.status}
                      onChange={(e) => setUpdateData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {statusOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={updateData.notes}
                      onChange={(e) => setUpdateData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add notes about the print order..."
                    />
                  </div>

                  {/* Tracking Info */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tracking Information
                    </label>
                    <input
                      type="text"
                      value={updateData.trackingInfo}
                      onChange={(e) => setUpdateData(prev => ({ ...prev, trackingInfo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Tracking number or delivery info..."
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateOrder}
                    disabled={updating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {updating ? (
                      <>
                        <LoadingSpinner />
                        <span className="ml-2">Updating...</span>
                      </>
                    ) : (
                      'Update Order'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}