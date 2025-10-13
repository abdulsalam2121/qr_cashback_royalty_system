import { User, Customer, Card, Transaction, Store, DashboardStats, CashbackRule, TierRule, Offer, Tenant, PlatformStats, Plan } from '../types';
import { getCurrentUserToken } from '../firebase/auth';

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV 
    ? 'http://localhost:3002/api' 
    : `${window.location.protocol}//${window.location.host}/api`
);

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Only log in development
  if (import.meta.env.DEV) {
    console.log(`API Request: ${options.method || 'GET'} ${url}`);
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Add Firebase ID token for authenticated requests (if available)
  try {
    const idToken = await getCurrentUserToken();
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
      if (import.meta.env.DEV) {
        console.log('🔑 Added Firebase ID token to request');
      }
    }
  } catch (error) {
    // If no user is logged in or token expired, continue without token
    if (import.meta.env.DEV) {
      console.log('ℹ️ No Firebase token available for request');
    }
  }
  
  const config: RequestInit = {
    credentials: 'include',
    headers,
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (import.meta.env.DEV) {
      console.log(`API Response: ${response.status} ${response.statusText}`);
    }
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If we can't parse error JSON, use the status text
      }
      throw new ApiError(errorMessage, response.status);
    }

    // Handle 204 No Content responses (typically from DELETE operations)
    if (response.status === 204) {
      if (import.meta.env.DEV) {
        console.log('API Response: No content (204)');
      }
      return {} as T;
    }

    const data = await response.json();
    if (import.meta.env.DEV) {
      console.log('API Response received');
    }
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`API Error for ${url}:`, error);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error. Please check your connection.', 0);
  }
}

