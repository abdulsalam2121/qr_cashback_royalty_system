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
    
    console.log(`🔥 Firebase Auth details for ${email}:`);
    console.log(`   UID: ${user.uid}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Custom Claims: ${JSON.stringify(user.customClaims || {})}`);
    console.log(`   Email Verified: ${user.emailVerified}`);
    console.log(`   Disabled: ${user.disabled}`);
    console.log(`   Created: ${user.metadata.creationTime}`);
    console.log(`   Last Sign In: ${user.metadata.lastSignInTime || 'Never'}`);
    
  } catch (error) {
    console.error('❌ Error checking Firebase claims:', error);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: npx tsx scripts/checkFirebaseClaims.ts <email>');
  process.exit(1);
}

checkFirebaseClaims(email).then(() => {
  process.exit(0);
}).catch(console.error);