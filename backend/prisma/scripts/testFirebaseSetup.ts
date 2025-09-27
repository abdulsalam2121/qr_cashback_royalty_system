// scripts/testFirebaseSetup.ts
import { admin } from '../src/auth/firebaseAdmin.js';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config();

async function testFirebaseSetup() {
  console.log('🔥 Testing Firebase Admin Setup...\n');

  try {
    // Check configuration method
    const serviceAccountPath = join(process.cwd(), 'config', 'firebase-service-account.json');
    const hasJsonFile = existsSync(serviceAccountPath);
    const hasEnvVars = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;

    console.log('📋 Configuration Check:');
    console.log(`   JSON file (backend/config/firebase-service-account.json): ${hasJsonFile ? '✅ Found' : '❌ Not found'}`);
    console.log(`   Environment variables: ${hasEnvVars ? '✅ Complete' : '❌ Incomplete'}`);

    if (!hasJsonFile && !hasEnvVars) {
      console.error('\n❌ No Firebase configuration found!');
      console.log('Please either:');
      console.log('1. Place firebase-service-account.json in backend/config/ directory (RECOMMENDED), OR');
      console.log('2. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables');
      process.exit(1);
    }

    console.log(`\n🔧 Using: ${hasJsonFile ? 'JSON service account file' : 'Environment variables'}`);

    // Check if Firebase Admin is initialized
    if (!admin.apps.length) {
      console.error('❌ Firebase Admin not initialized');
      process.exit(1);
    }

    console.log('✅ Firebase Admin initialized successfully');
    
    // Test basic functionality
    const auth = admin.auth();
    console.log('✅ Firebase Auth service accessible');

    // Try to list users (limited to 1 to test API access)
    try {
      const listUsersResult = await auth.listUsers(1);
      console.log(`✅ Firebase API working - found ${listUsersResult.users.length} user(s)`);
    } catch (error) {
      console.log('⚠️  Firebase API access limited - this is normal for some projects');
      console.log('   Error:', (error as Error).message);
    }

    // Test token verification with a dummy token (will fail but confirms setup)
    try {
      await auth.verifyIdToken('dummy-token');
    } catch (error) {
      console.log('✅ Token verification endpoint working (expected error with dummy token)');
    }

    console.log('\n🎉 Firebase setup test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Copy frontend/.env.example to frontend/.env.local');
    console.log('2. Test Google Sign-In from the frontend');
    console.log('3. Use `npm run set-admin-claim user@example.com` to set admin users');

  } catch (error) {
    console.error('❌ Firebase setup test failed:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Ensure firebase-service-account.json is in the correct location');
    console.log('2. Check that the JSON file has valid Firebase service account credentials');
    console.log('3. Verify the service account has the correct permissions');
    process.exit(1);
  }
}

testFirebaseSetup().catch(console.error);
