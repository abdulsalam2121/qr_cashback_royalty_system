// scripts/updateUserRole.ts
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function updateUserRole(email: string, newRole: string) {
  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true }
    });
    
    if (!user) {
      return;
    }
    
    
    // For platform_admin, get the platform tenant ID
    let platformTenantId = null;
    if (newRole === 'platform_admin') {
      const platformTenant = await prisma.tenant.findUnique({
        where: { slug: 'platform' }
      });
      
      if (!platformTenant) {
        return;
      }
      
      platformTenantId = platformTenant.id;
    }
    
    // Update user role
    const updateData: any = { role: newRole as any };
    if (newRole === 'platform_admin' && platformTenantId) {
      updateData.tenantId = platformTenantId;
    }
    
    const updatedUser = await prisma.user.update({
      where: { email },
      data: updateData,
      include: { tenant: true }
    });
    
    
    
  } catch (error) {
    console.error('❌ Error updating user role:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
const newRole = process.argv[3];

if (!email || !newRole) {
  process.exit(1);
}

updateUserRole(email, newRole);