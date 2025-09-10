# Card Limit & Ordering System Implementation

## Overview

This document outlines the complete implementation of a comprehensive card limit tracking and ordering system for the QR Cashback Loyalty Platform. The system enables platform administrators to set card allowances for subscription plans and allows tenant administrators to order physical cards within their allocated limits.

## Architecture & Components

### 1. Database Schema Changes

#### Enhanced Tenant Model
```sql
-- New fields added to tenants table
ALTER TABLE tenants ADD COLUMN subscriptionCardLimit INTEGER DEFAULT 0;    -- Cards from current subscription
ALTER TABLE tenants ADD COLUMN subscriptionCardsUsed INTEGER DEFAULT 0;    -- Cards used from subscription  
ALTER TABLE tenants ADD COLUMN totalCardAllowance INTEGER DEFAULT 40;      -- Total available cards
ALTER TABLE tenants ADD COLUMN currentCardBalance INTEGER DEFAULT 40;      -- Current available balance
```

#### Enhanced Plan Model
```sql
-- New fields added to plans table  
ALTER TABLE plans ADD COLUMN cardAllowance INTEGER DEFAULT 0;              -- Cards included with plan
ALTER TABLE plans ADD COLUMN allowCardOrdering BOOLEAN DEFAULT true;       -- Whether plan allows ordering
```

#### Enhanced Card Order Model
```sql
-- New fields added to card_orders table
ALTER TABLE card_orders ADD COLUMN sourceType OrderSourceType DEFAULT 'SUBSCRIPTION';
ALTER TABLE card_orders ADD COLUMN deductFromBalance BOOLEAN DEFAULT true;
ALTER TABLE card_orders ADD COLUMN approvedAt TIMESTAMP;
ALTER TABLE card_orders ADD COLUMN approvedBy TEXT;
-- Plus payment tracking fields (stripeSessionId, stripePaymentId, paidAt)
```

#### New Card Limit Transaction Model
```sql
CREATE TABLE card_limit_transactions (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    type CardLimitTransactionType NOT NULL,     -- GRANTED, USED, REFUNDED, EXPIRED
    source CardLimitTransactionSource NOT NULL, -- TRIAL, SUBSCRIPTION_UPGRADE, CARD_ORDER, MANUAL_ADJUSTMENT
    amount INTEGER NOT NULL,                     -- Positive for additions, negative for deductions
    previousBalance INTEGER NOT NULL,
    newBalance INTEGER NOT NULL,
    description TEXT,
    relatedOrderId TEXT,                         -- Links to card order
    relatedPlanId TEXT,                          -- Links to subscription plan
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createdBy TEXT
);
```

### 2. Core Service Layer

#### CardLimitService
The central service managing all card balance operations:

```typescript
class CardLimitService {
    // Get current card balance for a tenant
    static async getCardBalance(tenantId: string)
    
    // Update card balance with audit trail
    static async updateCardBalance(update: CardLimitUpdate)
    
    // Grant cards from subscription upgrade
    static async grantSubscriptionCards(tenantId, planId, cardAllowance, createdBy)
    
    // Use cards for order (deduct from balance)
    static async useCardsForOrder(tenantId, orderId, quantity, createdBy)
    
    // Refund cards from cancelled order
    static async refundCardsFromOrder(tenantId, orderId, quantity, createdBy)
    
    // Check if tenant can order cards
    static async canOrderCards(tenantId: string, quantity: number)
    
    // Get transaction history
    static async getTransactionHistory(tenantId: string, limit = 50)
}
```

### 3. API Endpoints

#### Card Orders API (`/api/t/:tenantSlug/card-orders`)

##### Core Endpoints
- `GET /` - List orders for tenant
- `POST /` - Create new card order with balance checking
- `GET /pricing` - Get card pricing information
- `GET /eligibility` - Check ordering eligibility and balance
- `GET /balance` - Get current card balance and limits
- `GET /balance/history` - Get card limit transaction history

##### Platform Admin Endpoints  
- `POST /:id/approve` - Approve pending order
- `POST /:id/reject` - Reject order and refund cards
- `PUT /:id` - Update order status and tracking

#### Platform API (`/api/platform`)

##### Enhanced Plan Management
- `POST /plans` - Create plan with card allowance settings
- `PUT /plans/:id` - Update plan including card allowance
- `GET /plans` - List plans with card allowance info

##### Order Management
- `GET /card-orders` - View all orders across tenants

### 4. Business Logic Flow

#### Subscription Upgrade Process
1. Tenant admin selects a plan
2. System validates plan and creates subscription
3. **NEW**: Cards are automatically granted based on plan's `cardAllowance`
4. Card limit transaction is created for audit trail
5. Tenant's `currentCardBalance` is updated

