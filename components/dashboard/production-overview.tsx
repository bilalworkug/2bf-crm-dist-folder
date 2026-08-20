'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Factory } from 'lucide-react';
import { ProductPerformanceRow } from '@/lib/dashboard/dashboard-types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardEmptyState } from './dashboard-empty-state';

export function ProductionOverviewWidget({ productData }: { productData: ProductPerformanceRow[] }) {
  const chartData = productData
    .filter(p => p.produced > 0)
    .sort((a, b) => b.produced - a.produced)
    .map(p => ({ name: p.productName, produced: p.produced }));

  return (
    <Card className="col-span-full lg:col-span-2 shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-bold flex items-center">
          <Factory className="w-5 h-5 mr-2 text-purple-500" />
          Production by Product
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <DashboardEmptyState
            title="No production data"
            description="No production recorded for the selected period."
            icon={<Factory className="h-8 w-8" />}
            className="border-none bg-slate-50 dark:bg-slate-900/50"
          />
        ) : (
          <div className="h-[320px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  angle={-45} 
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc', opacity: 0.5 }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Bar dataKey="produced" name="Boxes Produced" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
