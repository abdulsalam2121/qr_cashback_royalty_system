export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
};

export const formatPercentage = (bps: number): string => {
  return `${(bps / 100).toFixed(1)}%`;
};

export const getTierColor = (tier: string): string => {
  switch (tier) {
    case 'SILVER':
      return 'text-gray-600 bg-gray-100';
    case 'GOLD':
      return 'text-yellow-600 bg-yellow-100';
    case 'PLATINUM':
      return 'text-purple-600 bg-purple-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'ACTIVE':
      return 'text-green-600 bg-green-100';
    case 'BLOCKED':
      return 'text-red-600 bg-red-100';
    case 'UNASSIGNED':
      return 'text-gray-600 bg-gray-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};