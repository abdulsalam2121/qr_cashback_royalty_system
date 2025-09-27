-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('SINGLE_SIDED', 'DOUBLE_SIDED_CUSTOM');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'THREE_MONTHS', 'SIX_MONTHS', 'YEARLY');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "freeTrialActivations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "freeTrialCardsCreated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "freeTrialLimit" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "trialExpiredNotified" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "subscriptionStatus" SET DEFAULT 'TRIALING';

-- CreateTable
CREATE TABLE "card_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardType" "CardType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "storeName" TEXT,
    "storePhone" TEXT,
    "storeAddress" TEXT,
    "customDesign" TEXT,
    "shippingAddress" TEXT,
    "trackingNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "card_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "billingPeriodMultiplier" INTEGER NOT NULL DEFAULT 1,
    "stripePriceId" TEXT NOT NULL,
    "features" TEXT[],
    "maxStores" INTEGER NOT NULL DEFAULT -1,
    "maxStaff" INTEGER NOT NULL DEFAULT -1,
    "maxCards" INTEGER NOT NULL DEFAULT -1,
    "maxTransactions" INTEGER NOT NULL DEFAULT -1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_orders" ADD CONSTRAINT "card_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
