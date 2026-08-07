'use client';

import { useAuth } from '@/lib/auth';
import { 
  BarChart3, PieChart
} from 'lucide-react';
import { 
  EnterpriseWelcomeHeader, 
  EnterpriseQuickActions,
  QuickAction,
} from './enterprise-components';
import { Card } from '@/components/ui/card';

export function ReportsDashboard() {
  const { profile } = useAuth();

  const actions: QuickAction[] = [
    { label: 'Sales Reports', icon: BarChart3, href: '/reports/sales', count: 'Run', subtitle: 'Revenue data' },
    { label: 'Inventory', icon: PieChart, href: '/reports/inventory', count: 'Run', subtitle: 'Stock levels' },
  ];

  return (
    <div className="min-h-screen bg-background px-4 md:px-8 py-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <EnterpriseWelcomeHeader 
          title="Reporting & Analytics"
          breadcrumbs={["Home", "Reports"]}
        />
        
        <EnterpriseQuickActions actions={actions} />
        
        <Card className="bg-white border-0 shadow-premium rounded-3xl p-6">
          <p className="text-gray-500 text-center py-12">Select a report from the quick actions above to begin analysis.</p>
        </Card>
      </div>
    </div>
  );
}
