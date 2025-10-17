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

    
    const listUsersResult = await admin.auth().listUsers(1000);
    
    if (listUsersResult.users.length === 0) {
      return;
    }

    
    listUsersResult.users.forEach((userRecord, index) => {
    });
    
  } catch (error) {
    console.error('❌ Error listing users:', error);
    process.exit(1);
  }
}

listUsers().then(() => {
  process.exit(0);
}).catch(console.error);