import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Constants
const FREE_TRIAL_LIMIT = 40;
const SUBSCRIPTION_PRICE = 19.99;

/**
 * Track card activation and check trial limits
 */
export async function trackCardActivation(tenantId: string, cardId: string): Promise<{
  success: boolean;
  trialExceeded: boolean;
  activationsUsed: number;
  activationsRemaining: number;
  message?: string;
}> {
  try {
    // Get tenant info
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // If already on paid subscription, allow activation
    if (tenant.subscriptionStatus === 'ACTIVE') {
      return {
        success: true,
        trialExceeded: false,
        activationsUsed: tenant.freeTrialActivations,
        activationsRemaining: -1 // Unlimited
      };
    }

    // Check if trial limit exceeded
    if (tenant.freeTrialActivations >= tenant.freeTrialLimit) {
      return {
        success: false,
        trialExceeded: true,
        activationsUsed: tenant.freeTrialActivations,
        activationsRemaining: 0,
        message: `Free trial limit of ${tenant.freeTrialLimit} activations has been reached. Please upgrade to continue.`
      };
    }

    // Increment activation count
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        freeTrialActivations: {
          increment: 1
        }
      }
    });

    const newActivationCount = updatedTenant.freeTrialActivations;
    const remaining = tenant.freeTrialLimit - newActivationCount;

    // Check if trial just ended
    if (newActivationCount >= tenant.freeTrialLimit && !tenant.trialExpiredNotified) {
      await handleTrialExpired(tenantId);
    }
    // Send warning notifications at certain thresholds
    else if (remaining <= 5 && remaining > 0) {
      await sendTrialWarning(tenantId, remaining);
    }

    return {
      success: true,
      trialExceeded: false,
      activationsUsed: newActivationCount,
      activationsRemaining: remaining
    };

  } catch (error) {
    console.error('Error tracking card activation:', error);
    throw error;
  }
}

/**
 * Handle trial expiration
 */
async function handleTrialExpired(tenantId: string): Promise<void> {
  try {
    // Mark as notified
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { trialExpiredNotified: true }
    });

    console.log(`Trial expired for tenant ${tenantId}. Notification would be sent via email/dashboard.`);

  } catch (error) {
    console.error('Error handling trial expiration:', error);
  }
}

/**
 * Send trial warning notification
 */
async function sendTrialWarning(tenantId: string, activationsRemaining: number): Promise<void> {
  try {
    console.log(`Trial warning for tenant ${tenantId}: ${activationsRemaining} activations remaining`);
  } catch (error) {
    console.error('Error sending trial warning:', error);
  }
}

/**
 * Get trial status for a tenant
 */
export async function getTrialStatus(tenantId: string): Promise<{
  activationsUsed: number;
  activationsRemaining: number;
  trialLimit: number;
  isTrialActive: boolean;
  subscriptionRequired: boolean;
  subscriptionStatus: string;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const isTrialActive = tenant.subscriptionStatus === 'TRIALING' || tenant.subscriptionStatus === 'NONE';
  const subscriptionRequired = tenant.freeTrialActivations >= tenant.freeTrialLimit && tenant.subscriptionStatus !== 'ACTIVE';
  const activationsRemaining = Math.max(0, tenant.freeTrialLimit - tenant.freeTrialActivations);

  return {
    activationsUsed: tenant.freeTrialActivations,
    activationsRemaining,
    trialLimit: tenant.freeTrialLimit,
    isTrialActive,
    subscriptionRequired,
    subscriptionStatus: tenant.subscriptionStatus
  };
}

/**
 * Check if tenant can activate cards (within trial or has subscription)
 */
export async function canActivateCards(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant) {
    return false;
  }

  // If has active subscription, can activate
  if (tenant.subscriptionStatus === 'ACTIVE') {
    return true;
  }

  // If within trial limit, can activate
  return tenant.freeTrialActivations < tenant.freeTrialLimit;
}

/**
 * Reset trial for a tenant (admin function)
 */
export async function resetTrial(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      freeTrialActivations: 0,
      trialExpiredNotified: false,
      subscriptionStatus: 'TRIALING'
    }
  });
}
