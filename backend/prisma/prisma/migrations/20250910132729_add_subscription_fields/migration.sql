-- CreateEnum
CREATE TYPE "OrderSourceType" AS ENUM ('TRIAL', 'SUBSCRIPTION', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "CardLimitTransactionType" AS ENUM ('GRANTED', 'USED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CardLimitTransactionSource" AS ENUM ('TRIAL', 'SUBSCRIPTION_UPGRADE', 'CARD_ORDER', 'MANUAL_ADJUSTMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "OrderStatus" ADD VALUE 'APPROVED';

-- AlterTable
ALTER TABLE "card_orders" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "deductFromBalance" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "sourceType" "OrderSourceType" NOT NULL DEFAULT 'TRIAL',
ADD COLUMN     "stripePaymentId" TEXT,
ADD COLUMN     "stripeSessionId" TEXT;

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "allowCardOrdering" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cardAllowance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "currentCardBalance" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "previousPlanId" TEXT,
ADD COLUMN     "subscriptionCardLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subscriptionCardsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subscriptionStartDate" TIMESTAMP(3),
ADD COLUMN     "totalCardAllowance" INTEGER NOT NULL DEFAULT 40;

-- CreateTable
CREATE TABLE "card_limit_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "CardLimitTransactionType" NOT NULL,
    "source" "CardLimitTransactionSource" NOT NULL,
    "amount" INTEGER NOT NULL,
    "previousBalance" INTEGER NOT NULL,
    "newBalance" INTEGER NOT NULL,
    "description" TEXT,
    "relatedOrderId" TEXT,
    "relatedPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "card_limit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeInvoiceId" TEXT,
    "stripePaymentIntentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousPlanId" TEXT,
    "stripeSubscriptionId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");

-- CreateIndex
CREATE INDEX "payments_planId_idx" ON "payments"("planId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

-- CreateIndex
CREATE INDEX "subscription_events_tenantId_idx" ON "subscription_events"("tenantId");

-- CreateIndex
CREATE INDEX "subscription_events_eventType_idx" ON "subscription_events"("eventType");

-- CreateIndex
CREATE INDEX "subscription_events_createdAt_idx" ON "subscription_events"("createdAt");

-- AddForeignKey
ALTER TABLE "card_limit_transactions" ADD CONSTRAINT "card_limit_transactions_relatedOrderId_fkey" FOREIGN KEY ("relatedOrderId") REFERENCES "card_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_limit_transactions" ADD CONSTRAINT "card_limit_transactions_relatedPlanId_fkey" FOREIGN KEY ("relatedPlanId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_limit_transactions" ADD CONSTRAINT "card_limit_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_previousPlanId_fkey" FOREIGN KEY ("previousPlanId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
