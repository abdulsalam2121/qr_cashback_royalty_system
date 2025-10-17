// scripts/testFirebaseSetup.ts
import { admin } from '../src/auth/firebaseAdmin.js';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config();

async function testFirebaseSetup() {

  try {
    // Check configuration method
    const serviceAccountPath = join(process.cwd(), 'config', 'firebase-service-account.json');
    const hasJsonFile = existsSync(serviceAccountPath);
    const hasEnvVars = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;


    if (!hasJsonFile && !hasEnvVars) {
      console.error('\n❌ No Firebase configuration found!');
      process.exit(1);
    }


    // Check if Firebase Admin is initialized
    if (!admin.apps.length) {
      console.error('❌ Firebase Admin not initialized');
      process.exit(1);
    }

    
    // Test basic functionality
    const auth = admin.auth();

    // Try to list users (limited to 1 to test API access)
    try {
      const listUsersResult = await auth.listUsers(1);
    } catch (error) {
    }

    // Test token verification with a dummy token (will fail but confirms setup)
    try {
      await auth.verifyIdToken('dummy-token');
    } catch (error) {
    }


  } catch (error) {
    console.error('❌ Firebase setup test failed:', error);
    process.exit(1);
  }
}

testFirebaseSetup().catch(console.error);
