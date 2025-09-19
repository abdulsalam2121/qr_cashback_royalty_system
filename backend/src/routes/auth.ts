import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { verifyFirebaseToken, FirebaseUserRequest } from '../middleware/verifyFirebaseToken.js';
import { initializeDefaultRules } from '../utils/initializeDefaults.js';
import { emailService } from '../services/emailService.js';
import { TokenService } from '../services/tokenService.js';

const router = express.Router();
const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['admin', 'cashier', 'customer']).optional(),
  storeId: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

// Login
router.post('/login', validate(loginSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { 
      store: true, 
      tenant: true 
    },
  });

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Check if user's email is verified for password auth users
  if (user.authProvider === 'password' && !user.emailVerified) {
    res.status(401).json({ 
      error: 'Email not verified',
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address before signing in.'
    });
    return;
  }

  // Check if account is active
  if (!user.active) {
    res.status(401).json({ error: 'Account is inactive' });
    return;
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      tenantId: user.tenantId,
      storeId: user.storeId,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const userResponse = {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    storeId: user.storeId,
    storeName: user.store?.name,
    tenantId: user.tenantId,
    tenantSlug: user.tenant?.slug,
    tenantName: user.tenant?.name,
  };

  const response: any = { user: userResponse };
  
  // Include tenant info for non-platform admins
  if (user.tenant && user.role !== 'platform_admin') {
    response.tenant = {
      id: user.tenant.id,
      slug: user.tenant.slug,
      name: user.tenant.name,
      subscriptionStatus: user.tenant.subscriptionStatus,
      planId: user.tenant.planId,
      trialEndsAt: user.tenant.trialEndsAt,
      graceEndsAt: user.tenant.graceEndsAt,
    };
  }

  res.json(response);
  return;
}));

// Public signup (for store owners) - now requires email verification
router.post('/signup', validate(registerSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    res.status(400).json({ error: 'User already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Generate unique slug for tenant
  const baseSlug = `${firstName}-${lastName}-store`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  let slug = baseSlug;
  let counter = 1;
  
  // Ensure slug is unique
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  // Create a tenant for the new store owner with trial settings
  const tenant = await prisma.tenant.create({
    data: {
      name: `${firstName} ${lastName}'s Store`,
      slug,
      subscriptionStatus: 'TRIALING',
      freeTrialActivations: 0,
      freeTrialLimit: 40,
      trialExpiredNotified: false,
    },
  });

  // Generate email verification token
  const tokenData = TokenService.generateEmailVerificationToken();
  const hashedToken = TokenService.hashToken(tokenData.token);

  // Create the user as tenant admin but inactive until email verified
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: 'tenant_admin', // Store owners are tenant admins
      tenantId: tenant.id,
      active: false, // User inactive until email verified
      emailVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpiry: tokenData.expiresAt,
      authProvider: 'password', // Mark as password auth
    },
  });

  // Initialize default cashback rules and tier rules
  await initializeDefaultRules(tenant.id);

  // Send verification email
  try {
    await emailService.sendEmailVerification(
      user.email,
      user.firstName || 'User',
      tokenData.token
    );
  } catch (error) {
    console.error('Failed to send verification email:', error);
    // Delete the created user and tenant if email fails
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    return;
  }

  res.status(201).json({ 
    message: 'Account created successfully. Please check your email to verify your account before signing in.',
    email: user.email
  });
  return;
}));

// Register (admin only for creating staff)
router.post('/register', auth, rbac(['tenant_admin']), validate(registerSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, role = 'customer', storeId } = req.body;
  const { tenantId } = req.user;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    res.status(400).json({ error: 'User already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      tenantId,
      storeId,
    },
    include: { store: true, tenant: true },
  });

  const userResponse = {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    storeId: user.storeId,
    storeName: user.store?.name,
    active: user.active,
    createdAt: user.createdAt,
  };

  res.status(201).json({ user: userResponse });
  return;
}));

// Get current user
router.get('/me', auth, asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    include: { 
      store: true, 
      tenant: true 
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const userResponse = {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    storeId: user.storeId,
    storeName: user.store?.name,
    tenantId: user.tenantId,
    tenantSlug: user.tenant?.slug,
    tenantName: user.tenant?.name,
  };

  const response: any = { user: userResponse };
  
  // Include tenant info for non-platform admins
  if (user.tenant && user.role !== 'platform_admin') {
    response.tenant = {
      id: user.tenant.id,
      slug: user.tenant.slug,
      name: user.tenant.name,
      subscriptionStatus: user.tenant.subscriptionStatus,
      planId: user.tenant.planId,
      trialEndsAt: user.tenant.trialEndsAt,
      graceEndsAt: user.tenant.graceEndsAt,
    };
  }

  res.json(response);
  return;
}));

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Debug route to check users (remove in production)
router.get('/debug/users', asyncHandler(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      authProvider: true,
      firstName: true,
      lastName: true,
      tenantId: true,
      active: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  res.json({ users, count: users.length });
  return;
}));

