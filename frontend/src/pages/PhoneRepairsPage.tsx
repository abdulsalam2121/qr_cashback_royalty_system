import React from 'react';
import { useParams } from 'react-router-dom';
import PhoneRepairs from '../components/PhoneRepairs/PhoneRepairs';
import { useAuthStore } from '../store/authStore';

const PhoneRepairsPage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useAuthStore();

  if (!tenant || !tenant.id) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return <PhoneRepairs tenantId={tenant.id} />;
};

export default PhoneRepairsPage;
