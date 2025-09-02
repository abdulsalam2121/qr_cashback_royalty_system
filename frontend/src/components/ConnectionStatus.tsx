import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';

interface ConnectionStatusProps {
  onConnectionChange?: (isConnected: boolean) => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ onConnectionChange }) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = async () => {
    try {
      await api.healthCheck();
      setIsConnected(true);
      setLastChecked(new Date());
      onConnectionChange?.(true);
    } catch (error) {
      console.error('Connection check failed:', error);
      setIsConnected(false);
      setLastChecked(new Date());
      onConnectionChange?.(false);
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (isConnected === null) {
    return (
      <div className="inline-flex items-center text-gray-500 text-sm">
        <AlertCircle className="w-4 h-4 mr-1 animate-pulse" />
        Checking connection...
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="inline-flex items-center text-red-600 text-sm bg-red-50 px-2 py-1 rounded">
        <WifiOff className="w-4 h-4 mr-1" />
        Connection Lost
        <button
          onClick={checkConnection}
          className="ml-2 text-xs underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center text-green-600 text-sm">
      <Wifi className="w-4 h-4 mr-1" />
      Connected
    </div>
  );
};
