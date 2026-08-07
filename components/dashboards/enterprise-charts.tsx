'use client';

import { 
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, 
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Custom Tooltip for premium feel
const PremiumTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
        <p className="text-sm font-semibold mb-2 text-foreground">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-xs text-muted-foreground font-medium">{p.name}</span>
            </div>
            <span className="text-sm font-bold text-foreground">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function EnterpriseAreaChart({ 
  data, 
  title, 
  description, 
  xAxisKey, 
  areas 
}: { 
  data: any[]; 
  title: string; 
  description?: string;
  xAxisKey: string;
  areas: { key: string; name: string; color: string }[];
}) {
  return (
    <Card className="h-full border-gray-100 shadow-premium bg-white rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base font-bold text-gray-900">{title}</CardTitle>
        {description && <CardDescription className="text-gray-500 font-medium">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <defs>
                {areas.map((area, i) => (
                  <linearGradient key={i} id={`color${area.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={area.color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={area.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis 
                dataKey={xAxisKey} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }} 
                dy={10} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }} 
              />
              <Tooltip content={<PremiumTooltip />} />
              {areas.map((area) => (
                <Area
                  key={area.key}
                  type="monotone"
                  dataKey={area.key}
                  name={area.name}
                  stroke={area.color}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill={`url(#color${area.key})`}
                  activeDot={{ r: 6, strokeWidth: 0, fill: area.color }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function EnterpriseBarChart({ 
  data, 
  title, 
  description, 
  xAxisKey, 
  bars,
  stacked = false,
  layout = "horizontal",
  yAxisWidth = 60,
  rounded = false
}: { 
  data: any[]; 
  title: string; 
  description?: string;
  xAxisKey: string;
  bars: { key: string; name: string; color: string; gradientColors?: [string, string] }[];
  stacked?: boolean;
  layout?: "horizontal" | "vertical";
  yAxisWidth?: number;
  rounded?: boolean;
}) {
  return (
    <Card className="h-full border-gray-100 shadow-premium bg-white rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base font-bold text-gray-900">{title}</CardTitle>
        {description && <CardDescription className="text-gray-500 font-medium">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout={layout} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                {bars.map((bar, i) => bar.gradientColors && (
                  <linearGradient key={`grad-${bar.key}`} id={`grad-${bar.key}`} x1="0" y1="0" x2={layout === 'vertical' ? '1' : '0'} y2={layout === 'vertical' ? '0' : '1'}>
                    <stop offset="5%" stopColor={bar.gradientColors[0]} stopOpacity={1} />
                    <stop offset="95%" stopColor={bar.gradientColors[1]} stopOpacity={1} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={layout === 'horizontal'} horizontal={layout === 'vertical'} stroke="#f3f4f6" />
              {layout === 'horizontal' ? (
                <>
                  <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }} width={yAxisWidth} />
                </>
              ) : (
                <>
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }} dy={10} />
                  <YAxis dataKey={xAxisKey} type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }} width={yAxisWidth} />
                </>
              )}
              <Tooltip cursor={{ fill: '#f9fafb' }} content={<PremiumTooltip />} />
              {bars.map((bar) => (
                <Bar
                  key={bar.key}
                  dataKey={bar.key}
                  name={bar.name}
                  fill={bar.gradientColors ? `url(#grad-${bar.key})` : bar.color}
                  radius={rounded ? 100 : (stacked ? [0,0,0,0] : (layout === 'horizontal' ? [4, 4, 0, 0] : [0, 4, 4, 0]))}
                  stackId={stacked ? "a" : undefined}
                  barSize={rounded ? 16 : (layout === 'vertical' ? 16 : undefined)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function EnterpriseDonutChart({ 
  data, 
  title, 
  description,
  dataKey = "value",
  nameKey = "name"
}: { 
  data: any[]; 
  title: string; 
  description?: string;
  dataKey?: string;
  nameKey?: string;
}) {
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <Card className="h-full border-gray-100 shadow-premium bg-white rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base font-bold text-gray-900">{title}</CardTitle>
        {description && <CardDescription className="text-gray-500 font-medium">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={110}
                paddingAngle={2}
                dataKey={dataKey}
                nameKey={nameKey}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PremiumTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function EnterpriseRadarChart({ 
  data, 
  title, 
  description,
  radarKey1,
  radarName1,
  radarColor1,
  radarKey2,
  radarName2,
  radarColor2,
}: { 
  data: any[]; 
  title: string; 
  description?: string;
  radarKey1: string;
  radarName1: string;
  radarColor1: string;
  radarKey2?: string;
  radarName2?: string;
  radarColor2?: string;
}) {
  return (
    <Card className="h-full border-gray-100 shadow-premium bg-white rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base font-bold text-gray-900">{title}</CardTitle>
        {description && <CardDescription className="text-gray-500 font-medium">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip content={<PremiumTooltip />} />
              <Radar name={radarName1} dataKey={radarKey1} stroke={radarColor1} fill={radarColor1} fillOpacity={0.4} />
              {radarKey2 && radarName2 && radarColor2 && (
                <Radar name={radarName2} dataKey={radarKey2} stroke={radarColor2} fill={radarColor2} fillOpacity={0.4} />
              )}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function MiniSparkline({ data, color }: { data: number[], color: string }) {
  const chartData = data.map((v, i) => ({ val: v, index: i }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <Line 
          type="monotone" 
          dataKey="val" 
          stroke={color} 
          strokeWidth={2} 
          dot={false} 
          isAnimationActive={false} 
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
