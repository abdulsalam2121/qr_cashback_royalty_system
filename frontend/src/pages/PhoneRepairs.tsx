import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Smartphone,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  X,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  FileText,
  Bell,
  History,
  TrendingUp,
  Wrench,
  Box,
  Check,
} from 'lucide-react';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';
import LoadingSpinner from '../components/LoadingSpinner';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
}

interface RepairDevice {
  id: string;
  phoneModel: string;
  imei: string | null;
  issueDetails: string;
  accessories: string[] | null;
  status: 'DROPPED_OFF' | 'IN_PROGRESS' | 'READY_FOR_PICKUP' | 'PICKED_UP' | 'CANCELLED';
  estimatedCost: number | null;
  actualCost: number | null;
  technicianNotes: string | null;
  droppedOffAt: string;
  startedAt: string | null;
  completedAt: string | null;
  pickedUpAt: string | null;
  customer: Customer | null;
  statusHistory?: Array<{
    id: string;
    oldStatus: string | null;
    newStatus: string;
    notes: string | null;
    createdAt: string;
  }>;
  notifications?: Array<{
    id: string;
    type: string;
    sentVia: string[];
    smsSent: boolean;
    emailSent: boolean;
    sentAt: string;
  }>;
}

interface RepairStats {
  total: number;
  byStatus: {
    droppedOff: number;
    inProgress: number;
    readyForPickup: number;
    pickedUp: number;
    cancelled: number;
  };
  revenue: number;
}

const statusConfig = {
  DROPPED_OFF: {
    label: 'Dropped Off',
    color: 'bg-blue-100 text-blue-800',
    icon: Package,
    borderColor: 'border-blue-200',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Wrench,
    borderColor: 'border-yellow-200',
  },
  READY_FOR_PICKUP: {
    label: 'Ready for Pickup',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    borderColor: 'border-green-200',
  },
  PICKED_UP: {
    label: 'Picked Up',
    color: 'bg-gray-100 text-gray-800',
    icon: Check,
    borderColor: 'border-gray-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800',
    icon: X,
    borderColor: 'border-red-200',
  },
};

