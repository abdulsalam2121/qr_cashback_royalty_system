import { DashboardStats, Transaction, Customer, Store, PlatformStats, CashbackRule, TierRule, Tenant, Plan } from '../types';

// Mock data generator
export const mockApi = {
  // Dashboard stats for different tenants
  getDashboardStats: (tenantSlug: string): DashboardStats => {
    const baseStats = {
      'alpha-shop': {
        totalCustomers: 125,
        totalCards: 150,
        totalTransactions: 342,
        totalCashbackIssued: 1250000, // $12,500 in cents
        totalCashbackRedeemed: 350000, // $3,500 in cents
        activeOffers: 3
      },
      'beta-repairs': {
        totalCustomers: 45,
        totalCards: 50,
        totalTransactions: 89,
        totalCashbackIssued: 280000, // $2,800 in cents
        totalCashbackRedeemed: 120000, // $1,200 in cents
        activeOffers: 1
      }
    };

    return baseStats[tenantSlug as keyof typeof baseStats] || baseStats['alpha-shop'];
  },

  // Recent transactions
  getTransactions: (tenantSlug: string): Transaction[] => {
    const baseTransactions = [
      {
        id: '1',
        type: 'EARN' as const,
        category: 'PURCHASE' as const,
        amountCents: 5000,
        cashbackCents: 250,
        beforeBalanceCents: 1000,
        afterBalanceCents: 1250,
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
        note: 'iPhone case purchase',
        storeName: tenantSlug === 'alpha-shop' ? 'Alpha Main Store' : 'Beta Repair Center',
        customerName: 'John Doe',
        cardUid: 'CARD001',
        customerId: 'cust1'
      },
      {
        id: '2',
        type: 'REDEEM' as const,
        category: 'OTHER' as const,
        amountCents: 0,
        cashbackCents: -500,
        beforeBalanceCents: 1250,
        afterBalanceCents: 750,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        note: 'Redeemed for discount',
        storeName: tenantSlug === 'alpha-shop' ? 'Alpha Main Store' : 'Beta Repair Center',
        customerName: 'Jane Smith',
        cardUid: 'CARD002',
        customerId: 'cust2'
      },
      {
        id: '3',
        type: 'EARN' as const,
        category: tenantSlug === 'alpha-shop' ? 'PURCHASE' as const : 'REPAIR' as const,
        amountCents: 15000,
        cashbackCents: 750,
        beforeBalanceCents: 500,
        afterBalanceCents: 1250,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
        note: tenantSlug === 'alpha-shop' ? 'Phone accessories bundle' : 'Screen repair service',
        storeName: tenantSlug === 'alpha-shop' ? 'Alpha Main Store' : 'Beta Repair Center',
        customerName: 'Mike Johnson',
        cardUid: 'CARD003',
        customerId: 'cust3'
      },
      {
        id: '4',
        type: 'EARN' as const,
        category: 'PURCHASE' as const,
        amountCents: 8000,
        cashbackCents: 400,
        beforeBalanceCents: 200,
        afterBalanceCents: 600,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
        note: 'Wireless charger',
        storeName: tenantSlug === 'alpha-shop' ? 'Alpha Branch Store' : 'Beta Repair Center',
        customerName: 'Sarah Wilson',
        cardUid: 'CARD004',
        customerId: 'cust4'
      },
      {
        id: '5',
        type: 'EARN' as const,
        category: tenantSlug === 'alpha-shop' ? 'PURCHASE' as const : 'REPAIR' as const,
        amountCents: 25000,
        cashbackCents: 1250,
        beforeBalanceCents: 800,
        afterBalanceCents: 2050,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
        note: tenantSlug === 'alpha-shop' ? 'Premium phone case set' : 'Water damage repair',
        storeName: tenantSlug === 'alpha-shop' ? 'Alpha Main Store' : 'Beta Repair Center',
        customerName: 'David Brown',
        cardUid: 'CARD005',
        customerId: 'cust5'
      }
    ];

    return baseTransactions;
  },

  // Mock customers
  getCustomers: (): Customer[] => {
    const customers: Customer[] = [
      {
        id: 'cust1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@email.com',
        phone: '+1234567890',
        tier: 'GOLD',
        totalSpend: 150000, // $1,500
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        cards: [{
          id: 'card1',
          cardUid: 'CARD001',
          customerId: 'cust1',
          activatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 25).toISOString(),
          status: 'ACTIVE',
          balanceCents: 1250,
          qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=CARD001'
        }]
      },
      {
        id: 'cust2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@email.com',
        phone: '+1234567891',
        tier: 'PLATINUM',
        totalSpend: 250000, // $2,500
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
        cards: [{
          id: 'card2',
          cardUid: 'CARD002',
          customerId: 'cust2',
          activatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
          status: 'ACTIVE',
          balanceCents: 750,
          qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=CARD002'
        }]
      },
      {
        id: 'cust3',
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike.johnson@email.com',
        tier: 'SILVER',
        totalSpend: 75000, // $750
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
        cards: [{
          id: 'card3',
          cardUid: 'CARD003',
          customerId: 'cust3',
          activatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
          status: 'ACTIVE',
          balanceCents: 1250,
          qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=CARD003'
        }]
      }
    ];

    return customers;
  },

  // Mock stores
  getStores: (tenantSlug: string): Store[] => {
    const stores = {
      'alpha-shop': [
        {
          id: 'store1',
          name: 'Alpha Main Store',
          address: '123 Main St, Downtown',
          active: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 100).toISOString(),
          _count: {
            users: 5,
            cards: 120,
            transactions: 280
          }
        },
        {
          id: 'store2',
          name: 'Alpha Branch Store',
          address: '456 Oak Ave, Uptown',
          active: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 80).toISOString(),
          _count: {
            users: 3,
            cards: 30,
            transactions: 62
          }
        }
      ],
      'beta-repairs': [
        {
          id: 'store3',
          name: 'Beta Repair Center',
          address: '789 Tech Blvd, Innovation District',
          active: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
          _count: {
            users: 2,
            cards: 50,
            transactions: 89
          }
        }
      ]
    };

    return stores[tenantSlug as keyof typeof stores] || [];
  },

  // Platform stats (for platform admin)
  getPlatformStats: (): PlatformStats => ({
    totalTenants: 2,
    activeTenants: 2,
    totalRevenue: 1250000, // $12,500
    monthlyRevenue: 350000, // $3,500
    totalStores: 3,
    totalCustomers: 170
  }),

  // Platform tenants
  getPlatformTenants: (): Tenant[] => [
    {
      id: 'alpha-tenant-1',
      slug: 'alpha-shop',
      name: 'Alpha Phone Shop',
      createdAt: '2024-01-01T00:00:00.000Z',
      subscriptionStatus: 'ACTIVE',
      planId: 'pro-plan',
      _count: {
        stores: 2,
        users: 5,
        customers: 125,
        cards: 150
      }
    },
    {
      id: 'beta-tenant-1',
      slug: 'beta-repairs',
      name: 'Beta Mobile Repairs',
      createdAt: '2024-02-01T00:00:00.000Z',
      subscriptionStatus: 'TRIALING',
      trialEndsAt: '2024-03-01T00:00:00.000Z',
      _count: {
        stores: 1,
        users: 2,
        customers: 45,
        cards: 50
      }
    },
    {
      id: 'gamma-tenant-1',
      slug: 'gamma-electronics',
      name: 'Gamma Electronics',
      createdAt: '2024-01-15T00:00:00.000Z',
      subscriptionStatus: 'ACTIVE',
      planId: 'basic-plan',
      _count: {
        stores: 1,
        users: 3,
        customers: 67,
        cards: 89
      }
    }
  ],

  // Platform plans
  getPlatformPlans: (): Plan[] => [
    {
      id: 'basic-plan',
      name: 'Basic Plan',
      description: 'Perfect for small businesses getting started',
      priceMonthly: 2900, // $29 in cents
      stripePriceId: 'price_basic_monthly',
      features: [
        'Up to 1 store location',
        'Up to 3 staff members', 
        'Up to 100 loyalty cards',
        'Basic analytics',
        'Email support'
      ],
      limits: {
        stores: 1,
        staff: 3,
        cards: 100,
        transactions: 1000
      }
    },
    {
      id: 'pro-plan',
      name: 'Pro Plan',
      description: 'For growing businesses with multiple locations',
      priceMonthly: 7900, // $79 in cents
      stripePriceId: 'price_pro_monthly',
      features: [
        'Up to 5 store locations',
        'Up to 15 staff members',
        'Up to 1000 loyalty cards',
        'Advanced analytics',
        'Priority support',
        'Custom branding'
      ],
      limits: {
        stores: 5,
        staff: 15,
        cards: 1000,
        transactions: 10000
      }
    },
    {
      id: 'enterprise-plan',
      name: 'Enterprise Plan',
      description: 'For large businesses with complex needs',
      priceMonthly: 19900, // $199 in cents
      stripePriceId: 'price_enterprise_monthly',
      features: [
        'Unlimited store locations',
        'Unlimited staff members',
        'Unlimited loyalty cards',
        'Full analytics suite',
        'Dedicated support',
        'Custom integrations',
        'White-label solution'
      ],
      limits: {
        stores: -1, // Unlimited
        staff: -1,
        cards: -1,
        transactions: -1
      }
    }
  ],

  // Mock cashback rules
  getCashbackRules: (): CashbackRule[] => [
    {
      id: 'rule1',
      category: 'PURCHASE',
      baseRateBps: 500, // 5%
      isActive: true
    },
    {
      id: 'rule2',
      category: 'REPAIR',
      baseRateBps: 750, // 7.5%
      isActive: true
    },
    {
      id: 'rule3',
      category: 'OTHER',
      baseRateBps: 300, // 3%
      isActive: true
    }
  ],

  // Mock tier rules
  getTierRules: (): TierRule[] => [
    {
      id: 'tier1',
      tier: 'SILVER',
      name: 'Silver Tier',
      minTotalSpendCents: 0,
      baseRateBps: 10000, // 100% (1x)
      isActive: true
    },
    {
      id: 'tier2',
      tier: 'GOLD',
      name: 'Gold Tier',
      minTotalSpendCents: 100000, // $1,000
      baseRateBps: 12500, // 125% (1.25x)
      isActive: true
    },
    {
      id: 'tier3',
      tier: 'PLATINUM',
      name: 'Platinum Tier',
      minTotalSpendCents: 200000, // $2,000
      baseRateBps: 15000, // 150% (1.5x)
      isActive: true
    }
  ]
};
