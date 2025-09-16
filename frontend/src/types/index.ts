export interface User {
  id: string;
  email: string;
  role: 'platform_admin' | 'tenant_admin' | 'cashier' | 'customer';
  firstName?: string;
  lastName?: string;
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  storeId?: string;
  storeName?: string;
  active?: boolean;
  lastLogin?: string;
  createdAt?: string;
  store?: {
    id: string;
    name: string;
  };
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: 'NONE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  planId?: string;
  trialEndsAt?: string;
  graceEndsAt?: string;
  freeTrialActivations?: number;
  freeTrialCardsCreated?: number;
  freeTrialLimit?: number;
  stores?: Store[];
  subscriptionInfo?: {
    status: string;
    isActive: boolean;
    isTrial: boolean;
    planName: string | null;
    cardLimit: number;
    cardsUsed: number;
    cardsRemaining: number;
    showUpgradePrompt: boolean;
  };
  _count?: {
    stores: number;
    users: number;
    customers: number;
    cards: number;
  };
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  tier: 'SILVER' | 'GOLD' | 'PLATINUM';
  totalSpend: number;
  createdAt: string;
  cards: Card[];
}

export interface Card {
  id: string;
  cardUid: string;
  customerId?: string;
  customer?: Customer;
  activatedAt?: string;
  storeId?: string;
  storeName?: string;
  status: 'UNASSIGNED' | 'ACTIVE' | 'BLOCKED';
  balanceCents: number;
  qrUrl?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: 'EARN' | 'REDEEM' | 'ADJUST';
  category: 'PURCHASE' | 'REPAIR' | 'OTHER';
  amountCents: number;
  cashbackCents: number;
  beforeBalanceCents: number;
  afterBalanceCents: number;
  createdAt: string;
  note?: string;
  storeName: string;
  customerName: string;
  cardUid: string;
  customerId: string;
  store?: {
    name: string;
  };
}

export interface Store {
  id: string;
  name: string;
  address?: string;
  active: boolean;
  createdAt: string;
  _count?: {
    users: number;
    cards: number;
    transactions: number;
  };
}

export interface CashbackRule {
  id: string;
  category: 'PURCHASE' | 'REPAIR' | 'OTHER';
  baseRateBps: number;
  isActive: boolean;
}

export interface TierRule {
  id: string;
  tier: 'SILVER' | 'GOLD' | 'PLATINUM';
  name: string;
  minTotalSpendCents: number;
  baseRateBps: number;
  isActive: boolean;
}

export interface Offer {
  id: string;
  name: string;
  description?: string;
  rateMultiplierBps: number;
  startAt: string;
  endAt: string;
  isActive: boolean;
}

export interface DashboardStats {
  totalCustomers: number;
  totalCards: number;
  totalTransactions: number;
  totalCashbackIssued: number;
  totalCashbackRedeemed: number;
  activeOffers: number;
}

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalStores: number;
  totalCustomers: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  billingPeriod: 'monthly' | '3months' | '6months' | 'yearly';
  billingPeriodMultiplier: number; // 1 for monthly, 3 for 3months, 6 for 6months, 12 for yearly
  stripePriceId: string;
  features: string[];
  limits: {
    stores: number;
    staff: number;
    cards: number;
    transactions: number;
  };
}