const PhoneRepairs: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [activeTab, setActiveTab] = useState<'list' | 'new'>('list');
  const [repairs, setRepairs] = useState<RepairDevice[]>([]);
  const [stats, setStats] = useState<RepairStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRepair, setSelectedRepair] = useState<RepairDevice | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New repair form state
  const [newRepairForm, setNewRepairForm] = useState({
    customerId: '',
    phoneModel: '',
    imei: '',
    issueDetails: '',
    accessories: [] as string[],
    estimatedCost: '',
    sendNotification: true,
  });

  // New customer form state
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  });

  // Update status form state
  const [statusUpdate, setStatusUpdate] = useState({
    status: '' as RepairDevice['status'],
    notes: '',
    sendNotification: true,
  });

  // Custom notification form state
  const [customNotification, setCustomNotification] = useState({
    subject: '',
    message: '',
    sendVia: ['EMAIL'] as string[],
  });

  useEffect(() => {
    loadData();
  }, [tenantSlug, statusFilter]);

  const loadData = async () => {
    if (!tenantSlug) return;

    try {
      setLoading(true);
      const [repairsData, statsData, customersData] = await Promise.all([
        api.repairs.getAll(tenantSlug, { status: statusFilter !== 'all' ? statusFilter : undefined }),
        api.repairs.getStats(tenantSlug),
        api.customers.getAll(tenantSlug),
      ]);

      setRepairs(repairsData.repairs);
      setStats(statsData.stats);
      setCustomers(customersData.customers);
    } catch (error) {
      console.error('Failed to load repair data:', error);
      showMessage('error', 'Failed to load repair data');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreateRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantSlug) return;

    try {
      setLoading(true);
      const data: any = {
        ...newRepairForm,
        estimatedCost: newRepairForm.estimatedCost ? parseFloat(newRepairForm.estimatedCost) : undefined,
      };

      if (showNewCustomer) {
        data.customerData = newCustomer;
        delete data.customerId;
      }

      await api.repairs.create(tenantSlug, data);
      showMessage('success', 'Repair created successfully!');
      
      // Reset form
      setNewRepairForm({
        customerId: '',
        phoneModel: '',
        imei: '',
        issueDetails: '',
        accessories: [],
        estimatedCost: '',
        sendNotification: true,
      });
      setNewCustomer({ firstName: '', lastName: '', phone: '', email: '' });
      setShowNewCustomer(false);
      setActiveTab('list');
      
      await loadData();
    } catch (error: any) {
      console.error('Failed to create repair:', error);
      showMessage('error', error.response?.data?.error || 'Failed to create repair');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!tenantSlug || !selectedRepair) return;

    try {
      setLoading(true);
      await api.repairs.updateStatus(tenantSlug, selectedRepair.id, statusUpdate);
      showMessage('success', 'Status updated successfully!');
      setShowStatusModal(false);
      await loadData();
    } catch (error) {
      console.error('Failed to update status:', error);
      showMessage('error', 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!tenantSlug || !selectedRepair) return;

    try {
      setLoading(true);
      await api.repairs.sendNotification(tenantSlug, selectedRepair.id, customNotification);
      showMessage('success', 'Notification sent successfully!');
      setShowNotificationModal(false);
      await loadData();
    } catch (error) {
      console.error('Failed to send notification:', error);
      showMessage('error', 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRepair = async (repairId: string) => {
    if (!tenantSlug || !confirm('Are you sure you want to delete this repair?')) return;

    try {
      setLoading(true);
      await api.repairs.delete(tenantSlug, repairId);
      showMessage('success', 'Repair deleted successfully!');
      setShowDetails(false);
      await loadData();
    } catch (error) {
      console.error('Failed to delete repair:', error);
      showMessage('error', 'Failed to delete repair');
    } finally {
      setLoading(false);
    }
  };

  const filteredRepairs = repairs.filter((repair) => {
    const matchesSearch =
      repair.phoneModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repair.issueDetails.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repair.imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repair.customer?.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repair.customer?.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repair.customer?.phone?.includes(searchTerm) ||
      repair.customer?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  if (loading && repairs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      {/* Message Toast */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg animate-slide-in ${
            message.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}
        >
          <div className="flex items-center gap-3">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              Phone Repair Tracking
            </h1>
            <p className="text-gray-600 mt-2">Manage device repairs and customer notifications</p>
          </div>
          <button
            onClick={() => setActiveTab('new')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Repair
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Total Repairs</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Box className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-yellow-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">In Progress</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.byStatus.inProgress}</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Wrench className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-green-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Ready</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{stats.byStatus.readyForPickup}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Completed</p>
                  <p className="text-3xl font-bold text-gray-600 mt-1">{stats.byStatus.pickedUp}</p>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Check className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-purple-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Revenue</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">${stats.revenue.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === 'list'
              ? 'bg-white text-blue-600 shadow-md'
              : 'bg-white/50 text-gray-600 hover:bg-white hover:shadow'
          }`}
        >
          Repairs List
        </button>
        <button
          onClick={() => setActiveTab('new')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === 'new'
              ? 'bg-white text-blue-600 shadow-md'
              : 'bg-white/50 text-gray-600 hover:bg-white hover:shadow'
          }`}
        >
          New Repair
        </button>
      </div>

      {/* Content */}
      {activeTab === 'list' ? (
        <div className="space-y-6">
          {/* Search and Filter Bar */}
          <div className="bg-white rounded-xl p-4 shadow-md">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by customer, phone model, IMEI..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="DROPPED_OFF">Dropped Off</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                  <option value="PICKED_UP">Picked Up</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Repairs Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredRepairs.map((repair) => {
              const StatusIcon = statusConfig[repair.status].icon;
              return (
                <div
                  key={repair.id}
                  className={`bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border-l-4 ${
                    statusConfig[repair.status].borderColor
                  } cursor-pointer transform hover:scale-105`}
                  onClick={() => {
                    setSelectedRepair(repair);
                    setShowDetails(true);
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{repair.phoneModel}</h3>
                        {repair.imei && (
                          <p className="text-sm text-gray-500">IMEI: {repair.imei}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                        statusConfig[repair.status].color
                      }`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {statusConfig[repair.status].label}
                    </span>
                  </div>

                  {/* Customer Info */}
                  {repair.customer && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <User className="w-4 h-4" />
                        <span className="font-medium">
                          {repair.customer.firstName} {repair.customer.lastName}
                        </span>
                      </div>
                      {repair.customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <Phone className="w-4 h-4" />
                          <span>{repair.customer.phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Issue */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 line-clamp-2">{repair.issueDetails}</p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(repair.droppedOffAt).toLocaleDateString()}</span>
                    </div>
                    {repair.estimatedCost && (
                      <div className="flex items-center gap-1 text-sm font-semibold text-purple-600">
                        <DollarSign className="w-4 h-4" />
                        <span>${repair.estimatedCost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRepairs.length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center shadow-md">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No repairs found</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>
      ) : (
        // New Repair Form
        <div className="bg-white rounded-xl p-8 shadow-md max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Repair</h2>
          
          <form onSubmit={handleCreateRepair} className="space-y-6">
            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
              {!showNewCustomer ? (
                <div className="flex gap-2">
                  <select
                    value={newRepairForm.customerId}
                    onChange={(e) => setNewRepairForm({ ...newRepairForm, customerId: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={!showNewCustomer}
                  >
                    <option value="">Select existing customer...</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.firstName} {customer.lastName} - {customer.phone || customer.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(true)}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-blue-900">New Customer</h3>
                    <button
                      type="button"
                      onClick={() => setShowNewCustomer(false)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={newCustomer.firstName}
                      onChange={(e) => setNewCustomer({ ...newCustomer, firstName: e.target.value })}
                      className="px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={newCustomer.lastName}
                      onChange={(e) => setNewCustomer({ ...newCustomer, lastName: e.target.value })}
                      className="px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      className="px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      className="px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Device Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Model *</label>
                <input
                  type="text"
                  value={newRepairForm.phoneModel}
                  onChange={(e) => setNewRepairForm({ ...newRepairForm, phoneModel: e.target.value })}
                  placeholder="e.g., iPhone 14 Pro"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">IMEI (Optional)</label>
                <input
                  type="text"
                  value={newRepairForm.imei}
                  onChange={(e) => setNewRepairForm({ ...newRepairForm, imei: e.target.value })}
                  placeholder="15-digit IMEI number"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Issue Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Issue Details *</label>
              <textarea
                value={newRepairForm.issueDetails}
                onChange={(e) => setNewRepairForm({ ...newRepairForm, issueDetails: e.target.value })}
                placeholder="Describe the issue in detail..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Estimated Cost */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Cost (Optional)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="number"
                  step="0.01"
                  value={newRepairForm.estimatedCost}
                  onChange={(e) => setNewRepairForm({ ...newRepairForm, estimatedCost: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Send Notification */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="sendNotification"
                checked={newRepairForm.sendNotification}
                onChange={(e) => setNewRepairForm({ ...newRepairForm, sendNotification: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="sendNotification" className="text-sm font-medium text-gray-700">
                Send notification to customer
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Repair'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Repair Details Modal */}
      {showDetails && selectedRepair && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedRepair.phoneModel}</h2>
                  {selectedRepair.imei && <p className="text-sm text-gray-500">IMEI: {selectedRepair.imei}</p>}
                </div>
              </div>
              <button onClick={() => setShowDetails(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Status and Actions */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span
                  className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${
                    statusConfig[selectedRepair.status].color
                  }`}
                >
                  {React.createElement(statusConfig[selectedRepair.status].icon, { className: 'w-4 h-4' })}
                  {statusConfig[selectedRepair.status].label}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setStatusUpdate({ status: selectedRepair.status, notes: '', sendNotification: true });
                      setShowStatusModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Update Status
                  </button>
                  <button
                    onClick={() => {
                      setCustomNotification({ subject: '', message: '', sendVia: ['EMAIL'] });
                      setShowNotificationModal(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send Notification
                  </button>
                  <button
                    onClick={() => handleDeleteRepair(selectedRepair.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Customer Information */}
              {selectedRepair.customer && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Customer Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium text-gray-900">
                        {selectedRepair.customer.firstName} {selectedRepair.customer.lastName}
                      </p>
                    </div>
                    {selectedRepair.customer.phone && (
                      <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <p className="font-medium text-gray-900">{selectedRepair.customer.phone}</p>
                      </div>
                    )}
                    {selectedRepair.customer.email && (
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium text-gray-900">{selectedRepair.customer.email}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Repair Details */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Issue Description</p>
                  <p className="text-gray-900 bg-gray-50 p-4 rounded-lg">{selectedRepair.issueDetails}</p>
                </div>

                {selectedRepair.technicianNotes && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Technician Notes</p>
                    <p className="text-gray-900 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      {selectedRepair.technicianNotes}
                    </p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Dropped Off</p>
                    <p className="font-medium text-gray-900">
                      {new Date(selectedRepair.droppedOffAt).toLocaleString()}
                    </p>
                  </div>
                  {selectedRepair.startedAt && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Started</p>
                      <p className="font-medium text-gray-900">
                        {new Date(selectedRepair.startedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {selectedRepair.completedAt && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Completed</p>
                      <p className="font-medium text-gray-900">
                        {new Date(selectedRepair.completedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {selectedRepair.pickedUpAt && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Picked Up</p>
                      <p className="font-medium text-gray-900">
                        {new Date(selectedRepair.pickedUpAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Cost Information */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedRepair.estimatedCost && (
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-sm text-purple-700">Estimated Cost</p>
                      <p className="text-2xl font-bold text-purple-900">${selectedRepair.estimatedCost.toFixed(2)}</p>
                    </div>
                  )}
                  {selectedRepair.actualCost && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-700">Actual Cost</p>
                      <p className="text-2xl font-bold text-green-900">${selectedRepair.actualCost.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status History */}
              {selectedRepair.statusHistory && selectedRepair.statusHistory.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Status History
                  </h3>
                  <div className="space-y-2">
                    {selectedRepair.statusHistory.map((history) => (
                      <div key={history.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">
                            {history.oldStatus && `${history.oldStatus} → `}
                            {history.newStatus}
                          </span>
                          <span className="text-sm text-gray-600">
                            {new Date(history.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {history.notes && <p className="text-sm text-gray-600 mt-1">{history.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notifications */}
              {selectedRepair.notifications && selectedRepair.notifications.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notifications Sent
                  </h3>
                  <div className="space-y-2">
                    {selectedRepair.notifications.map((notification) => (
                      <div key={notification.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {notification.sentVia.map((via) => (
                              <span
                                key={via}
                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium"
                              >
                                {via}
                              </span>
                            ))}
                          </div>
                          <span className="text-sm text-gray-600">
                            {new Date(notification.sentAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedRepair && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Update Repair Status</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
                <select
                  value={statusUpdate.status}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, status: e.target.value as RepairDevice['status'] })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="DROPPED_OFF">Dropped Off</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                  <option value="PICKED_UP">Picked Up</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={statusUpdate.notes}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any notes about this status change..."
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="statusNotification"
                  checked={statusUpdate.sendNotification}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, sendNotification: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="statusNotification" className="text-sm font-medium text-gray-700">
                  Send notification to customer
                </label>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleUpdateStatus}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Update Status
                </button>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Notification Modal */}
      {showNotificationModal && selectedRepair && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Send Custom Notification</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject (Email Only)</label>
                <input
                  type="text"
                  value={customNotification.subject}
                  onChange={(e) => setCustomNotification({ ...customNotification, subject: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional email subject..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                <textarea
                  value={customNotification.message}
                  onChange={(e) => setCustomNotification({ ...customNotification, message: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your message..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Send Via</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={customNotification.sendVia.includes('SMS')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCustomNotification({
                            ...customNotification,
                            sendVia: [...customNotification.sendVia, 'SMS'],
                          });
                        } else {
                          setCustomNotification({
                            ...customNotification,
                            sendVia: customNotification.sendVia.filter((v) => v !== 'SMS'),
                          });
                        }
                      }}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">SMS</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={customNotification.sendVia.includes('EMAIL')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCustomNotification({
                            ...customNotification,
                            sendVia: [...customNotification.sendVia, 'EMAIL'],
                          });
                        } else {
                          setCustomNotification({
                            ...customNotification,
                            sendVia: customNotification.sendVia.filter((v) => v !== 'EMAIL'),
                          });
                        }
                      }}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Email</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleSendNotification}
                  disabled={customNotification.sendVia.length === 0 || !customNotification.message}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send Notification
                </button>
                <button
                  onClick={() => setShowNotificationModal(false)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneRepairs;
