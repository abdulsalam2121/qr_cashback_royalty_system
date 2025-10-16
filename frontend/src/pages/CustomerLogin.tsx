import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRScanner from '../components/QRScanner';

interface LoginResponse {
  success: boolean;
  sessionToken: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    tier: string;
    totalSpend: number;
  };
  card: {
    id: string;
    cardUid: string;
    balanceCents: number;
    status: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function CustomerLogin() {
  const [loginMethod, setLoginMethod] = useState<'qr' | 'manual'>('qr');
  const [cardUid, setCardUid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (uid: string) => {
    setIsLoading(true);
    setError('');

    try {
      const endpoint = loginMethod === 'qr' ? '/api/customer-auth/qr-login' : '/api/customer-auth/manual-login';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardUid: uid,
          tenantSlug: new URLSearchParams(window.location.search).get('tenant')
        }),
      });

      const data: LoginResponse | { error: string; message?: string } = await response.json();

      if (!response.ok) {
        throw new Error('error' in data ? data.message || data.error : 'Login failed');
      }

      if ('success' in data && data.success) {
        // Store session token
        localStorage.setItem('customerSession', data.sessionToken);
        localStorage.setItem('customerData', JSON.stringify({
          customer: data.customer,
          card: data.card,
          tenant: data.tenant
        }));

        // Redirect to dashboard
        navigate('/customer/dashboard');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQRScan = (scannedUid: string) => {
    handleLogin(scannedUid);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardUid.trim()) {
      handleLogin(cardUid.trim());
    }
  };

  const handleScanError = (error: string) => {
    setError(error);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Access Your Loyalty Card
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Scan your QR card or enter your card ID to view your balance
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Login Method Toggle */}
          <div className="mb-6">
            <div className="flex rounded-md bg-gray-100 p-1">
              <button
                type="button"
                className={`flex-1 text-center py-2 px-3 rounded text-sm font-medium transition-colors ${
                  loginMethod === 'qr'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setLoginMethod('qr')}
              >
                Scan QR Code
              </button>
              <button
                type="button"
                className={`flex-1 text-center py-2 px-3 rounded text-sm font-medium transition-colors ${
                  loginMethod === 'manual'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setLoginMethod('manual')}
              >
                Enter Card ID
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* QR Scanner */}
          {loginMethod === 'qr' && (
            <div className="space-y-4">
              <QRScanner
                onScanSuccess={handleQRScan}
                onError={handleScanError}
                isActive={!isLoading}
              />
              
              {isLoading && (
                <div className="text-center">
                  <div className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying card...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Entry */}
          {loginMethod === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-6">
              <div>
                <label htmlFor="cardUid" className="block text-sm font-medium text-gray-700">
                  Card ID
                </label>
                <div className="mt-1">
                  <input
                    id="cardUid"
                    name="cardUid"
                    type="text"
                    placeholder="Enter your card ID"
                    value={cardUid}
                    onChange={(e) => setCardUid(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono tracking-wider"
                    required
                    disabled={isLoading}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  You can find your Card ID printed on your loyalty card
                </p>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading || !cardUid.trim()}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    'Access Dashboard'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Help Text */}
          <div className="mt-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Need Help?</h3>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Make sure your camera is enabled for QR scanning</li>
                <li>• Card ID is usually printed on the back of your loyalty card</li>
                <li>• Contact the store if your card isn't working</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}