export const api = {
  // Health check
  healthCheck: async (): Promise<{ status: string; timestamp: string }> => {
    return request('/healthz');
  },

  // Auth
  login: async (email: string, password: string): Promise<{ user: User; tenant?: Tenant }> => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Google login using Firebase ID token
  googleLogin: async (idToken: string): Promise<{ user: User; tenant?: Tenant }> => {
    return request('/auth/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({}),
    });
  },

  logout: async (): Promise<void> => {
    await request('/auth/logout', { method: 'POST' });
  },

  getMe: async (): Promise<{ user: User; tenant?: Tenant }> => {
    return request('/auth/me');
  },

  signup: async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<{ user: User; tenant: Tenant }> => {
    return request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  register: async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
    storeId?: string;
  }): Promise<{ user: User }> => {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  verifyEmail: async (token: string): Promise<{ message: string; user?: User; tenant?: Tenant }> => {
    return request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  resendVerification: async (email: string): Promise<{ message: string }> => {
    return request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Platform Admin APIs
  platform: {
    getStats: async (): Promise<PlatformStats> => {
      return request('/platform/stats');
    },

    getTenants: async (params?: string): Promise<{ tenants: Tenant[]; total: number; page: number; pages: number }> => {
      const query = params ? `?${params}` : '';
      return request(`/platform/tenants${query}`);
    },

    createTenant: async (tenantData: {
      name: string;
      slug: string;
      ownerEmail: string;
      ownerPassword: string;
      ownerFirstName: string;
      ownerLastName: string;
    }): Promise<{ tenant: Tenant; user: User }> => {
      return request('/platform/tenants', {
        method: 'POST',
        body: JSON.stringify(tenantData),
      });
    },

    updateTenant: async (id: string, tenantData: Partial<Tenant>): Promise<{ tenant: Tenant }> => {
      return request(`/platform/tenants/${id}`, {
        method: 'PUT',
        body: JSON.stringify(tenantData),
      });
    },

    getPlans: async (): Promise<{ plans: Plan[] }> => {
      return request('/platform/plans');
    },

    createPlan: async (planData: Partial<Plan>): Promise<{ plan: Plan }> => {
      return request('/platform/plans', {
        method: 'POST',
        body: JSON.stringify(planData),
      });
    },

    updatePlan: async (id: string, data: any): Promise<{ plan: Plan }> => {
      return request(`/platform/plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    deletePlan: async (id: string): Promise<void> => {
      return request(`/platform/plans/${id}`, {
        method: 'DELETE',
      });
    },

    // Card Print Orders
    getCardPrintOrders: async (params?: string): Promise<{ orders: any[]; pagination: any }> => {
      const query = params ? `?${params}` : '';
      return request(`/platform/card-print-orders${query}`);
    },

    getCardPrintOrder: async (id: string): Promise<{ order: any }> => {
      return request(`/platform/card-print-orders/${id}`);
    },

    getCardPrintOrdersCount: async (): Promise<{ count: number }> => {
      return request(`/platform/card-print-orders/count`);
    },

    updateCardPrintOrder: async (id: string, data: {
      status?: string;
      notes?: string;
      trackingInfo?: string;
    }): Promise<{ order: any; message: string }> => {
      return request(`/platform/card-print-orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
  },

  // Tenant APIs (scoped)
  tenant: {
    // Dashboard
    getDashboardStats: async (tenantSlug: string): Promise<DashboardStats> => {
      return request(`/t/${tenantSlug}/reports/dashboard`);
    },

    // Billing
    subscribe: async (tenantSlug: string, planId: string, paymentMethodId?: string): Promise<{ checkoutUrl?: string; redirectUrl?: string; message?: string; subscriptionId?: string }> => {
      const body: any = { planId };
      if (paymentMethodId) {
        body.paymentMethodId = paymentMethodId;
      }
      
      return request(`/t/${tenantSlug}/billing/subscribe`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    getBillingPortal: async (tenantSlug: string): Promise<{ portalUrl: string }> => {
      return request(`/t/${tenantSlug}/billing/portal`);
    },

    getPaymentMethods: async (tenantSlug: string): Promise<{ paymentMethods: any[] }> => {
      return request(`/t/${tenantSlug}/billing/payment-methods`);
    },

    createSetupIntent: async (tenantSlug: string): Promise<{ clientSecret: string; setupIntentId: string; demo?: boolean; message?: string }> => {
      return request(`/t/${tenantSlug}/billing/setup-intent`, {
        method: 'POST',
      });
    },

    deletePaymentMethod: async (tenantSlug: string, paymentMethodId: string): Promise<{ message: string }> => {
      return request(`/t/${tenantSlug}/billing/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
      });
    },
createPaymentIntent: async (token: string): Promise<any> => {
  return request(`/purchase-transactions/create-payment-intent/${token}`, {
    method: 'POST',
  });
},


    setDefaultPaymentMethod: async (tenantSlug: string, paymentMethodId: string): Promise<{ message: string }> => {
      return request(`/t/${tenantSlug}/billing/payment-methods/${paymentMethodId}/set-default`, {
        method: 'POST',
      });
    },

    getInvoices: async (tenantSlug: string): Promise<{ invoices: any[] }> => {
      return request(`/t/${tenantSlug}/billing/invoices`);
    },

    getUsageStats: async (tenantSlug: string): Promise<{ usage: any }> => {
      return request(`/t/${tenantSlug}/billing/usage`);
    },

    addCustomerFunds: async (tenantSlug: string, customerId: string, amountCents: number): Promise<{ checkoutUrl: string }> => {
      return request(`/t/${tenantSlug}/customers/${customerId}/add-funds`, {
        method: 'POST',
        body: JSON.stringify({ amountCents }),
      });
    },

    getTenant: async (tenantSlug: string): Promise<{ tenant: Tenant }> => {
      return request(`/t/${tenantSlug}/tenant`);
    },

    // Customers
    getCustomers: async (tenantSlug: string, params?: string): Promise<{ customers: Customer[]; total: number; page: number; pages: number }> => {
      const query = params ? `?${params}` : '';
      return request(`/t/${tenantSlug}/customers${query}`);
    },

    getCustomer: async (tenantSlug: string, id: string): Promise<Customer> => {
      return request(`/t/${tenantSlug}/customers/${id}`);
    },

    createCustomer: async (tenantSlug: string, customerData: Partial<Customer>): Promise<{ customer: Customer }> => {
      return request(`/t/${tenantSlug}/customers`, {
        method: 'POST',
        body: JSON.stringify(customerData),
      });
    },

    updateCustomer: async (tenantSlug: string, id: string, customerData: Partial<Customer>): Promise<{ customer: Customer }> => {
      return request(`/t/${tenantSlug}/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(customerData),
      });
    },

    deleteCustomer: async (tenantSlug: string, id: string): Promise<{ message: string }> => {
      return request(`/t/${tenantSlug}/customers/${id}`, {
        method: 'DELETE',
      });
    },

    getAvailableCustomers: async (tenantSlug: string, search?: string): Promise<{ customers: Customer[] }> => {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      return request(`/t/${tenantSlug}/customers/available${query}`);
    },

    // Customer own profile endpoints (for customer role users)
    getMyProfile: async (tenantSlug: string): Promise<{ customer: Customer }> => {
      return request(`/t/${tenantSlug}/customers/me`);
    },

    getMyCards: async (tenantSlug: string): Promise<{ cards: Card[] }> => {
      return request(`/t/${tenantSlug}/customers/me/cards`);
    },

    getMyTransactions: async (tenantSlug: string): Promise<{ transactions: Transaction[] }> => {
      return request(`/t/${tenantSlug}/customers/me/transactions`);
    },

    // Cards
    getCards: async (tenantSlug: string, params?: string): Promise<{ cards: Card[]; total: number; page: number; pages: number }> => {
      const query = params ? `?${params}` : '';
      return request(`/t/${tenantSlug}/cards${query}`);
    },

    getCard: async (tenantSlug: string, cardUid: string): Promise<Card> => {
      // Use POS-specific endpoint that ensures proper authorization for cashiers
      return request(`/t/${tenantSlug}/cards/lookup/${cardUid}`);
    },

    getCardByUid: async (cardUid: string): Promise<Card> => {
      return request(`/cards/${cardUid}`);
    },

    createCardBatch: async (tenantSlug: string, count: number, storeId?: string): Promise<{ cards: Card[]; message: string }> => {
      return request(`/t/${tenantSlug}/cards/batch`, {
        method: 'POST',
        body: JSON.stringify({ count, storeId }),
      });
    },

    activateCard: async (tenantSlug: string, cardUid: string, customerData: any, storeId: string, customerId?: string): Promise<{ card: Card; message: string }> => {
      const body: any = {
        cardUid,
        storeId,
      };
      
      if (customerId) {
        body.customerId = customerId;
      } else {
        body.customer = customerData;
      }

      return request(`/t/${tenantSlug}/cards/activate`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    blockCard: async (tenantSlug: string, cardUid: string, data: { reason?: string }): Promise<{ card: Card; message: string }> => {
      return request(`/t/${tenantSlug}/cards/${cardUid}/block`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateCardStore: async (tenantSlug: string, cardUid: string, storeId: string): Promise<{ card: Card; message: string }> => {
      return request(`/t/${tenantSlug}/cards/${cardUid}/store`, {
        method: 'PUT',
        body: JSON.stringify({ storeId }),
      });
    },

    // QR Code Downloads
    downloadQRCode: async (tenantSlug: string, cardUid: string, format: string = 'png', size: string = '300'): Promise<Blob> => {
      const response = await fetch(`${API_BASE_URL}/t/${tenantSlug}/cards/${cardUid}/qr/download?format=${format}&size=${size}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new ApiError(`Failed to download QR code: ${response.statusText}`, response.status);
      }

      return response.blob();
    },

    downloadBulkQRCodes: async (tenantSlug: string, cardUids: string[], options: {
      format?: string;
      size?: string;
      includeLabels?: boolean;
    } = {}): Promise<Blob> => {
      const response = await fetch(`${API_BASE_URL}/t/${tenantSlug}/cards/qr/bulk-download`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardUids,
          format: options.format || 'png',
          size: options.size || '300',
          includeLabels: options.includeLabels !== false,
        }),
      });

      if (!response.ok) {
        throw new ApiError(`Failed to download bulk QR codes: ${response.statusText}`, response.status);
      }

      return response.blob();
    },

    downloadPrintReadyQRCodes: async (tenantSlug: string, cardUids: string[], options: {
      printFormat?: string;
      cardsPerPage?: number;
    } = {}): Promise<Blob> => {
      const response = await fetch(`${API_BASE_URL}/t/${tenantSlug}/cards/qr/print-ready`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardUids,
          printFormat: options.printFormat || 'standard',
          cardsPerPage: options.cardsPerPage || 8,
        }),
      });

      if (!response.ok) {
        throw new ApiError(`Failed to download print-ready QR codes: ${response.statusText}`, response.status);
      }

      return response.blob();
    },

    // Transactions
    getTransactions: async (tenantSlug: string, params?: string): Promise<{ transactions: Transaction[]; total: number; page: number; pages: number }> => {
      const query = params ? `?${params}` : '';
      return request(`/t/${tenantSlug}/transactions${query}`);
    },

    earnCashback: async (
      tenantSlug: string,
      cardUid: string, 
      amountCents: number, 
      category: 'PURCHASE' | 'REPAIR' | 'OTHER',
      storeId: string,
      note?: string
    ): Promise<{ transaction: Transaction; message: string; cashbackEarned: number; newBalance: number }> => {
      return request(`/t/${tenantSlug}/transactions/earn`, {
        method: 'POST',
        body: JSON.stringify({
          cardUid,
          amountCents,
          category,
          storeId,
          note,
        }),
      });
    },

    redeemCashback: async (
      tenantSlug: string,
      cardUid: string, 
      amountCents: number,
      storeId: string,
      note?: string
    ): Promise<{ transaction: Transaction; message: string; amountRedeemed: number; newBalance: number }> => {
      return request(`/t/${tenantSlug}/transactions/redeem`, {
        method: 'POST',
        body: JSON.stringify({
          cardUid,
          amountCents,
          storeId,
          note,
        }),
      });
    },

    // Add funds to card (Store Credit)
    addFundsToCard: async (
      tenantSlug: string,
      cardUid: string,
      amountCents: number,
      storeId: string,
      paymentMethod: 'CASH' | 'CARD' | 'QR_PAYMENT',
      note?: string
    ): Promise<{ transaction: Transaction; message: string; amountAdded: number; newBalance: number; paymentUrl?: string; paymentLink?: any }> => {
      // For CASH, use the direct add-funds endpoint
      if (paymentMethod === 'CASH') {
        return request(`/t/${tenantSlug}/transactions/add-funds`, {
          method: 'POST',
          body: JSON.stringify({
            cardUid,
            amountCents,
            storeId,
            paymentMethod,
            note,
          }),
        });
      } else {
        // For CARD and QR_PAYMENT, use the add-credit endpoint that creates payment links
        return request(`/t/${tenantSlug}/purchase-transactions/add-credit`, {
          method: 'POST',
          body: JSON.stringify({
            cardUid,
            amountCents,
            storeId,
            paymentMethod,
            description: note,
          }),
        });
      }
    },

    // Purchase Transactions
    createPurchaseTransaction: async (
      tenantSlug: string,
      data: {
        cardUid?: string;
        customerId?: string;
        amountCents: number;
        category: 'PURCHASE' | 'REPAIR' | 'OTHER';
        description?: string;
        paymentMethod: 'COD' | 'QR_PAYMENT' | 'CASH' | 'CARD';
        customerInfo?: {
          firstName: string;
          lastName: string;
          email?: string;
          phone?: string;
        };
      }
    ): Promise<{ success: boolean; message: string; transaction: any; paymentUrl?: string }> => {
      return request(`/t/${tenantSlug}/purchase-transactions/create`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    confirmPayment: async (
      tenantSlug: string,
      purchaseTransactionId: string
    ): Promise<{ success: boolean; message: string; transaction: any }> => {
      return request(`/t/${tenantSlug}/purchase-transactions/confirm-payment`, {
        method: 'POST',
        body: JSON.stringify({ purchaseTransactionId }),
      });
    },

    getPurchaseTransactions: async (
      tenantSlug: string,
      params?: string
    ): Promise<{ transactions: any[]; total: number; page: number; pages: number }> => {
      const query = params ? `?${params}` : '';
      return request(`/t/${tenantSlug}/purchase-transactions${query}`);
    },

    getPaymentLink: async (token: string): Promise<{ paymentLink: any; transaction: any }> => {
      // Use a direct fetch without auth for public payment links
      const url = `${API_BASE_URL}/purchase-transactions/payment-link/${token}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new ApiError(`HTTP error! status: ${response.status}`, response.status);
      }
      
      return response.json();
    },

    processPaymentLink: async (token: string): Promise<{ success: boolean; message: string; transaction: any }> => {
      // Use a direct fetch without auth for public payment processing
      const url = `${API_BASE_URL}/purchase-transactions/pay/${token}`;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new ApiError(`HTTP error! status: ${response.status}`, response.status);
      }
      
      return response.json();
    },

    // Stores
    getStores: async (tenantSlug: string): Promise<{ stores: Store[] }> => {
      return request(`/t/${tenantSlug}/stores`);
    },

    createStore: async (tenantSlug: string, storeData: Partial<Store>): Promise<{ store: Store }> => {
      return request(`/t/${tenantSlug}/stores`, {
        method: 'POST',
        body: JSON.stringify(storeData),
      });
    },

    updateStore: async (tenantSlug: string, id: string, storeData: Partial<Store>): Promise<{ store: Store }> => {
      return request(`/t/${tenantSlug}/stores/${id}`, {
        method: 'PUT',
        body: JSON.stringify(storeData),
      });
    },

    // Users/Staff
    getUsers: async (tenantSlug: string): Promise<{ users: User[] }> => {
      return request(`/t/${tenantSlug}/users`);
    },

    createUser: async (tenantSlug: string, userData: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: 'tenant_admin' | 'cashier' | 'customer';
      storeId?: string;
    }): Promise<{ user: User }> => {
      return request(`/t/${tenantSlug}/users`, {
        method: 'POST',
        body: JSON.stringify(userData),
      });
    },

    updateUser: async (tenantSlug: string, id: string, userData: {
      firstName?: string;
      lastName?: string;
      role?: 'tenant_admin' | 'cashier' | 'customer';
      storeId?: string;
      active?: boolean;
    }): Promise<{ user: User }> => {
      return request(`/t/${tenantSlug}/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      });
    },

    changeUserPassword: async (tenantSlug: string, id: string, password: string): Promise<{ message: string }> => {
      return request(`/t/${tenantSlug}/users/${id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password }),
      });
    },

    // Rules
    getCashbackRules: async (tenantSlug: string): Promise<{ rules: CashbackRule[] }> => {
      return request(`/t/${tenantSlug}/rules/cashback`);
    },

    updateCashbackRules: async (tenantSlug: string, rules: CashbackRule[]): Promise<{ rules: CashbackRule[] }> => {
      return request(`/t/${tenantSlug}/rules/cashback`, {
        method: 'PUT',
        body: JSON.stringify({ rules }),
      });
    },

    getTierRules: async (tenantSlug: string): Promise<{ rules: TierRule[] }> => {
      return request(`/t/${tenantSlug}/rules/tiers`);
    },

    updateTierRules: async (tenantSlug: string, rules: TierRule[]): Promise<{ rules: TierRule[] }> => {
      return request(`/t/${tenantSlug}/rules/tiers`, {
        method: 'PUT',
        body: JSON.stringify({ rules }),
      });
    },

    initializeDefaultRules: async (tenantSlug: string): Promise<{ message: string; cashbackRules: CashbackRule[]; tierRules: TierRule[] }> => {
      return request(`/t/${tenantSlug}/rules/initialize`, {
        method: 'POST',
      });
    },

    getOffers: async (tenantSlug: string): Promise<{ offers: Offer[] }> => {
      return request(`/t/${tenantSlug}/rules/offers`);
    },

    createOffer: async (tenantSlug: string, offerData: Partial<Offer>): Promise<{ offer: Offer }> => {
      return request(`/t/${tenantSlug}/rules/offers`, {
        method: 'POST',
        body: JSON.stringify(offerData),
      });
    },

    updateOffer: async (tenantSlug: string, id: string, offerData: Partial<Offer>): Promise<{ offer: Offer }> => {
      return request(`/t/${tenantSlug}/rules/offers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(offerData),
      });
    },

    // Reports
    exportCustomers: async (tenantSlug: string): Promise<Blob> => {
      const response = await fetch(`${API_BASE_URL}/t/${tenantSlug}/reports/export/customers`, {
        credentials: 'include',
      });
      return response.blob();
    },

    exportTransactions: async (tenantSlug: string, params?: string): Promise<Blob> => {
      const query = params ? `?${params}` : '';
      const response = await fetch(`${API_BASE_URL}/t/${tenantSlug}/reports/export/transactions${query}`, {
        credentials: 'include',
      });
      return response.blob();
    },

    // Card Orders
    getCardOrders: async (tenantSlug: string, params?: string): Promise<{ orders: any[]; pagination: any }> => {
      const query = params ? `?${params}` : '';
      return request(`/t/${tenantSlug}/card-orders${query}`);
    },

    createCardOrder: async (tenantSlug: string, orderData: {
      cardType: 'SINGLE_SIDED' | 'DOUBLE_SIDED_CUSTOM';
      quantity: number;
      storeName?: string;
      storePhone?: string;
      storeAddress?: string;
      customDesign?: string;
      shippingAddress: string;
    }): Promise<{ order: any }> => {
      return request(`/t/${tenantSlug}/card-orders`, {
        method: 'POST',
        body: JSON.stringify(orderData),
      });
    },

    createCardOrderCheckout: async (tenantSlug: string, orderData: {
      cardType: 'SINGLE_SIDED' | 'DOUBLE_SIDED_CUSTOM';
      quantity: number;
      storeName?: string;
      storePhone?: string;
      storeAddress?: string;
      customDesign?: string;
      shippingAddress: string;
    }): Promise<{ checkoutUrl: string; orderId: string; sessionId: string }> => {
      return request(`/t/${tenantSlug}/card-orders/checkout`, {
        method: 'POST',
        body: JSON.stringify(orderData),
      });
    },

    getCardOrder: async (tenantSlug: string, orderId: string): Promise<{ order: any }> => {
      return request(`/t/${tenantSlug}/card-orders/${orderId}`);
    },

    cancelCardOrder: async (tenantSlug: string, orderId: string): Promise<{ order: any }> => {
      return request(`/t/${tenantSlug}/card-orders/${orderId}`, {
        method: 'DELETE',
      });
    },

    getCardPricing: async (): Promise<{ prices: { SINGLE_SIDED: number; DOUBLE_SIDED_CUSTOM: number }; currency: string }> => {
      return request('/card-orders/pricing');
    },

    // Card Print Orders
    getCardPrintOrders: async (tenantSlug: string, params?: string): Promise<{ orders: any[]; pagination: any }> => {
      const query = params ? `?${params}` : '';
      return request(`/t/${tenantSlug}/card-print-orders${query}`);
    },

    createCardPrintOrder: async (tenantSlug: string, data: {
      quantity: number;
      storeName: string;
      storeAddress?: string;
      deliveryMethod?: 'PICKUP' | 'DELIVERY';
      deliveryAddress?: string;
      notes?: string;
    }): Promise<{ order: any; message: string }> => {
      return request(`/t/${tenantSlug}/card-print-orders`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getCardPrintOrder: async (tenantSlug: string, orderId: string): Promise<{ order: any }> => {
      return request(`/t/${tenantSlug}/card-print-orders/${orderId}`);
    },

    updateCardPrintOrder: async (tenantSlug: string, orderId: string, data: {
      deliveryMethod?: 'PICKUP' | 'DELIVERY';
      deliveryAddress?: string;
    }): Promise<{ order: any; message: string }> => {
      return request(`/t/${tenantSlug}/card-print-orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    collectCardPrintOrder: async (tenantSlug: string, orderId: string): Promise<{ order: any; message: string }> => {
      return request(`/t/${tenantSlug}/card-print-orders/${orderId}/collect`, {
        method: 'POST',
      });
    },

    // Admin methods for tenant-scoped card print order management
    adminUpdateCardPrintOrderStatus: async (tenantSlug: string, id: string, data: {
      status: string;
      notes?: string;
      trackingInfo?: string;
      printedAt?: string;
      deliveredAt?: string;
    }): Promise<{ order: any; message: string }> => {
      return request(`/t/${tenantSlug}/admin/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    adminGetAllCardPrintOrders: async (tenantSlug: string, params?: string): Promise<{ orders: any[]; pagination: any }> => {
      const query = params ? `?${params}` : '';
      return request(`/t/${tenantSlug}/admin/all${query}`);
    },

    adminGetCardPrintOrder: async (tenantSlug: string, id: string): Promise<{ order: any }> => {
      return request(`/t/${tenantSlug}/admin/${id}`);
    },

    adminCancelCardPrintOrder: async (tenantSlug: string, id: string): Promise<{ order: any; message: string }> => {
      return request(`/t/${tenantSlug}/admin/${id}`, {
        method: 'DELETE',
      });
    },
  },

  // Public card view (tenant-scoped)
  getPublicCard: async (tenantSlug: string, cardUid: string): Promise<Card> => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('t');
    const url = `/${tenantSlug}/c/${cardUid}${token ? `?t=${token}` : ''}`;
    return request(url);
  },
};

export { ApiError };