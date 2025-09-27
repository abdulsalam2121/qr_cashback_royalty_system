// scripts/setAdminClaim.ts
import { admin } from '../src/auth/firebaseAdmin.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setAdminClaim(email: string) {
  try {
    if (!admin.apps.length) {
      console.error('Firebase Admin not initialized. Check your environment variables.');
      process.exit(1);
    }

    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    
    console.log(`✅ Admin claim set for ${email} (UID: ${user.uid})`);
    console.log('The user will need to sign out and sign back in for the change to take effect.');
  } catch (error) {
    console.error('❌ Error setting admin claim:', error);
    process.exit(1);
  }
}

async function removeAdminClaim(email: string) {
  try {
    if (!admin.apps.length) {
      console.error('Firebase Admin not initialized. Check your environment variables.');
      process.exit(1);
    }

    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: false });
    
    console.log(`✅ Admin claim removed for ${email} (UID: ${user.uid})`);
    console.log('The user will need to sign out and sign back in for the change to take effect.');
  } catch (error) {
    console.error('❌ Error removing admin claim:', error);
    process.exit(1);
  }
}

async function main() {
  const action = process.argv[2];
  const email = process.argv[3];

  if (!action || !email) {
    console.log('Usage:');
    console.log('  npm run set-admin-claim <email>     - Set admin claim');
    console.log('  npm run remove-admin-claim <email>  - Remove admin claim');
    console.log('');
    console.log('Examples:');
    console.log('  npm run set-admin-claim admin@example.com');
    console.log('  npm run remove-admin-claim user@example.com');
    process.exit(1);
  }

  if (action === 'set') {
    await setAdminClaim(email);
  } else if (action === 'remove') {
    await removeAdminClaim(email);
  } else {
    console.error('Invalid action. Use "set" or "remove"');
    process.exit(1);
  }

  process.exit(0);
}

main().catch(console.error);