// Debug route to reset a user for testing (remove in production)
router.post('/debug/reset-user/:email', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.params as { email: string };
  
  // Find and delete the user
  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true }
  });
  
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  
  const tenantInfo = user.tenant;
  
  // Delete the user
  await prisma.user.delete({
    where: { email }
  });
  
  // If the user had their own tenant and no other users, delete the tenant too
  if (tenantInfo && tenantInfo.slug !== 'default' && tenantInfo.slug !== 'demo') {
    const otherUsers = await prisma.user.count({
      where: { tenantId: user.tenantId }
    });
    
    if (otherUsers === 0) {
      await prisma.tenant.delete({
        where: { id: user.tenantId! }
      });
    }
  }
  
  res.json({ message: `User ${email} and their tenant have been reset` });
  return;
}));

// Firebase Auth Routes
// Sync user after Firebase authentication
router.post('/sync', verifyFirebaseToken, asyncHandler(async (req: FirebaseUserRequest, res: Response) => {
  const firebaseUser = req.firebaseUser;
  
  if (!firebaseUser?.email || !firebaseUser.uid) {
    res.status(400).json({ error: 'Invalid Firebase user data' });
    return;
  }

  try {
    // Try to find existing user by email
    let user = await prisma.user.findUnique({
      where: { email: firebaseUser.email },
      include: { 
        store: true, 
        tenant: true 
      },
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Google Auth] Found existing user:`, user ? {
        id: user.id,
        role: user.role,
        authProvider: (user as any).authProvider,
        hasTenant: !!user.tenantId
      } : 'No existing user found');
    }

    if (user) {
      // Update existing user with Google auth provider
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Google Auth] Updating existing user with role ${user.role}`);
      }
      
      // Special case: If the user is currently a 'customer' but signing up with Google,
      // they should be upgraded to 'tenant_admin' and get their own tenant
      if (user.role === 'customer' && user.authProvider !== 'google') {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Google Auth] Upgrading customer to tenant_admin with Google auth`);
        }
        
        // Generate unique slug for new tenant
        const firstName = firebaseUser.name?.split(' ')[0] || firebaseUser.displayName?.split(' ')[0] || user.firstName || 'User';
        const lastName = firebaseUser.name?.split(' ').slice(1).join(' ') || firebaseUser.displayName?.split(' ').slice(1).join(' ') || user.lastName || '';

        const baseSlug = `${firstName}-${lastName || 'store'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        let slug = baseSlug;
        let counter = 1;
        
        // Ensure slug is unique
        while (await prisma.tenant.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        console.log(`[Google Auth] Creating new tenant for upgraded user with slug: ${slug}`);

        // Create a new tenant for the upgraded user
        const tenant = await prisma.tenant.create({
          data: {
            name: `${firstName}${lastName ? ` ${lastName}` : ''}'s Store`,
            slug,
            subscriptionStatus: 'TRIALING',
            freeTrialActivations: 0,
            freeTrialLimit: 40,
            trialExpiredNotified: false,
          },
        });

        // Update user to be tenant_admin with new tenant
        user = await prisma.user.update({
          where: { id: user.id },
          data: { 
            authProvider: 'google',
            role: 'tenant_admin',
            tenantId: tenant.id,
            lastLogin: new Date(),
            displayName: firebaseUser.name || firebaseUser.displayName || (user as any).displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
            photoURL: firebaseUser.picture || firebaseUser.photoURL || (user as any).photoURL || null,
            firstName: firstName,
            lastName: lastName,
          },
          include: { 
            store: true, 
            tenant: true 
          },
        });

        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Google Auth] Upgraded user to tenant_admin:`, {
            id: user.id,
            role: user.role,
            hasTenant: !!user.tenantId,
          });
        }

        // Initialize default rules for the new tenant
        try {
          await initializeDefaultRules(tenant.id);
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Google Auth] Initialized default rules for upgraded user tenant`);
          }
        } catch (error) {
          console.error('Failed to initialize default rules for upgraded user tenant:', error);
        }
      } else {
        // Regular update for existing users
        user = await prisma.user.update({
          where: { id: user.id },
          data: { 
            authProvider: 'google',
            lastLogin: new Date(),
            displayName: firebaseUser.name || firebaseUser.displayName || (user as any).displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
            photoURL: firebaseUser.picture || firebaseUser.photoURL || (user as any).photoURL || null,
          },
          include: { 
            store: true, 
            tenant: true 
          },
        });
      }
    } else {
      // For new Google users, create them as tenant admins with their own tenant
      // Similar to the signup process
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Google Auth] Creating new tenant admin user`);
      }
      
      const firstName = firebaseUser.name?.split(' ')[0] || firebaseUser.displayName?.split(' ')[0] || 'User';
      const lastName = firebaseUser.name?.split(' ').slice(1).join(' ') || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '';

      // Generate unique slug for tenant
      const baseSlug = `${firstName}-${lastName || 'store'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let slug = baseSlug;
      let counter = 1;
      
      // Ensure slug is unique
      while (await prisma.tenant.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Google Auth] Creating tenant with slug: ${slug}`);
      }

      // Create a tenant for the new Google user with trial settings
      const tenant = await prisma.tenant.create({
        data: {
          name: `${firstName}${lastName ? ` ${lastName}` : ''}'s Store`,
          slug,
          subscriptionStatus: 'TRIALING',
          freeTrialActivations: 0,
          freeTrialLimit: 40,
          trialExpiredNotified: false,
        },
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Google Auth] Created tenant`, {
          slug: tenant.slug,
          name: tenant.name
        });
      }

      // Create new user as tenant admin (store owner)
      user = await prisma.user.create({
        data: {
          email: firebaseUser.email,
          authProvider: 'google',
          firstName,
          lastName,
          role: 'tenant_admin', // Store owners are tenant admins
          displayName: firebaseUser.name || firebaseUser.displayName || null,
          photoURL: firebaseUser.picture || firebaseUser.photoURL || null,
          tenantId: tenant.id,
          active: true,
          lastLogin: new Date(),
        },
        include: { 
          store: true, 
          tenant: true 
        },
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Google Auth] Created new user:`, {
          id: user.id,
          role: user.role,
          hasTenant: !!user.tenantId,
        });
      }

      // Initialize default cashback rules and tier rules for the new tenant
      try {
        await initializeDefaultRules(tenant.id);
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Google Auth] Initialized default rules for tenant`);
        }
      } catch (error) {
        console.error('Failed to initialize default rules for new Google user tenant:', error);
      }
    }

    if (!user) {
      res.status(500).json({ error: 'Failed to create or update user' });
      return;
    }

    // Determine role from DB or Firebase custom claims
    const isAdmin = user.role === 'platform_admin' || 
                   user.role === 'tenant_admin' ||
                   firebaseUser.admin === true;
    
    const role = user.role || (isAdmin ? 'admin' : 'customer');

    const userResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: (user as any).displayName || null,
      photoURL: (user as any).photoURL || null,
      storeId: user.storeId,
      storeName: user.store?.name,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug,
      tenantName: user.tenant?.name,
    };

    // Create JWT token for subsequent requests (like regular login)
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        tenantId: user.tenantId,
        storeId: user.storeId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie for authentication
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const response: any = { user: userResponse, role };
    
    // Include tenant info for non-platform admins
    if (user.tenant && user.role !== 'platform_admin') {
      response.tenant = {
        id: user.tenant.id,
        slug: user.tenant.slug,
        name: user.tenant.name,
        subscriptionStatus: user.tenant.subscriptionStatus,
        planId: user.tenant.planId,
        trialEndsAt: user.tenant.trialEndsAt,
        graceEndsAt: user.tenant.graceEndsAt,
      };
    }

    res.json(response);
    return;
  } catch (error) {
    console.error('Error syncing Firebase user:', error);
    res.status(500).json({ error: 'Failed to sync user data' });
    return;
  }
}));

// Get current user info (for Firebase auth)
router.get('/me', verifyFirebaseToken, asyncHandler(async (req: FirebaseUserRequest, res: Response) => {
  const firebaseUser = req.firebaseUser;
  
  if (!firebaseUser?.email) {
    res.status(400).json({ error: 'Invalid Firebase user' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: firebaseUser.email },
      include: { 
        store: true, 
        tenant: true 
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Determine role from DB or Firebase custom claims
    const isAdmin = user.role === 'platform_admin' || 
                   user.role === 'tenant_admin' ||
                   firebaseUser.admin === true;
    
    const role = user.role || (isAdmin ? 'admin' : 'customer');

    const response: any = { role };

    // Include user and tenant info if needed
    const userResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: (user as any).displayName || null,
      photoURL: (user as any).photoURL || null,
      storeId: user.storeId,
      storeName: user.store?.name,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug,
      tenantName: user.tenant?.name,
    };

    response.user = userResponse;

    if (user.tenant && user.role !== 'platform_admin') {
      response.tenant = {
        id: user.tenant.id,
        slug: user.tenant.slug,
        name: user.tenant.name,
        subscriptionStatus: user.tenant.subscriptionStatus,
        planId: user.tenant.planId,
        trialEndsAt: user.tenant.trialEndsAt,
        graceEndsAt: user.tenant.graceEndsAt,
      };
    }

    res.json(response);
    return;
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: 'Failed to get user info' });
    return;
  }
}));

// Resend email verification
router.post('/resend-verification', validate(forgotPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return success to prevent email enumeration
  if (!user || user.emailVerified || user.authProvider !== 'password') {
    res.json({ message: 'If an unverified account exists with that email, a verification email has been sent.' });
    return;
  }

  // Generate new verification token
  const tokenData = TokenService.generateEmailVerificationToken();
  const hashedToken = TokenService.hashToken(tokenData.token);

  // Update user with new verification token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpiry: tokenData.expiresAt,
    },
  });

  // Send verification email
  try {
    await emailService.sendEmailVerification(
      user.email,
      user.firstName || 'User',
      tokenData.token
    );
  } catch (error) {
    console.error('Failed to resend verification email:', error);
    // Don't reveal email sending failure
  }

  res.json({ message: 'If an unverified account exists with that email, a verification email has been sent.' });
  return;
}));

// Forgot password
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return success to prevent email enumeration attacks
  if (!user) {
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    return;
  }

  // Only allow password reset for users who registered with email/password (not Google)
  if (!user.passwordHash || user.authProvider === 'google') {
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    return;
  }

  // Generate password reset token
  const tokenData = TokenService.generatePasswordResetToken();
  const hashedToken = TokenService.hashToken(tokenData.token);

  // Store the hashed token in database
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetTokenExpiry: tokenData.expiresAt,
    },
  });

  // Send password reset email
  try {
    await emailService.sendPasswordReset(
      user.email,
      user.firstName || 'User',
      tokenData.token
    );
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    // Don't reveal email sending failure to prevent enumeration
  }

  res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  return;
}));

// Reset password
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;

  const hashedToken = TokenService.hashToken(token);

  // Find user with matching reset token that hasn't expired
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetTokenExpiry: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    res.status(400).json({ error: 'Invalid or expired reset token' });
    return;
  }

  // Hash the new password
  const passwordHash = await bcrypt.hash(password, 12);

  // Update user password and clear reset tokens
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetTokenExpiry: null,
      // Ensure user is active and email verified if they're resetting password
      active: true,
      emailVerified: true,
    },
  });

  res.json({ message: 'Password has been reset successfully' });
  return;
}));

// Verify email
router.post('/verify-email', validate(verifyEmailSchema), asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;

  const hashedToken = TokenService.hashToken(token);

  // Find user with matching verification token that hasn't expired
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpiry: {
        gt: new Date(),
      },
    },
    include: { 
      store: true, 
      tenant: true 
    },
  });

  if (!user) {
    res.status(400).json({ error: 'Invalid or expired verification token' });
    return;
  }

  // Update user to verified and active
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      active: true,
      emailVerificationToken: null,
      emailVerificationTokenExpiry: null,
    },
    include: { 
      store: true, 
      tenant: true 
    },
  });

  // Create JWT token for immediate login
  const jwtToken = jwt.sign(
    { 
      userId: updatedUser.id, 
      email: updatedUser.email, 
      role: updatedUser.role,
      tenantId: updatedUser.tenantId,
      storeId: updatedUser.storeId,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  res.cookie('token', jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const userResponse = {
    id: updatedUser.id,
    email: updatedUser.email,
    role: updatedUser.role,
    firstName: updatedUser.firstName,
    lastName: updatedUser.lastName,
    storeId: updatedUser.storeId,
    storeName: updatedUser.store?.name,
    tenantId: updatedUser.tenantId,
    tenantName: updatedUser.tenant?.name,
    tenantSlug: updatedUser.tenant?.slug,
  };

  const response: any = { user: userResponse };
  
  // Include tenant info for non-platform admins
  if (updatedUser.tenant && updatedUser.role !== 'platform_admin') {
    response.tenant = {
      id: updatedUser.tenant.id,
      slug: updatedUser.tenant.slug,
      name: updatedUser.tenant.name,
      subscriptionStatus: updatedUser.tenant.subscriptionStatus,
      planId: updatedUser.tenant.planId,
      trialEndsAt: updatedUser.tenant.trialEndsAt,
      graceEndsAt: updatedUser.tenant.graceEndsAt,
    };
  }

  res.json({ 
    message: 'Email verified successfully',
    ...response
  });
  return;
}));

export default router;