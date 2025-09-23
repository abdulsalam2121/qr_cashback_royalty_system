import { useState, useEffect } from 'react';
import { 
  Package, 
  Filter, 
  Printer, 
  Truck, 
  MapPin, 
  Check,
  Clock,
  AlertCircle,
  RefreshCw,
  Eye,
  Calendar,
  Edit,
  CheckCircle
} from 'lucide-react';
import { api } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuthStore } from '../store/authStore';

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
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<CardPrintOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<CardPrintOrder | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [editData, setEditData] = useState({
    deliveryMethod: 'PICKUP' as 'PICKUP' | 'DELIVERY',
    deliveryAddress: ''
  });

  useEffect(() => {
    if (user?.tenantSlug) {
      fetchOrders();
    }
  }, [user?.tenantSlug, statusFilter]);

  const fetchOrders = async () => {
    if (!user?.tenantSlug) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      
      const { orders: fetchedOrders } = await api.tenant.getCardPrintOrders(user.tenantSlug, params.toString());
      setOrders(fetchedOrders);
    } catch (error) {
      console.error('Failed to fetch print orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = async (orderId: string) => {
    if (!user?.tenantSlug) return;

    try {
      const { order } = await api.tenant.getCardPrintOrder(user.tenantSlug, orderId);
      setSelectedOrder(order);
      setShowModal(true);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
    }
  };

  const handleEditOrder = (order: CardPrintOrder) => {
    setSelectedOrder(order);
    setEditData({
      deliveryMethod: order.deliveryMethod,
      deliveryAddress: order.deliveryAddress || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder || !user?.tenantSlug) return;

    try {
      setUpdating(true);
      await api.tenant.updateCardPrintOrder(user.tenantSlug, selectedOrder.id, editData);
      setShowEditModal(false);
      fetchOrders(); // Refresh the list
    } catch (error) {
      console.error('Failed to update order:', error);
      alert('Failed to update order. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleCollectOrder = async (orderId: string) => {
    if (!user?.tenantSlug) return;

    const confirmed = window.confirm('Are you sure you want to mark this order as collected?');
    if (!confirmed) return;

    try {
      setCollecting(true);
      await api.tenant.collectCardPrintOrder(user.tenantSlug, orderId);
      fetchOrders(); // Refresh the list
    } catch (error) {
      console.error('Failed to mark order as collected:', error);
      alert('Failed to mark order as collected. Please try again.');
    } finally {
      setCollecting(false);
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

  const canEdit = (order: CardPrintOrder) => {
    return ['CREATED', 'PRINTING_ACCEPTED'].includes(order.status);
  };

  const canCollect = (order: CardPrintOrder) => {
    return order.status === 'READY_FOR_PICKUP';
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Card Print Orders</h1>
            <p className="text-gray-600">Track your card printing requests and manage delivery preferences</p>
          </div>
          <button
            onClick={fetchOrders}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Package className="w-5 h-5 text-blue-500 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-blue-900">How Print Orders Work</h3>
              <p className="text-sm text-blue-700 mt-1">
                When you create cards digitally, a print order is automatically sent to the Platform Admin. 
                They will print your cards and either deliver them to you or prepare them for pickup.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-4">
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
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No print orders found</p>
              <p className="text-sm mt-2">Create some cards to see print orders appear here.</p>
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
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delivery Method
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
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="w-5 h-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {order.quantity} cards
                            </div>
                            <div className="text-sm text-gray-500">
                              {order.storeName || 'Unknown Store'}
                            </div>
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
                          {order.deliveryMethod === 'PICKUP' ? (
                            <>
                              <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                              Pickup
                            </>
                          ) : (
                            <>
                              <Truck className="w-4 h-4 text-gray-400 mr-2" />
                              Delivery
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                          {formatDate(order.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewOrder(order.id)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-600 hover:text-blue-900"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </button>
                          {canEdit(order) && (
                            <button
                              onClick={() => handleEditOrder(order)}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-green-600 hover:text-green-900"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </button>
                          )}
                          {canCollect(order) && (
                            <button
                              onClick={() => handleCollectOrder(order.id)}
                              disabled={collecting}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-purple-600 hover:text-purple-900 disabled:opacity-50"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Collect
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* View Order Modal */}
        {showModal && selectedOrder && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Print Order Details
                </h3>
                
                <div className="space-y-6">
                  {/* Order Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-3">Order Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Quantity:</span>
                        <p className="font-medium">{selectedOrder.quantity} cards</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <p className="font-medium">{selectedOrder.status.replace(/_/g, ' ')}</p>
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
                      {selectedOrder.trackingInfo && (
                        <div>
                          <span className="text-gray-500">Tracking Info:</span>
                          <p className="font-medium">{selectedOrder.trackingInfo}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Order Timeline</h4>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                        <span className="text-gray-500">Created:</span>
                        <span className="ml-2 font-medium">{formatDate(selectedOrder.createdAt)}</span>
                      </div>
                      {selectedOrder.acceptedAt && (
                        <div className="flex items-center text-sm">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
                          <span className="text-gray-500">Accepted:</span>
                          <span className="ml-2 font-medium">{formatDate(selectedOrder.acceptedAt)}</span>
                        </div>
                      )}
                      {selectedOrder.printedAt && (
                        <div className="flex items-center text-sm">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                          <span className="text-gray-500">Printed:</span>
                          <span className="ml-2 font-medium">{formatDate(selectedOrder.printedAt)}</span>
                        </div>
                      )}
                      {selectedOrder.deliveredAt && (
                        <div className="flex items-center text-sm">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                          <span className="text-gray-500">Delivered:</span>
                          <span className="ml-2 font-medium">{formatDate(selectedOrder.deliveredAt)}</span>
                        </div>
                      )}
                      {selectedOrder.collectedAt && (
                        <div className="flex items-center text-sm">
                          <div className="w-2 h-2 bg-gray-500 rounded-full mr-3"></div>
                          <span className="text-gray-500">Collected:</span>
                          <span className="ml-2 font-medium">{formatDate(selectedOrder.collectedAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedOrder.notes && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{selectedOrder.notes}</p>
                    </div>
                  )}

                  {/* Cards */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Cards in this order</h4>
                    <div className="text-sm text-gray-600">
                      {selectedOrder.cards.length} cards total
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Order Modal */}
        {showEditModal && selectedOrder && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Edit Delivery Preferences
                </h3>
                
                <div className="space-y-4">
                  {/* Delivery Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Method
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="PICKUP"
                          checked={editData.deliveryMethod === 'PICKUP'}
                          onChange={(e) => setEditData(prev => ({ ...prev, deliveryMethod: e.target.value as 'PICKUP' | 'DELIVERY' }))}
                          className="mr-2"
                        />
                        <MapPin className="w-4 h-4 mr-2" />
                        Pickup from Platform Admin
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="DELIVERY"
                          checked={editData.deliveryMethod === 'DELIVERY'}
                          onChange={(e) => setEditData(prev => ({ ...prev, deliveryMethod: e.target.value as 'PICKUP' | 'DELIVERY' }))}
                          className="mr-2"
                        />
                        <Truck className="w-4 h-4 mr-2" />
                        Delivery to my location
                      </label>
                    </div>
                  </div>

                  {/* Delivery Address */}
                  {editData.deliveryMethod === 'DELIVERY' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Delivery Address
                      </label>
                      <textarea
                        value={editData.deliveryAddress}
                        onChange={(e) => setEditData(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter your delivery address..."
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowEditModal(false)}
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
                      'Update Preferences'
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