#### Card Ordering Process
1. Tenant admin initiates card order
2. System checks `canOrderCards()`:
   - Validates current balance
   - Checks if plan allows ordering
   - Verifies quantity available
3. If eligible, order is created with status `PENDING_APPROVAL`
4. Cards are deducted from balance (if `deductFromBalance: true`)
5. Platform admin approves/rejects order
6. If rejected, cards are refunded to tenant balance

#### Balance Calculation Logic
```typescript
// Current available balance calculation
currentBalance = totalCardAllowance - cardsUsedFromAllSources

// Total allowance calculation  
totalCardAllowance = freeTrialLimit + subscriptionCardLimit

// Subscription remaining
subscriptionRemaining = subscriptionCardLimit - subscriptionCardsUsed
```

### 5. Order Status Workflow

```
PENDING_PAYMENT (for paid orders)
    ↓
PENDING_APPROVAL (after payment/balance deduction)
    ↓
APPROVED (platform admin approval) / CANCELLED (rejection + refund)
    ↓  
PENDING (ready for fulfillment)
    ↓
PROCESSING (being prepared)
    ↓
SHIPPED (tracking number added)
    ↓
DELIVERED (final status)
```

### 6. Card Limit Transaction Types

#### Transaction Types
- **GRANTED**: Cards added to balance (subscription upgrade, manual adjustment)
- **USED**: Cards deducted for orders
- **REFUNDED**: Cards returned from cancelled orders
- **EXPIRED**: Cards removed due to expiration

#### Transaction Sources
- **TRIAL**: From initial trial allowance
- **SUBSCRIPTION_UPGRADE**: From plan subscription
- **CARD_ORDER**: From card ordering process
- **MANUAL_ADJUSTMENT**: Admin manual changes

### 7. Frontend Integration Points

#### Tenant Dashboard Enhancements
- Card balance display with breakdown (trial vs subscription)
- Order cards button with eligibility checking
- Order history with status tracking
- Balance transaction history

#### Platform Admin Dashboard
- Plan creation form with card allowance settings
- Order approval queue
- Tenant card usage analytics
- Bulk card limit adjustments

### 8. Security & Validation

#### Access Control
- Tenant admins can only access their own orders and balance
- Platform admins can access all orders and approve/reject
- Card balance deductions require proper authorization

#### Validation Rules
- Orders cannot exceed available balance
- Plans must have valid card allowance (≥ 0)
- Balance transactions must maintain integrity
- Order status changes follow defined workflow

### 9. Configuration & Pricing

#### Card Pricing
```typescript
const CARD_PRICES = {
  SINGLE_SIDED: 2.10,      // $2.10 per card
  DOUBLE_SIDED_CUSTOM: 3.90 // $3.90 per card
};
```

#### Plan Card Allowances (Default)
- **Starter Plan**: 100 cards included
- **Professional Plan**: 500 cards included
- **Enterprise Plan**: 2000 cards included

### 10. Monitoring & Analytics

#### Key Metrics Tracked
- Card balance utilization per tenant
- Order approval/rejection rates
- Average order quantities
- Card usage patterns by plan type

#### Audit Trail
Complete transaction history provides:
- Who performed each action
- When balance changes occurred
- What triggered the change
- Links to related orders/plans

## Implementation Benefits

### For Platform Administrators
- **Revenue Control**: Set card limits to encourage plan upgrades
- **Order Management**: Centralized approval workflow
- **Usage Analytics**: Track card consumption patterns
- **Flexible Pricing**: Adjust card allowances per plan

### For Tenant Administrators  
- **Clear Visibility**: Real-time balance and usage tracking
- **Predictable Costs**: Know exactly how many cards are available
- **Easy Ordering**: Streamlined card ordering process
- **Usage History**: Complete audit trail of card activities

### Technical Benefits
- **Data Integrity**: Transactional updates ensure consistency
- **Audit Compliance**: Complete transaction history
- **Scalable Design**: Service-based architecture supports growth
- **Type Safety**: Full TypeScript implementation with proper validation

## Future Enhancements

### Potential Features
1. **Auto-reorder**: Automatic card ordering when balance is low
2. **Bulk Discounts**: Volume pricing for large orders
3. **Card Analytics**: Usage patterns and recommendations
4. **Multi-tenant Billing**: Consolidated billing for multiple tenants
5. **Card Templates**: Pre-designed card templates for orders

### API Extensions
1. **Webhooks**: Real-time notifications for balance changes
2. **Bulk Operations**: Mass card grants/adjustments
3. **Reporting API**: Advanced analytics endpoints
4. **Integration API**: Third-party card fulfillment services

This implementation provides a robust foundation for card limit management while maintaining flexibility for future business requirements and technical enhancements.
