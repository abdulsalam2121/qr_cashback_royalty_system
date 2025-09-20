import { useAuth } from '../context/AuthContext';
import { getCurrentUserToken } from '../firebase/auth';
import { useState } from 'react';

export default function DebugAuth() {
  const { currentUser, user, tenant, role, loading, isAuthenticated } = useAuth();
  const [debugInfo, setDebugInfo] = useState('');
  const [testResult, setTestResult] = useState('');

  const testBackendConnection = async () => {
    try {
      setTestResult('Testing...');
      
      // Test basic connection
      const healthResponse = await fetch('http://localhost:3002/healthz');
      const healthData = await healthResponse.json();
      if (import.meta.env.DEV) {
        console.log('Health check completed');
      }
      
      if (currentUser) {
        // Test auth endpoint
        const token = await getCurrentUserToken();
        console.log('Got token:', token?.substring(0, 50) + '...');
        
        const authResponse = await fetch('http://localhost:3002/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        console.log('Auth response status:', authResponse.status);
        const authData = await authResponse.text();
        if (import.meta.env.DEV) {
          console.log('Auth response received');
        }
        
        setTestResult(`Health: OK\nAuth Status: ${authResponse.status}\nAuth Response: [Response received]`);
      } else {
        setTestResult(`Health: ${JSON.stringify(healthData)}\nNo Firebase user to test auth with`);
      }
      
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const refreshDebugInfo = () => {
    const info = {
      Firebase: {
        currentUser: currentUser ? {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName
        } : 'null'
      },
      AuthContext: {
        user: user ? {
          id: user.id,
          email: user.email,
          role: user.role
        } : 'null',
        tenant: tenant ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug
        } : 'null',
        role,
        loading,
        isAuthenticated
      },
      LocalStorage: {
        authStore: localStorage.getItem('auth-store'),
        firebaseKeys: Object.keys(localStorage).filter(key => key.includes('firebase'))
      }
    };
    
    setDebugInfo(JSON.stringify(info, null, 2));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="font-semibold mb-2">Current State</h2>
            <div className="text-sm space-y-1">
              <div>Loading: <span className={loading ? 'text-red-600' : 'text-green-600'}>{loading.toString()}</span></div>
              <div>Authenticated: <span className={isAuthenticated ? 'text-green-600' : 'text-red-600'}>{isAuthenticated.toString()}</span></div>
              <div>Firebase User: <span className={currentUser ? 'text-green-600' : 'text-red-600'}>{currentUser?.email || 'None'}</span></div>
              <div>Backend User: <span className={user ? 'text-green-600' : 'text-red-600'}>{user?.email || 'None'}</span></div>
              <div>Role: <span className="font-mono">{role || 'None'}</span></div>
              <div>Tenant: <span className="font-mono">{tenant?.name || 'None'}</span></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <button 
              onClick={refreshDebugInfo}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Refresh Debug Info
            </button>
            <button 
              onClick={testBackendConnection}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ml-2"
            >
              Test Backend
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="bg-gray-100 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Debug Info</h3>
            <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap">{debugInfo}</pre>
          </div>
          
          <div className="bg-gray-100 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Test Results</h3>
            <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap">{testResult}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
