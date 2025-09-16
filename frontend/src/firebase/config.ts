// src/firebase/config.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";


// Hardcoded public Firebase config (safe for frontend)
const firebaseConfig = {
  apiKey: "AIzaSyBcuGPgDKzkQXR5J-hRBVZb8pACpV6vJQU",
  authDomain: "qr-loyalty-system.firebaseapp.com",
  projectId: "qr-loyalty-system",
  appId: "1:693444284320:web:a4df1abebd1d875e565ec5",
  messagingSenderId: "693444284320",
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Persist sessions
setPersistence(auth, browserLocalPersistence).catch(error => {
  console.error('Error setting auth persistence:', error);
});
