import { User, Customer, Card, Transaction, Store, DashboardStats, CashbackRule, TierRule, Offer, Tenant, PlatformStats, Plan } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log(`API Request: ${options.method || 'GET'} ${url}`);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  const config: RequestInit = {
    credentials: 'include',
    headers,
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    console.log(`API Response: ${response.status} ${response.statusText}`);
    
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
      console.log('API Response: No content (204)');
      return {} as T;
    }

    const data = await response.json();
    console.log('API Response Data:', data);
    return data;
  } catch (error) {
    console.error(`API Error for ${url}:`, error);
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
  },

  // Tenant APIs (scoped)
  tenant: {
    // Dashboard
    getDashboardStats: async (tenantSlug: string): Promise<DashboardStats> => {
      return request(`/t/${tenantSlug}/reports/dashboard`);
    },

    // Billing
    subscribe: async (tenantSlug: string, planId: string): Promise<{ checkoutUrl: string }> => {
      return request(`/t/${tenantSlug}/billing/subscribe`, {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });
    },

    getBillingPortal: async (tenantSlug: string): Promise<{ portalUrl: string }> => {
      return request(`/t/${tenantSlug}/billing/portal`);
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

    // Cards
    getCards: async (tenantSlug: string, params?: string): Promise<{ cards: Card[]; total: number; page: number; pages: number }> => {
      const query = params ? `?${params}` : '';
      return request(`/t/${tenantSlug}/cards${query}`);
    },

    getCard: async (tenantSlug: string, cardUid: string): Promise<Card> => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('t');
      const url = `/t/${tenantSlug}/cards/${cardUid}${token ? `?t=${token}` : ''}`;
      return request(url);
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

    updateCashbackRules: async (tenantSlug: string, rules: Partial<CashbackRule>[]): Promise<{ rules: CashbackRule[] }> => {
      return request(`/t/${tenantSlug}/rules/cashback`, {
        method: 'PUT',
        body: JSON.stringify({ rules }),
      });
    },

    getTierRules: async (tenantSlug: string): Promise<{ rules: TierRule[] }> => {
      return request(`/t/${tenantSlug}/rules/tiers`);
    },

    updateTierRules: async (tenantSlug: string, rules: Partial<TierRule>[]): Promise<{ rules: TierRule[] }> => {
      return request(`/t/${tenantSlug}/rules/tiers`, {
        method: 'PUT',
        body: JSON.stringify({ rules }),
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