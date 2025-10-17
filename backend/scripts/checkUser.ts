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
      return;
    }
    
    
  } catch (error) {
    console.error('❌ Error checking user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  process.exit(1);
}

checkUser(email);