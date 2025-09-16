// scripts/listUsers.ts
import { admin } from '../src/auth/firebaseAdmin.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function listUsers() {
  try {
    if (!admin.apps.length) {
      console.error('Firebase Admin not initialized. Check your environment variables.');
      process.exit(1);
    }

    console.log('Listing all users in Firebase Auth...\n');
    
    const listUsersResult = await admin.auth().listUsers(1000);
    
    if (listUsersResult.users.length === 0) {
      console.log('No users found in Firebase Auth.');
      return;
    }

    console.log(`Found ${listUsersResult.users.length} users:\n`);
    
    listUsersResult.users.forEach((userRecord, index) => {
      console.log(`${index + 1}. Email: ${userRecord.email || 'No email'}`);
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Custom Claims: ${JSON.stringify(userRecord.customClaims || {})}`);
      console.log(`   Created: ${userRecord.metadata.creationTime}`);
      console.log('   ---');
    });
    
  } catch (error) {
    console.error('❌ Error listing users:', error);
    process.exit(1);
  }
}

listUsers().then(() => {
  process.exit(0);
}).catch(console.error);