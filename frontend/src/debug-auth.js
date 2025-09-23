// Simple test script to debug the auth flow
console.log('🧪 Testing auth flow step by step...');

// Test 1: Check if Firebase is available
import { auth } from './firebase/config';
console.log('✅ Firebase auth object:', auth);

// Test 2: Check current user
auth.onAuthStateChanged((user) => {
  console.log('🔄 Current Firebase user:', user ? 'User authenticated' : 'No user');
  
  if (user) {
    // Test 3: Get ID token
    user.getIdToken().then(token => {
      console.log('✅ Got Firebase ID token:', token.substring(0, 50) + '...');
      
      // Test 4: Try backend call directly
      fetch('http://localhost:3002/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      })
      .then(response => {
        console.log('📡 Backend response status:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('✅ Backend response received');
      })
      .catch(error => {
        console.error('❌ Backend call failed:', error);
      });
    }).catch(error => {
      console.error('❌ Failed to get ID token:', error);
    });
  }
});
