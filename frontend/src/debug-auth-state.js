// Debug script to check auth state
console.log('=== AUTH STATE DEBUG ===');

// Check Firebase auth state
import('./firebase/auth.js').then(({ auth }) => {
  console.log('Firebase auth current user:', auth.currentUser);
  console.log('Firebase auth state:', {
    isSignedIn: !!auth.currentUser,
    email: auth.currentUser?.email,
    uid: auth.currentUser?.uid
  });
});

// Check local storage for persisted state
console.log('Local storage auth data:', {
  authStore: localStorage.getItem('auth-store'),
  firebaseUser: localStorage.getItem('firebase:authUser:' + (window.firebase?.app()?.options?.apiKey || 'unknown'))
});

// Check session storage
console.log('Session storage:', {
  keys: Object.keys(sessionStorage),
  values: Object.keys(sessionStorage).reduce((acc, key) => {
    acc[key] = sessionStorage.getItem(key);
    return acc;
  }, {})
});
