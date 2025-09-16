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
      console.log(`❌ User ${email} not found in database`);
      return;
    }
    
    console.log(`📊 Current user details:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Current Role: ${user.role}`);
    console.log(`   Tenant: ${user.tenant?.name} (${user.tenant?.slug})`);
    
    // For platform_admin, get the platform tenant ID
    let platformTenantId = null;
    if (newRole === 'platform_admin') {
      const platformTenant = await prisma.tenant.findUnique({
        where: { slug: 'platform' }
      });
      
      if (!platformTenant) {
        console.log('❌ Platform tenant not found. Please run the seed script first.');
        return;
      }
      
      platformTenantId = platformTenant.id;
      console.log(`🏗️ Found platform tenant: ${platformTenant.name} (${platformTenant.id})`);
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
    
    console.log(`✅ Successfully updated user role from ${user.role} to ${newRole}`);
    console.log(`📊 Updated user details:`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   New Role: ${updatedUser.role}`);
    console.log(`   Tenant: ${updatedUser.tenant?.name || 'None'} (${updatedUser.tenant?.slug || 'None'})`);
    
    console.log(`\n🔄 The user will need to sign out and sign back in for the change to take effect.`);
    
  } catch (error) {
    console.error('❌ Error updating user role:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
const newRole = process.argv[3];

if (!email || !newRole) {
  console.log('Usage: npx tsx scripts/updateUserRole.ts <email> <role>');
  console.log('Available roles: platform_admin, tenant_admin, admin, cashier, customer');
  console.log('Example: npx tsx scripts/updateUserRole.ts user@example.com platform_admin');
  process.exit(1);
}

updateUserRole(email, newRole);