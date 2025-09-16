// Simple browser console test for Google Sign-In
// Run this in the browser console on http://localhost:5173

console.log('🧪 Starting Google Sign-In test...');

// Step 1: Check if Firebase is loaded
import('http://localhost:5173/src/firebase/config.js').then(({ auth, googleProvider }) => {
  console.log('✅ Firebase loaded:', { auth, googleProvider });
  
  // Step 2: Check current auth state
  import('firebase/auth').then(({ onAuthStateChanged, signInWithPopup }) => {
    console.log('🔍 Checking current auth state...');
    
    onAuthStateChanged(auth, (user) => {
      console.log('🔄 Auth state:', user ? `Logged in as ${user.email}` : 'Not logged in');
      
      if (user) {
        // Step 3: Get ID token
        user.getIdToken().then(token => {
          console.log('✅ ID Token:', token.substring(0, 50) + '...');
          
          // Step 4: Test backend sync
          console.log('📡 Testing backend sync...');
          fetch('http://localhost:3002/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify({})
          })
          .then(response => {
            console.log('📡 Backend sync response status:', response.status);
            if (response.ok) {
              return response.json();
            } else {
              return response.text().then(text => {
                throw new Error(`HTTP ${response.status}: ${text}`);
              });
            }
          })
          .then(data => {
            console.log('✅ Backend sync successful:', data);
          })
          .catch(error => {
            console.error('❌ Backend sync failed:', error);
          });
        }).catch(error => {
          console.error('❌ Failed to get ID token:', error);
        });
      }
    });
    
    // Manual sign-in function
    window.testGoogleSignIn = () => {
      console.log('🚀 Starting manual Google sign-in...');
      signInWithPopup(auth, googleProvider)
        .then(result => {
          console.log('✅ Sign-in successful:', result.user);
        })
        .catch(error => {
          console.error('❌ Sign-in failed:', error);
        });
    };
    
    console.log('✅ Test setup complete. Run testGoogleSignIn() to test sign-in.');
  });
});
