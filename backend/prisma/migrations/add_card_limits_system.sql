-- Add card limit tracking and subscription management fields
-- This migration enhances the existing schema to support comprehensive card limit tracking

-- Add card limit tracking to tenants
ALTER TABLE "tenants" ADD COLUMN "subscriptionCardLimit" INTEGER DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN "subscriptionCardsUsed" INTEGER DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN "totalCardAllowance" INTEGER DEFAULT 40; -- trial + subscription cards
ALTER TABLE "tenants" ADD COLUMN "currentCardBalance" INTEGER DEFAULT 40;

-- Add card allowance fields to plans 
ALTER TABLE "plans" ADD COLUMN "cardAllowance" INTEGER DEFAULT 0; -- How many cards this plan provides
ALTER TABLE "plans" ADD COLUMN "allowCardOrdering" BOOLEAN DEFAULT true; -- Whether this plan allows ordering physical cards

-- Add tracking fields to card orders
ALTER TABLE "card_orders" ADD COLUMN "sourceType" VARCHAR(20) DEFAULT 'SUBSCRIPTION'; -- TRIAL, SUBSCRIPTION, ADDITIONAL
ALTER TABLE "card_orders" ADD COLUMN "deductFromBalance" BOOLEAN DEFAULT true; -- Whether to deduct from card balance
ALTER TABLE "card_orders" ADD COLUMN "approvedAt" TIMESTAMP;
ALTER TABLE "card_orders" ADD COLUMN "approvedBy" VARCHAR(255);

-- Create card limit transactions table for audit trail
CREATE TABLE "card_limit_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL, -- GRANTED, USED, REFUNDED, EXPIRED
    "source" VARCHAR(30) NOT NULL, -- TRIAL, SUBSCRIPTION_UPGRADE, CARD_ORDER, MANUAL_ADJUSTMENT
    "amount" INTEGER NOT NULL, -- Positive for additions, negative for deductions
    "previousBalance" INTEGER NOT NULL,
    "newBalance" INTEGER NOT NULL,
    "description" TEXT,
    "relatedOrderId" TEXT, -- Reference to card order if applicable
    "relatedPlanId" TEXT, -- Reference to plan if from subscription
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT, -- User who triggered this transaction
    
    CONSTRAINT "card_limit_transactions_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "card_limit_transactions_order_fkey" FOREIGN KEY ("relatedOrderId") REFERENCES "card_orders"("id") ON DELETE SET NULL,
    CONSTRAINT "card_limit_transactions_plan_fkey" FOREIGN KEY ("relatedPlanId") REFERENCES "plans"("id") ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX "card_limit_transactions_tenant_idx" ON "card_limit_transactions"("tenantId");
CREATE INDEX "card_limit_transactions_created_idx" ON "card_limit_transactions"("createdAt");
CREATE INDEX "card_limit_transactions_type_idx" ON "card_limit_transactions"("type");

-- Update existing tenants to have proper card balance (trial cards)
UPDATE "tenants" SET 
    "totalCardAllowance" = "freeTrialLimit",
    "currentCardBalance" = "freeTrialLimit" - "freeTrialCardsCreated",
    "subscriptionCardLimit" = 0,
    "subscriptionCardsUsed" = 0;

-- Update existing plans with default card allowances based on plan names
UPDATE "plans" SET "cardAllowance" = 100 WHERE "name" LIKE '%Starter%';
UPDATE "plans" SET "cardAllowance" = 500 WHERE "name" LIKE '%Professional%' OR "name" LIKE '%Pro%';
UPDATE "plans" SET "cardAllowance" = 2000 WHERE "name" LIKE '%Enterprise%';
UPDATE "plans" SET "allowCardOrdering" = true;
