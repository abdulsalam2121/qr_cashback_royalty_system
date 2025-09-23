-- CreateEnum
CREATE TYPE "CardPrintOrderStatus" AS ENUM ('CREATED', 'PRINTING_ACCEPTED', 'PRINTING_IN_PROGRESS', 'PRINTED', 'READY_FOR_DELIVERY', 'DELIVERED', 'READY_FOR_PICKUP', 'COLLECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('PICKUP', 'DELIVERY');

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "printOrderId" TEXT;

-- CreateTable
CREATE TABLE "card_print_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "CardPrintOrderStatus" NOT NULL DEFAULT 'CREATED',
    "notes" TEXT,
    "storeName" TEXT,
    "storeAddress" TEXT,
    "tenantAdminEmail" TEXT,
    "tenantAdminName" TEXT,
    "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'PICKUP',
    "deliveryAddress" TEXT,
    "trackingInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "printedAt" TIMESTAMP(3),
    "printedBy" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "deliveredBy" TEXT,
    "collectedAt" TIMESTAMP(3),
    "collectedBy" TEXT,

    CONSTRAINT "card_print_orders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_printOrderId_fkey" FOREIGN KEY ("printOrderId") REFERENCES "card_print_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_print_orders" ADD CONSTRAINT "card_print_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
