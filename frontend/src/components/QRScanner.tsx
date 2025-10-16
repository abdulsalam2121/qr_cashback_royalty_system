import { useState, useRef, useEffect } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (cardUid: string) => void;
  onError?: (error: string) => void;
  isActive: boolean;
}

export default function QRScanner({ onScanSuccess, onError, isActive }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const elementId = 'qr-reader';

  useEffect(() => {
    if (isActive && !isScanning) {
      startScanning();
    } else if (!isActive && isScanning) {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isActive]);

  const startScanning = () => {
    if (scannerRef.current) {
      return; // Already scanning
    }

    try {
      const scanner = new Html5QrcodeScanner(
        elementId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          supportedScanTypes: [Html5QrcodeSupportedFormats.QR_CODE],
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
        },
        false
      );

      scanner.render(
        (decodedText: string) => {
          // QR code successfully scanned
          handleScanSuccess(decodedText);
        },
        (error: string) => {
          // QR scan error (can be ignored for most cases)
          console.debug('QR scan error:', error);
        }
      );

      scannerRef.current = scanner;
      setIsScanning(true);
    } catch (error) {
      console.error('Failed to start QR scanner:', error);
      onError?.('Failed to start camera. Please check camera permissions.');
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
      scannerRef.current = null;
      setIsScanning(false);
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    stopScanning();
    
    // Extract card UID from QR code
    // Assuming QR code contains either just the UID or a URL with the UID
    let cardUid = decodedText;
    
    // If it's a URL, extract the UID parameter
    try {
      const url = new URL(decodedText);
      const uidFromUrl = url.searchParams.get('uid') || url.searchParams.get('cardUid');
      if (uidFromUrl) {
        cardUid = uidFromUrl;
      }
    } catch {
      // Not a URL, use as-is
    }

    // Clean up the UID (remove whitespace, convert to uppercase)
    cardUid = cardUid.trim().toUpperCase();
    
    if (cardUid) {
      onScanSuccess(cardUid);
    } else {
      onError?.('Invalid QR code format');
    }
  };

  return (
    <div className="qr-scanner-container">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Scan Your QR Card</h3>
        <p className="text-sm text-gray-600">
          Position your QR card within the scanning area
        </p>
      </div>
      
      <div className="relative">
        <div id={elementId} className="w-full max-w-md mx-auto" />
        
        {!isScanning && isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Starting camera...</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-800">
                <strong>Tips:</strong> Make sure your camera has permission and good lighting. 
                Hold the QR code steady within the frame.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        #${elementId} {
          border-radius: 0.5rem;
          overflow: hidden;
        }
        
        #${elementId} > div {
          border: none !important;
        }
        
        #${elementId} video {
          border-radius: 0.5rem;
        }
        
        #${elementId} canvas {
          border-radius: 0.5rem;
        }
        
        /* Hide the default html5-qrcode UI elements we don't want */
        #${elementId} > div:last-child {
          margin-top: 1rem;
        }
        
        #${elementId} select {
          padding: 0.5rem;
          border-radius: 0.375rem;
          border: 1px solid #d1d5db;
        }
        
        #${elementId} button {
          background-color: #3b82f6;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          border: none;
          margin: 0.25rem;
        }
        
        #${elementId} button:hover {
          background-color: #2563eb;
        }
      `}</style>
    </div>
  );
}