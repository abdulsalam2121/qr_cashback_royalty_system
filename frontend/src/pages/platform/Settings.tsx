import React, { useState } from 'react';
import { Save, Settings as SettingsIcon, Mail, Shield, Database } from 'lucide-react';

interface SystemSettings {
  smtp: {
    host: string;
    port: number;
    username: string;
    password: string;
    fromEmail: string;
  };
  security: {
    sessionTimeout: number;
    passwordMinLength: number;
    requireTwoFactor: boolean;
  };
  platform: {
    defaultPlan: string;
    trialDays: number;
    allowSignups: boolean;
  };
}

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'smtp' | 'security' | 'platform'>('smtp');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [settings, setSettings] = useState<SystemSettings>({
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      username: '',
      password: '',
      fromEmail: 'noreply@loyaltypro.com'
    },
    security: {
      sessionTimeout: 24,
      passwordMinLength: 8,
      requireTwoFactor: false
    },
    platform: {
      defaultPlan: 'starter',
      trialDays: 14,
      allowSignups: true
    }
  });

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: 'smtp', label: 'Email Settings', icon: Mail },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'platform', label: 'Platform', icon: Database }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-gray-600">Configure system-wide settings</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors ${
            saved 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'smtp' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">SMTP Configuration</h3>
              <div className="grid grid-cols-1 gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={settings.smtp.host}
                      onChange={(e) => setSettings({
                        ...settings,
                        smtp: { ...settings.smtp, host: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Port
                    </label>
                    <input
                      type="number"
                      value={settings.smtp.port}
                      onChange={(e) => setSettings({
                        ...settings,
                        smtp: { ...settings.smtp, port: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={settings.smtp.username}
                    onChange={(e) => setSettings({
                      ...settings,
                      smtp: { ...settings.smtp, username: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Email
                  </label>
                  <input
                    type="email"
                    value={settings.smtp.fromEmail}
                    onChange={(e) => setSettings({
                      ...settings,
                      smtp: { ...settings.smtp, fromEmail: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Security Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session Timeout (hours)
                  </label>
                  <input
                    type="number"
                    value={settings.security.sessionTimeout}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, sessionTimeout: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Password Length
                  </label>
                  <input
                    type="number"
                    value={settings.security.passwordMinLength}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, passwordMinLength: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.security.requireTwoFactor}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, requireTwoFactor: e.target.checked }
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Require Two-Factor Authentication
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'platform' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Platform Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Plan
                  </label>
                  <select
                    value={settings.platform.defaultPlan}
                    onChange={(e) => setSettings({
                      ...settings,
                      platform: { ...settings.platform, defaultPlan: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trial Period (days)
                  </label>
                  <input
                    type="number"
                    value={settings.platform.trialDays}
                    onChange={(e) => setSettings({
                      ...settings,
                      platform: { ...settings.platform, trialDays: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.platform.allowSignups}
                    onChange={(e) => setSettings({
                      ...settings,
                      platform: { ...settings.platform, allowSignups: e.target.checked }
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Allow Public Signups
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
