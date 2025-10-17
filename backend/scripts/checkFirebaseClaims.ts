// scripts/checkFirebaseClaims.ts
import { admin } from '../src/auth/firebaseAdmin.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkFirebaseClaims(email: string) {
  try {
    if (!admin.apps.length) {
      console.error('Firebase Admin not initialized. Check your environment variables.');
      process.exit(1);
    }

    const user = await admin.auth().getUserByEmail(email);
    
    
  } catch (error) {
    console.error('❌ Error checking Firebase claims:', error);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  process.exit(1);
}

checkFirebaseClaims(email).then(() => {
  process.exit(0);
}).catch(console.error);