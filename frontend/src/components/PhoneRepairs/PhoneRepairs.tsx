import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  Plus,
  Search,
  Filter,
  Send,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  Wrench,
  Mail,
  Calendar,
  User,
  Phone,
  AlertCircle,
  X,
  ChevronDown,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../utils/api';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface RepairDevice {
  id: string;
  customerId: string | null;
  customer?: Customer;
  deviceModel: string;
  phoneModel: string;
  issueDetails: string;
  issueDescription: string;
  status: 'DROPPED_OFF' | 'IN_PROGRESS' | 'READY_FOR_PICKUP' | 'PICKED_UP';
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  technicianNotes?: string;
  droppedOffAt: string;
  inProgressAt?: string;
  readyAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface PhoneRepairsProps {
  tenantId: string;
}

const statusConfig = {
  DROPPED_OFF: {
    label: 'Dropped Off',
    icon: Clock,
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    icon: Wrench,
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  READY_FOR_PICKUP: {
    label: 'Ready for Pickup',
    icon: CheckCircle,
    color: 'bg-green-500',
    textColor: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  PICKED_UP: {
    label: 'Picked Up',
    icon: CheckCircle,
    color: 'bg-gray-500',
    textColor: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
};

export const PhoneRepairs: React.FC<PhoneRepairsProps> = ({ tenantId }) => {
  const [repairs, setRepairs] = useState<RepairDevice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<RepairDevice | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    customerId: '',
    deviceModel: '',
    issueDescription: '',
    estimatedCost: '',
    notes: '',
    status: 'DROPPED_OFF' as 'DROPPED_OFF' | 'IN_PROGRESS' | 'READY_FOR_PICKUP' | 'PICKED_UP',
  });

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Helper function to get axios config with Firebase token
  const getAxiosConfig = async () => {
    const token = await getCurrentUserToken();
    return {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      withCredentials: true,
    };
  };

  useEffect(() => {
    fetchRepairs();
    fetchCustomers();
  }, [tenantId]);

  const fetchRepairs = async () => {
    try {
      setLoading(true);
      const config = await getAxiosConfig();
      const tenantSlug = window.location.pathname.split('/')[2]; // Extract from /t/:tenantSlug/...
      const response = await axios.get(`/api/t/${tenantSlug}/repairs`, config);
      setRepairs(response.data.repairs || response.data);
    } catch (error) {
      console.error('Error fetching repairs:', error);
      toast.error('Failed to load repairs');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const config = await getAxiosConfig();
      const tenantSlug = window.location.pathname.split('/')[2]; // Extract from /t/:tenantSlug/...
      const response = await axios.get(`/api/t/${tenantSlug}/customers`, config);
      setCustomers(response.data.customers || response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleAddRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const config = await getAxiosConfig();
      const tenantSlug = window.location.pathname.split('/')[2];
      await axios.post(
        `/api/t/${tenantSlug}/repairs`,
        {
          customerId: formData.customerId,
          phoneModel: formData.deviceModel,
          issueDetails: formData.issueDescription,
          estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined,
          technicianNotes: formData.notes,
        },
        config
      );
      toast.success('Repair created successfully!');
      setShowAddModal(false);
      resetForm();
      fetchRepairs();
    } catch (error: any) {
      console.error('Error creating repair:', error);
      toast.error(error.response?.data?.error || 'Failed to create repair');
    }
  };

  const handleUpdateStatus = async (repairId: string, newStatus: string, currentStatus: string) => {
    // Confirmation dialog
    const statusLabel = statusConfig[newStatus as keyof typeof statusConfig].label;
    const currentStatusLabel = statusConfig[currentStatus as keyof typeof statusConfig].label;
    
    if (!confirm(`Are you sure you want to change status from "${currentStatusLabel}" to "${statusLabel}"?\n\nThis will automatically send SMS and Email notifications to the customer.`)) {
      return;
    }

    try {
      const config = await getAxiosConfig();
      const tenantSlug = window.location.pathname.split('/')[2];
      await axios.patch(
        `/api/t/${tenantSlug}/repairs/${repairId}/status`,
        { 
          status: newStatus,
          sendNotification: true // Explicitly enable notifications
        },
        config
      );
      toast.success(`Status updated to ${statusLabel}! Notifications sent to customer.`);
      fetchRepairs();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  const handleUpdateRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepair) return;

    // Check if status is being changed
    const statusChanged = selectedRepair.status !== formData.status;
    
    if (statusChanged) {
      const newStatusLabel = statusConfig[formData.status as keyof typeof statusConfig].label;
      const currentStatusLabel = statusConfig[selectedRepair.status].label;
      
      if (!confirm(`You are changing the status from "${currentStatusLabel}" to "${newStatusLabel}".\n\nThis will send SMS and Email notifications to the customer. Continue?`)) {
        return;
      }
    }

    try {
      const config = await getAxiosConfig();
      const tenantSlug = window.location.pathname.split('/')[2];
      
      // First update the repair details
      await axios.put(
        `/api/t/${tenantSlug}/repairs/${selectedRepair.id}`,
        {
          phoneModel: formData.deviceModel,
          issueDetails: formData.issueDescription,
          estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined,
          technicianNotes: formData.notes,
        },
        config
      );
      
      // If status changed, update it separately (this triggers notifications in backend)
      if (statusChanged) {
        await axios.patch(
          `/api/t/${tenantSlug}/repairs/${selectedRepair.id}/status`,
          { 
            status: formData.status,
            sendNotification: true // Explicitly enable notifications
          },
          config
        );
        toast.success('Repair updated and notifications sent!');
      } else {
        toast.success('Repair updated successfully!');
      }
      
      setShowEditModal(false);
      setSelectedRepair(null);
      resetForm();
      fetchRepairs();
    } catch (error: any) {
      console.error('Error updating repair:', error);
      toast.error(error.response?.data?.error || 'Failed to update repair');
    }
  };

  const handleDeleteRepair = async (repairId: string) => {
    if (!confirm('Are you sure you want to delete this repair?')) return;

    try {
      const config = await getAxiosConfig();
      const tenantSlug = window.location.pathname.split('/')[2];
      await axios.delete(`/api/t/${tenantSlug}/repairs/${repairId}`, config);
      toast.success('Repair deleted successfully!');
      fetchRepairs();
    } catch (error: any) {
      console.error('Error deleting repair:', error);
      toast.error(error.response?.data?.error || 'Failed to delete repair');
    }
  };

  const handleResendNotification = async (repairId: string) => {
    try {
      const config = await getAxiosConfig();
      const tenantSlug = window.location.pathname.split('/')[2];
      await axios.post(
        `/api/t/${tenantSlug}/repairs/${repairId}/notify`,
        {
          message: 'Status update notification',
          sendVia: ['SMS', 'EMAIL'],
        },
        config
      );
      toast.success('Notification sent successfully!');
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast.error(error.response?.data?.error || 'Failed to send notification');
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const config = await getAxiosConfig();
      const tenantSlug = window.location.pathname.split('/')[2];
      const response = await axios.post(
        `/api/t/${tenantSlug}/customers`,
        {
          firstName: newCustomer.name.split(' ')[0],
          lastName: newCustomer.name.split(' ').slice(1).join(' ') || newCustomer.name.split(' ')[0],
          phone: newCustomer.phone,
          email: newCustomer.email,
        },
        config
      );
      toast.success('Customer added successfully!');
      setCustomers([...customers, response.data]);
      setFormData({ ...formData, customerId: response.data.id });
      setShowCustomerModal(false);
      setNewCustomer({ name: '', email: '', phone: '' });
    } catch (error: any) {
      console.error('Error adding customer:', error);
      toast.error(error.response?.data?.error || 'Failed to add customer');
    }
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      deviceModel: '',
      issueDescription: '',
      estimatedCost: '',
      notes: '',
      status: 'DROPPED_OFF',
    });
  };

  const filteredRepairs = repairs.filter((repair) => {
    const customerName = repair.customer 
      ? `${repair.customer.firstName} ${repair.customer.lastName}`.toLowerCase() 
      : '';
    
    const deviceName = (repair.phoneModel || repair.deviceModel || '').toLowerCase();
    
    const matchesSearch =
      customerName.includes(searchTerm.toLowerCase()) ||
      deviceName.includes(searchTerm.toLowerCase()) ||
      (repair.customer?.phone?.includes(searchTerm) || false);

    const matchesStatus = statusFilter === 'all' || repair.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getNextStatus = (currentStatus: string) => {
    const statusFlow = ['DROPPED_OFF', 'IN_PROGRESS', 'READY_FOR_PICKUP', 'PICKED_UP'];
    const currentIndex = statusFlow.indexOf(currentStatus);
    return currentIndex < statusFlow.length - 1 ? statusFlow[currentIndex + 1] : null;
  };

  const openEditModal = (repair: RepairDevice) => {
    setSelectedRepair(repair);
    setFormData({
      customerId: repair.customerId || '',
      deviceModel: repair.phoneModel || repair.deviceModel || '',
      issueDescription: repair.issueDetails || repair.issueDescription || '',
      estimatedCost: repair.estimatedCost ? (repair.estimatedCost / 100).toString() : '',
      notes: repair.technicianNotes || repair.notes || '',
      status: repair.status,
    });
    setShowEditModal(true);
  };

  const openDetailsModal = (repair: RepairDevice) => {
    setSelectedRepair(repair);
    setShowDetailsModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const stats = {
    total: repairs.length,
    droppedOff: repairs.filter((r) => r.status === 'DROPPED_OFF').length,
    inProgress: repairs.filter((r) => r.status === 'IN_PROGRESS').length,
    ready: repairs.filter((r) => r.status === 'READY_FOR_PICKUP').length,
    pickedUp: repairs.filter((r) => r.status === 'PICKED_UP').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
              <Smartphone className="w-10 h-10 text-blue-600" />
              Phone Repair Tracking
            </h1>
            <p className="text-gray-600 mt-2">Manage device repairs and notify customers instantly</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Repair
          </motion.button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Repairs', value: stats.total, icon: Smartphone, color: 'from-blue-500 to-blue-600' },
          { label: 'Dropped Off', value: stats.droppedOff, icon: Clock, color: 'from-blue-500 to-cyan-600' },
          { label: 'In Progress', value: stats.inProgress, icon: Wrench, color: 'from-yellow-500 to-orange-600' },
          { label: 'Ready', value: stats.ready, icon: CheckCircle, color: 'from-green-500 to-emerald-600' },
          { label: 'Picked Up', value: stats.pickedUp, icon: CheckCircle, color: 'from-gray-500 to-gray-600' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
          >
            <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search and Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg p-6 mb-6"
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by customer name, phone, or device model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-12 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all appearance-none bg-white min-w-[200px]"
            >
              <option value="all">All Statuses</option>
              <option value="DROPPED_OFF">Dropped Off</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="READY_FOR_PICKUP">Ready for Pickup</option>
              <option value="PICKED_UP">Picked Up</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchRepairs}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh
          </motion.button>
        </div>
      </motion.div>

      {/* Repairs Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredRepairs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-lg p-12 text-center"
        >
          <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No repairs found</h3>
          <p className="text-gray-600 mb-6">Get started by adding your first repair</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add First Repair
          </motion.button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRepairs.map((repair, index) => {
            const StatusIcon = statusConfig[repair.status].icon;
            const nextStatus = getNextStatus(repair.status);

            return (
              <motion.div
                key={repair.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden group"
              >
                {/* Status Header */}
                <div className={`${statusConfig[repair.status].color} p-4`}>
                  <div className="flex items-center justify-center text-white">
                    <div className="flex items-center gap-2">
                      <StatusIcon className="w-5 h-5" />
                      <span className="font-semibold">{statusConfig[repair.status].label}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{repair.phoneModel || repair.deviceModel}</h3>

                  {/* Customer Info */}
                  {repair.customer && (
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="w-4 h-4" />
                        <span className="text-sm font-medium">{repair.customer.firstName} {repair.customer.lastName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm">{repair.customer.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm">{repair.customer.email}</span>
                      </div>
                    </div>
                  )}

                  {/* Issue Description */}
                  <div className="bg-gray-50 rounded-xl p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-gray-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Issue</p>
                        <p className="text-sm text-gray-700">{repair.issueDetails || repair.issueDescription}</p>
                      </div>
                    </div>
                  </div>

                  {/* Date Info */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                    <Calendar className="w-4 h-4" />
                    <span>Dropped: {formatDate(repair.droppedOffAt)}</span>
                  </div>

                  {/* Estimated Cost */}
                  {repair.estimatedCost && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                      <p className="text-xs font-semibold text-green-600 mb-1">Estimated Cost</p>
                      <p className="text-lg font-bold text-green-700">${(repair.estimatedCost / 100).toFixed(2)}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {nextStatus && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleUpdateStatus(repair.id, nextStatus, repair.status)}
                        className={`px-4 py-2 ${statusConfig[nextStatus as keyof typeof statusConfig].color} text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all`}
                      >
                        <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                        {statusConfig[nextStatus as keyof typeof statusConfig].label}
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => openDetailsModal(repair)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                    >
                      <Eye className="w-4 h-4" />
                      Details
                    </motion.button>
                  </div>

                  {/* Secondary Actions */}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleResendNotification(repair.id)}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                    >
                      <Send className="w-3 h-3" />
                      Notify
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openEditModal(repair)}
                      className="px-3 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDeleteRepair(repair.id)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Repair Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Plus className="w-6 h-6" />
                    New Repair
                  </h2>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddRepair} className="p-6 space-y-6">
                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Customer *
                  </label>
                  <div className="flex gap-2">
                    <select
                      required
                      value={formData.customerId}
                      onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    >
                      <option value="">Select a customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.firstName} {customer.lastName} - {customer.phone}
                        </option>
                      ))}
                    </select>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowCustomerModal(true)}
                      className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold flex items-center gap-2 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                      New
                    </motion.button>
                  </div>
                </div>

                {/* Device Model */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Device Model *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., iPhone 14 Pro, Samsung Galaxy S23"
                    value={formData.deviceModel}
                    onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                {/* Issue Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Issue Description *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe the issue with the device..."
                    value={formData.issueDescription}
                    onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                  />
                </div>

                {/* Estimated Cost */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estimated Cost (Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.estimatedCost}
                      onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                      className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Internal Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Any internal notes or special instructions..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    Create Repair
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal - Similar structure to Add Modal */}
      <AnimatePresence>
        {showEditModal && selectedRepair && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-gradient-to-r from-yellow-600 to-orange-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Edit className="w-6 h-6" />
                    Edit Repair
                  </h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdateRepair} className="p-6 space-y-6">
                {/* Same fields as Add Modal */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Customer *
                  </label>
                  <select
                    required
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="">Select a customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.firstName} {customer.lastName} - {customer.phone}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Device Model *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., iPhone 14 Pro, Samsung Galaxy S23"
                    value={formData.deviceModel}
                    onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Issue Description *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe the issue with the device..."
                    value={formData.issueDescription}
                    onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estimated Cost (Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.estimatedCost}
                      onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                      className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>
                </div>

                {/* Status Update Field */}
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    Repair Status *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all bg-white"
                  >
                    <option value="DROPPED_OFF">Dropped Off</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                    <option value="PICKED_UP">Picked Up</option>
                  </select>
                  <p className="text-xs text-orange-600 mt-2 flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>Changing status will automatically send SMS and Email notifications to the customer.</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Internal Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Any internal notes or special instructions..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedRepair(null);
                      resetForm();
                    }}
                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    Update Repair
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedRepair && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className={`sticky top-0 ${statusConfig[selectedRepair.status].color} p-6 text-white`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Smartphone className="w-6 h-6" />
                    Repair Details
                  </h2>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 ${statusConfig[selectedRepair.status].bgColor} ${statusConfig[selectedRepair.status].borderColor} border-2 rounded-xl`}>
                    {React.createElement(statusConfig[selectedRepair.status].icon, {
                      className: `w-5 h-5 ${statusConfig[selectedRepair.status].textColor}`,
                    })}
                    <span className={`font-semibold ${statusConfig[selectedRepair.status].textColor}`}>
                      {statusConfig[selectedRepair.status].label}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">ID: #{selectedRepair.id.slice(-8)}</span>
                </div>

                {/* Device Info */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    Device Information
                  </h3>
                  <p className="text-2xl font-bold text-gray-800">{selectedRepair.phoneModel || selectedRepair.deviceModel}</p>
                </div>

                {/* Customer Info */}
                {selectedRepair.customer && (
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Customer Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{selectedRepair.customer.firstName} {selectedRepair.customer.lastName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span>{selectedRepair.customer.phone}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span>{selectedRepair.customer.email}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Issue Description */}
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    Issue Description
                  </h3>
                  <p className="text-gray-700 leading-relaxed">{selectedRepair.issueDetails || selectedRepair.issueDescription}</p>
                </div>

                {/* Timeline */}
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Timeline
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-medium text-gray-700">Dropped Off</p>
                        <p className="text-sm text-gray-500">{formatDate(selectedRepair.droppedOffAt)}</p>
                      </div>
                    </div>
                    {selectedRepair.inProgressAt && (
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                        <div>
                          <p className="font-medium text-gray-700">Started Progress</p>
                          <p className="text-sm text-gray-500">{formatDate(selectedRepair.inProgressAt)}</p>
                        </div>
                      </div>
                    )}
                    {selectedRepair.readyAt && (
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                        <div>
                          <p className="font-medium text-gray-700">Ready for Pickup</p>
                          <p className="text-sm text-gray-500">{formatDate(selectedRepair.readyAt)}</p>
                        </div>
                      </div>
                    )}
                    {selectedRepair.completedAt && (
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-gray-500 rounded-full mt-2"></div>
                        <div>
                          <p className="font-medium text-gray-700">Completed</p>
                          <p className="text-sm text-gray-500">{formatDate(selectedRepair.completedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cost Info */}
                {selectedRepair.estimatedCost && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-700 mb-3">Cost Information</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Estimated Cost</span>
                      <span className="text-2xl font-bold text-green-700">
                        ${(selectedRepair.estimatedCost / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {(selectedRepair.technicianNotes || selectedRepair.notes) && (
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-700 mb-3">Internal Notes</h3>
                    <p className="text-gray-700 leading-relaxed">{selectedRepair.technicianNotes || selectedRepair.notes}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowDetailsModal(false);
                      openEditModal(selectedRepair);
                    }}
                    className="flex-1 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Edit className="w-5 h-5" />
                    Edit Repair
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleResendNotification(selectedRepair.id)}
                    className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Send className="w-5 h-5" />
                    Send Notification
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Customer Modal */}
      <AnimatePresence>
        {showCustomerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setShowCustomerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
            >
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <User className="w-6 h-6" />
                    Add New Customer
                  </h2>
                  <button
                    onClick={() => setShowCustomerModal(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+1234567890"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="john@example.com"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowCustomerModal(false);
                      setNewCustomer({ name: '', email: '', phone: '' });
                    }}
                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    Add Customer
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhoneRepairs;
