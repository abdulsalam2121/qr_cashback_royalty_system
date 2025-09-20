// Debug script to check auth state
console.log('=== AUTH STATE DEBUG ===');

// Check Firebase auth state
import('./firebase/auth.js').then(({ auth }) => {
  console.log('Firebase auth current user:', auth.currentUser ? 'User authenticated' : 'No user');
  console.log('Firebase auth state:', {
    isSignedIn: !!auth.currentUser
  });
});

// Check local storage for persisted state
console.log('Local storage auth data available:', {
  hasAuthStore: !!localStorage.getItem('auth-store'),
  hasFirebaseUser: !!localStorage.getItem('firebase:authUser:' + (window.firebase?.app()?.options?.apiKey || 'unknown'))
});

// Check session storage
console.log('Session storage:', {
  keys: Object.keys(sessionStorage),
  values: Object.keys(sessionStorage).reduce((acc, key) => {
    acc[key] = sessionStorage.getItem(key);
    return acc;
  }, {})
});
