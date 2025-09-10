-- Add payments table for tracking all subscription payments
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeInvoiceId" TEXT,
    "stripePaymentIntentId" TEXT,
    "amount" INTEGER NOT NULL, -- Amount in cents
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL, -- paid, pending, failed, refunded
    "description" TEXT,
    "metadata" TEXT, -- JSON string for additional data
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE
);

-- Add subscription events table for tracking subscription lifecycle
CREATE TABLE IF NOT EXISTS "SubscriptionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL, -- created, updated, cancelled, reactivated
    "previousPlanId" TEXT,
    "stripeSubscriptionId" TEXT,
    "metadata" TEXT, -- JSON string for additional data
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE,
    FOREIGN KEY ("previousPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "Payment_tenantId_idx" ON "Payment"("tenantId");
CREATE INDEX IF NOT EXISTS "Payment_planId_idx" ON "Payment"("planId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_tenantId_idx" ON "SubscriptionEvent"("tenantId");
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_eventType_idx" ON "SubscriptionEvent"("eventType");
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_createdAt_idx" ON "SubscriptionEvent"("createdAt");
