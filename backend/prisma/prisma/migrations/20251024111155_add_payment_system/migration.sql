-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'QR_PAYMENT', 'CASH', 'CARD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "payment_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT,
    "cashierId" TEXT NOT NULL,
    "cardUid" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "cashbackCents" INTEGER DEFAULT 0,
    "category" "TxCategory" NOT NULL,
    "description" TEXT,
    "paymentLinkId" TEXT,
    "paymentLinkExpiry" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_links_token_key" ON "payment_links"("token");

-- CreateIndex
CREATE INDEX "payment_links_expiresAt_idx" ON "payment_links"("expiresAt");

-- CreateIndex
CREATE INDEX "payment_links_tenantId_idx" ON "payment_links"("tenantId");

-- CreateIndex
CREATE INDEX "payment_links_token_idx" ON "payment_links"("token");

-- CreateIndex
CREATE INDEX "purchase_transactions_createdAt_idx" ON "purchase_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "purchase_transactions_paymentStatus_idx" ON "purchase_transactions"("paymentStatus");

-- CreateIndex
CREATE INDEX "purchase_transactions_tenantId_idx" ON "purchase_transactions"("tenantId");

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_transactions" ADD CONSTRAINT "purchase_transactions_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_transactions" ADD CONSTRAINT "purchase_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_transactions" ADD CONSTRAINT "purchase_transactions_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "payment_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_transactions" ADD CONSTRAINT "purchase_transactions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_transactions" ADD CONSTRAINT "purchase_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
