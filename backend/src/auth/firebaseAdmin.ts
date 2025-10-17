// src/auth/firebaseAdmin.ts
import admin from "firebase-admin";
import { readFileSync } from 'fs';
import { join } from 'path';

if (!admin.apps.length) {
  try {
    // Try to load from JSON file first
    const serviceAccountPath = join(process.cwd(), 'config', 'firebase-service-account.json');
    let serviceAccount;
    
    try {
      const serviceAccountFile = readFileSync(serviceAccountPath, 'utf8');
      serviceAccount = JSON.parse(serviceAccountFile);
    } catch (fileError) {
      // Fallback to environment variables if JSON file doesn't exist
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
      
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
        console.warn('Firebase Admin: No JSON file or complete environment variables found. Firebase authentication will not work.');
        console.warn('Please either:');
        console.warn('1. Place firebase-service-account.json in backend/config/ directory, OR');
        console.warn('2. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables');
      } else {
        serviceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        };
      }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export { admin };
