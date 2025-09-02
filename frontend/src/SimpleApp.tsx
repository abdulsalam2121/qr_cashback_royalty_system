import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import Login from './pages/Login';

// Simple test component to verify everything works
const TestPage: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="bg-white p-8 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold">App is working!</h1>
      <p>If you can see this, the basic routing is functional.</p>
    </div>
  </div>
);

function SimpleApp() {
  const { isAuthenticated, initialize } = useAuthStore();
  const [isInitialized, setIsInitialized] = React.useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // Minimal initialization
        initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('Initialization error:', error);
        setIsInitialized(true); // Continue anyway
      }
    };
    init();
  }, [initialize]);

  // Simple loading state
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Simple login route */}
          <Route 
            path="/login" 
            element={!isAuthenticated ? <Login /> : <Navigate to="/test" replace />}
          />
          
          {/* Test page to verify app works */}
          <Route path="/test" element={<TestPage />} />
          
          {/* Root redirect */}
          <Route 
            path="/" 
            element={<Navigate to={isAuthenticated ? "/test" : "/login"} replace />}
          />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default SimpleApp;
