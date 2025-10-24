-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('DROPPED_OFF', 'IN_PROGRESS', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('STATUS_CHANGE', 'REMINDER', 'CUSTOM');

-- CreateTable
CREATE TABLE "repair_devices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "phoneModel" TEXT NOT NULL,
    "imei" TEXT,
    "issueDetails" TEXT NOT NULL,
    "accessories" TEXT,
    "status" "RepairStatus" NOT NULL DEFAULT 'DROPPED_OFF',
    "estimatedCost" INTEGER,
    "actualCost" INTEGER,
    "technicianNotes" TEXT,
    "droppedOffAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_status_history" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "oldStatus" "RepairStatus",
    "newStatus" "RepairStatus" NOT NULL,
    "changedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_notifications" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "status" "RepairStatus" NOT NULL,
    "sentVia" TEXT[],
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "smsSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "smsDelivered" BOOLEAN NOT NULL DEFAULT false,
    "emailDelivered" BOOLEAN NOT NULL DEFAULT false,
    "smsError" TEXT,
    "emailError" TEXT,
    "smsMessageId" TEXT,
    "emailMessageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repair_devices_tenantId_idx" ON "repair_devices"("tenantId");

-- CreateIndex
CREATE INDEX "repair_devices_customerId_idx" ON "repair_devices"("customerId");

-- CreateIndex
CREATE INDEX "repair_devices_status_idx" ON "repair_devices"("status");

-- CreateIndex
CREATE INDEX "repair_devices_droppedOffAt_idx" ON "repair_devices"("droppedOffAt");

-- CreateIndex
CREATE INDEX "repair_status_history_repairId_idx" ON "repair_status_history"("repairId");

-- CreateIndex
CREATE INDEX "repair_status_history_createdAt_idx" ON "repair_status_history"("createdAt");

-- CreateIndex
CREATE INDEX "repair_notifications_repairId_idx" ON "repair_notifications"("repairId");

-- CreateIndex
CREATE INDEX "repair_notifications_sentAt_idx" ON "repair_notifications"("sentAt");

-- AddForeignKey
ALTER TABLE "repair_devices" ADD CONSTRAINT "repair_devices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_devices" ADD CONSTRAINT "repair_devices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_status_history" ADD CONSTRAINT "repair_status_history_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "repair_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_notifications" ADD CONSTRAINT "repair_notifications_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "repair_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
