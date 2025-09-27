// scripts/checkUser.ts
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function checkUser(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { 
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        }
      }
    });
    
    if (!user) {
      console.log(`❌ User ${email} not found in database`);
      return;
    }
    
    console.log(`📊 User details for ${email}:`);
    console.log(`   UID: ${user.id}`);
    console.log(`   Database Role: ${user.role}`);
    console.log(`   Auth Provider: ${(user as any).authProvider || 'email'}`);
    console.log(`   Tenant ID: ${user.tenantId}`);
    console.log(`   Tenant Slug: ${user.tenant?.slug || 'None'}`);
    console.log(`   Tenant Name: ${user.tenant?.name || 'None'}`);
    console.log(`   Active: ${user.active}`);
    console.log(`   Created: ${user.createdAt}`);
    
  } catch (error) {
    console.error('❌ Error checking user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: npx tsx scripts/checkUser.ts <email>');
  process.exit(1);
}

checkUser(email);