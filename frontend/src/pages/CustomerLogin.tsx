import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRScanner from '../components/QRScanner';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

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
      
      console.log(`Attempting login with UID: ${uid}, method: ${loginMethod}`);
      console.log(`API endpoint: ${endpoint}`);
      
      const tenantSlug = new URLSearchParams(window.location.search).get('tenant');
      
      const requestBody: any = {
        cardUid: uid,
      };
      
      // Only include tenantSlug if it's not null/empty
      if (tenantSlug) {
        requestBody.tenantSlug = tenantSlug;
      }
      
      console.log(`Request body:`, requestBody);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`Response status: ${response.status}`);
      console.log(`Response headers:`, response.headers);

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Response is not JSON:', contentType);
        throw new Error('Server returned invalid response format');
      }

      const responseText = await response.text();
      console.log(`Response text:`, responseText);

      if (!responseText.trim()) {
        throw new Error('Server returned empty response');
      }

      let data: LoginResponse | { error: string; message?: string };
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          data: data
        });
        
        if ('details' in data && Array.isArray((data as any).details)) {
          throw new Error((data as any).details.map((d: any) => d.message).join(', '));
        }
        
        const errorData = data as { error: string; message?: string };
        throw new Error(errorData.error || errorData.message || 'Login failed');
      }

      // Type guard to ensure we have the right response
      if ('success' in data && data.success && 'sessionToken' in data) {
        // Store session data
        localStorage.setItem('customerSession', data.sessionToken);
        localStorage.setItem('customerData', JSON.stringify({
          customer: data.customer,
          card: data.card,
          tenant: data.tenant
        }));

        // Navigate to dashboard
        navigate('/customer/dashboard');
      } else {
        throw new Error('Invalid login response');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <Navbar />

      {/* Main Content */}
      <div className="pt-32 pb-20 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-emerald-200">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" clipRule="evenodd"/>
              </svg>
              <span>Customer Portal</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Access Your Loyalty Card
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Scan your QR card or enter your card ID to view your balance and transaction history
            </p>
          </div>

          {/* Login Card */}
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              {/* Login Method Toggle */}
              <div className="mb-6">
                <div className="flex rounded-xl bg-gray-100 p-1">
                  <button
                    type="button"
                    className={`flex-1 text-center py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                      loginMethod === 'qr'
                        ? 'bg-white text-gray-900 shadow-md transform scale-[1.02]'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    onClick={() => setLoginMethod('qr')}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                      </svg>
                      <span>Scan QR</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`flex-1 text-center py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                      loginMethod === 'manual'
                        ? 'bg-white text-gray-900 shadow-md transform scale-[1.02]'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    onClick={() => setLoginMethod('manual')}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                      </svg>
                      <span>Enter ID</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800 font-medium">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* QR Scanner */}
              {loginMethod === 'qr' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Scan Your QR Card</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Position your QR card within the scanning area
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-6">
                    <QRScanner
                      onScanSuccess={handleQRScan}
                      onError={handleScanError}
                      isActive={loginMethod === 'qr'}
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                      </svg>
                      <div className="text-sm">
                        <p className="text-blue-800 font-medium mb-1">Tips for better scanning:</p>
                        <ul className="text-blue-700 space-y-1">
                          <li>• Make sure your camera has permission</li>
                          <li>• Ensure good lighting conditions</li>
                          <li>• Hold the QR code steady within the frame</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Input */}
              {loginMethod === 'manual' && (
                <form onSubmit={handleManualSubmit} className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Enter Your Card ID</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Type your card ID exactly as printed on your loyalty card
                    </p>
                  </div>

                  <div>
                    <label htmlFor="cardUid" className="block text-sm font-medium text-gray-700 mb-2">
                      Card ID
                    </label>
                    <input
                      id="cardUid"
                      name="cardUid"
                      type="text"
                      value={cardUid}
                      onChange={(e) => setCardUid(e.target.value)}
                      placeholder="Enter your card ID (e.g., A1WPKN0NBR5Y)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-center font-mono text-lg"
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !cardUid.trim()}
                    className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verifying Card...
                      </div>
                    ) : (
                      'Access My Dashboard'
                    )}
                  </button>
                </form>
              )}

              {/* Help Section */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                    </svg>
                    Need Help?
                  </h4>
                  <ul className="text-xs text-gray-600 space-y-2">
                    <li className="flex items-start">
                      <span className="text-emerald-500 mr-2">•</span>
                      Card ID is usually printed on the back of your loyalty card
                    </li>
                    <li className="flex items-start">
                      <span className="text-emerald-500 mr-2">•</span>
                      Make sure your camera is enabled for QR code scanning
                    </li>
                    <li className="flex items-start">
                      <span className="text-emerald-500 mr-2">•</span>
                      Contact the store if your card isn't working properly
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}