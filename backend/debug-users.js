// Check platform admin users
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('Checking users...');
    
    const users = await prisma.user.findMany({
      where: {
        role: 'platform_admin'
      }
    });
    
    console.log(`Found ${users.length} platform admin users:`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log('---');
    });
    
    if (users.length === 0) {
      console.log('No platform admin users found. Let\'s check all users...');
      
      const allUsers = await prisma.user.findMany({
        take: 10
      });
      
      console.log(`Found ${allUsers.length} total users (showing first 10):`);
      allUsers.forEach((user, index) => {
        console.log(`${index + 1}. Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.status}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();