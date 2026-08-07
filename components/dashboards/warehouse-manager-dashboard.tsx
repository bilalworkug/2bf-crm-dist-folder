'use client';

import { useAuth } from '@/lib/auth';
import { 
  EnterpriseWelcomeHeader, 
} from './enterprise-components';
import { Card } from '@/components/ui/card';

export function WarehouseManagerDashboard() {
  const { profile } = useAuth();
  return (
    <div className="min-h-screen bg-background px-4 md:px-8 py-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <EnterpriseWelcomeHeader 
          title="Warehouse Manager Dashboard"
          breadcrumbs={["Home", "Warehouse", "Manager"]}
        />
        <Card className="bg-white border-0 shadow-premium rounded-3xl p-6">
          <p className="text-gray-500 text-center py-12">Dashboard coming soon.</p>
        </Card>
      </div>
    </div>
  );
}
