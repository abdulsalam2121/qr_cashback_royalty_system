// src/firebase/auth.ts
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  AuthError
} from "firebase/auth";
import { auth, googleProvider } from "./config";

export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export const signInWithGoogle = async (useRedirect = false): Promise<{ user: FirebaseUser; idToken: string }> => {
  try {
    console.log('🚀 Starting Google Sign-In with method:', useRedirect ? 'redirect' : 'popup');
    let result;
    
    if (useRedirect) {
      console.log('🔄 Using redirect method...');
      // Use redirect method (better for mobile and COOP issues)
      await signInWithRedirect(auth, googleProvider);
      // The page will redirect, so we don't get a result here
      // The result will be handled by checkRedirectResult()
      throw new Error('redirect_initiated');
    } else {
      console.log('🪟 Using popup method...');
      // Try popup method first
      result = await signInWithPopup(auth, googleProvider);
      console.log('✅ Popup sign-in successful:', result.user.email);
    }
    
    console.log('🔑 Getting ID token...');
    const idToken = await result.user.getIdToken();
    console.log('✅ Got ID token, length:', idToken.length);
    
    return {
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      },
      idToken
    };
  } catch (error) {
    const authError = error as AuthError;
    console.error('❌ Google sign-in error:', authError);
    
    // Handle redirect initiation
    if (authError.message === 'redirect_initiated') {
      console.log('🔄 Redirect initiated successfully');
      throw authError;
    }
    
    // Handle COOP/popup issues by falling back to redirect
    if (authError.code === 'auth/popup-blocked' || 
        authError.message?.includes('Cross-Origin-Opener-Policy') ||
        authError.message?.includes('window.closed')) {
      console.log('🔄 Popup blocked, falling back to redirect method...');
      return signInWithGoogle(true); // Retry with redirect
    }
    
    // Handle other specific error cases
    if (authError.code === 'auth/account-exists-with-different-credential') {
      throw new Error('An account already exists with this email using a different sign-in method.');
    } else if (authError.code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in was cancelled.');
    } else if (authError.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in was cancelled.');
    }
    
    console.error('❌ Unhandled auth error:', authError.code, authError.message);
    throw new Error(authError.message || 'Google sign-in failed');
  }
};

// Check for redirect result when the page loads
export const checkRedirectResult = async (): Promise<{ user: FirebaseUser; idToken: string } | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;
    
    const idToken = await result.user.getIdToken();
    
    return {
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      },
      idToken
    };
  } catch (error) {
    console.error('Error checking redirect result:', error);
    return null;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw new Error('Sign out failed');
  }
};

export const getCurrentUserToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    return await user.getIdToken(true); // Force refresh
  } catch (error) {
    console.error('Error getting user token:', error);
    return null;
  }
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
