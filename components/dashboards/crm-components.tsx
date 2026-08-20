'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Phone, Mail, Calendar, FileText, CheckCircle2 } from 'lucide-react';

export function CrmKpiCard({ 
  title, 
  value, 
  trend, 
  trendText, 
  icon: Icon,
  iconBgColor,
  iconColor
}: { 
  title: string, 
  value: string, 
  trend: number, 
  trendText: string,
  icon: React.ElementType,
  iconBgColor: string,
  iconColor: string
}) {
  const isPositive = trend >= 0;
  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-2xl p-5 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        </div>
        <div className={cn("p-2.5 rounded-full flex items-center justify-center", iconBgColor)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
      </div>
      <div className="flex items-center text-xs mt-2">
        <span className={cn("flex items-center font-semibold", isPositive ? "text-emerald-500" : "text-rose-500")}>
          {isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {isPositive ? '+' : ''}{trend}%
        </span>
        <span className="text-gray-400 ml-1.5">{trendText}</span>
      </div>
    </Card>
  );
}

// Custom chevron pipeline visualization
export function PipelineFunnel({ stages, totalValue }: { stages: any[], totalValue: string }) {
  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-2xl h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-gray-900">Sales Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
        
        {/* Visual Pipeline Bar */}
        <div className="w-full flex h-6 mb-8 mt-4 rounded-l-md rounded-r-md overflow-hidden relative gap-[2px]">
          {stages.map((stage, i) => (
            <div 
              key={stage.name} 
              className="h-full relative flex-1"
              style={{ backgroundColor: stage.color }}
            >
              {/* CSS chevron effect (simulated with borders if needed, but for simplicity we use distinct colors and a clean gap) */}
              {i !== stages.length - 1 && (
                <div className="absolute right-[-10px] top-0 w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[10px] z-10" style={{ borderLeftColor: stage.color }}></div>
              )}
              {i !== 0 && (
                <div className="absolute left-0 top-0 w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[10px] z-0 border-l-white"></div>
              )}
            </div>
          ))}
        </div>

        {/* Stage Metrics */}
        <div className="grid grid-cols-5 gap-2 text-left mb-6">
          {stages.map((stage) => (
            <div key={stage.name} className="flex flex-col">
              <span className="text-[11px] font-semibold text-blue-600 mb-1">{stage.name}</span>
              <span className="text-lg font-bold text-gray-900">{stage.count}</span>
              <span className="text-xs text-gray-400 font-medium">{stage.value}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-end border-t pt-4 mt-auto">
          <span className="text-xs text-gray-500 font-medium">Total Pipeline Value</span>
          <span className="text-xl font-bold text-gray-900">{totalValue}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function DealActivityList({ activities }: { activities: any[] }) {
  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-2xl h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-sm font-bold text-gray-900">Deal Activity</CardTitle>
        <button className="text-xs font-semibold text-blue-600 hover:text-blue-700">View All</button>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {activities.map((act, i) => {
            const Icon = act.icon;
            return (
              <div key={i} className="flex items-start gap-4">
                <div className={cn("p-2 rounded-lg flex-shrink-0 mt-0.5", act.colorClass)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{act.title}</p>
                  <p className="text-xs text-gray-500">by {act.user}</p>
                </div>
                <span className="text-xs font-medium text-gray-400 whitespace-nowrap">{act.time}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function TeamPerformance({ team }: { team: any[] }) {
  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-2xl h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-6">
        <CardTitle className="text-sm font-bold text-gray-900">Team Performance</CardTitle>
        <select className="text-xs font-medium text-gray-500 bg-transparent border-0 focus:ring-0 cursor-pointer">
          <option>This Month</option>
          <option>Last Month</option>
        </select>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {team.map((member, i) => (
            <div key={i} className="flex items-center gap-3">
              <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full border border-gray-100 object-cover" />
              <span className="text-xs font-semibold text-gray-700 w-24 truncate">{member.name}</span>
              
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full" 
                    style={{ width: `${Math.min(member.percentage, 100)}%` }} 
                  />
                </div>
                <div className="flex items-center gap-2 w-20 justify-end">
                  <span className="text-xs font-bold text-gray-900">{member.value}</span>
                  <span className="text-[10px] font-medium text-emerald-500 w-7 text-right">{member.percentage}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SimpleListCard({ 
  title, 
  items, 
  type 
}: { 
  title: string, 
  items: any[], 
  type: 'leads' | 'followups' | 'contacts' 
}) {
  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-2xl h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-sm font-bold text-gray-900">{title}</CardTitle>
        <button className="text-xs font-semibold text-blue-600 hover:text-blue-700">View All</button>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              {/* Left visual */}
              {type === 'leads' && (
                <div className={cn("w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0", item.colorClass)}>
                  {item.initial}
                </div>
              )}
              {type === 'followups' && (
                <div className="w-9 h-9 rounded-md bg-blue-50 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-blue-600 uppercase leading-none">{item.month}</span>
                  <span className="text-xs font-bold text-blue-900 leading-none mt-1">{item.day}</span>
                </div>
              )}
              {type === 'contacts' && (
                <img src={item.avatar} alt={item.name} className="w-8 h-8 rounded-full border border-gray-100 object-cover shrink-0" />
              )}

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-900 truncate">{item.title}</p>
                <p className="text-[11px] text-gray-500 truncate">{item.subtitle}</p>
              </div>

              {/* Right content */}
              <div className="shrink-0 text-right">
                {type === 'leads' && (
                  <span className="text-[11px] font-medium text-gray-400">{item.time}</span>
                )}
                {type === 'followups' && (
                  <div className="flex items-center text-gray-400 gap-1">
                    <item.icon className="w-3 h-3" />
                    <span className="text-[11px] font-medium">{item.time}</span>
                  </div>
                )}
                {type === 'contacts' && (
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {item.company}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
