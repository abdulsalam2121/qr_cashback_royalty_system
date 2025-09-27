// scripts/findPlatformTenant.ts
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function findPlatformTenant() {
  try {
    const platformTenant = await prisma.tenant.findUnique({
      where: { slug: 'platform' }
    });
    
    if (!platformTenant) {
      console.log('❌ Platform tenant not found. Run seed script first.');
      return null;
    }
    
    console.log('📊 Platform tenant details:');
    console.log(`   ID: ${platformTenant.id}`);
    console.log(`   Slug: ${platformTenant.slug}`);
    console.log(`   Name: ${platformTenant.name}`);
    
    return platformTenant;
    
  } catch (error) {
    console.error('❌ Error finding platform tenant:', error);
    return null;
  } finally {
    await prisma.$disconnect();
  }
}

findPlatformTenant();