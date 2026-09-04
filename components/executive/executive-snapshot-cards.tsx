'use client';

import { SnapshotCardData } from '@/lib/executive-intelligence/executive-types';
import { Card, CardContent } from '@/components/ui/card';
import {
  UserCheck, Package, Calendar, Receipt, TrendingUp,
  Building2, Award, Banknote, ArrowUpRight, ArrowDownRight, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

interface ExecutiveSnapshotCardsProps {
  snapshots: SnapshotCardData[];
  isLoading?: boolean;
}

const ICON_MAP: Record<string, any> = {
  UserCheck,
  Package,
  Calendar,
  Receipt,
  TrendingUp,
  Building2,
  Award,
  Banknote,
};

export function ExecutiveSnapshotCards({ snapshots, isLoading = false }: ExecutiveSnapshotCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-border/60 bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary" />
          Executive Snapshot Highlights
        </h2>
        <span className="text-[11px] text-muted-foreground">Recalculated from live database</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {snapshots.map((item) => {
          const Icon = ICON_MAP[item.iconName] || Award;
          return (
            <Link
              key={item.id}
              href={item.destinationUrl}
              className="group block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl"
            >
              <Card className="h-full border-border/80 bg-card hover:border-primary/50 hover:shadow-sm transition-all duration-200">
                <CardContent className="p-3.5 flex flex-col justify-between h-full">
                  <div>
                    {/* Top Row: Icon + Badge + Arrow */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-1">
                        {item.badge && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/60">
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                    {/* Card Title */}
                    <p className="text-[11px] font-medium text-muted-foreground truncate">{item.title}</p>
                    
                    {/* Entity Name */}
                    <h3 className="text-sm font-bold text-foreground truncate mt-0.5 group-hover:text-primary transition-colors" title={item.name}>
                      {item.name}
                    </h3>
                  </div>

                  {/* Bottom Metric & Trend */}
                  <div className="mt-3 pt-2 border-t border-border/40 flex items-baseline justify-between gap-1">
                    <span className="text-sm sm:text-base font-extrabold text-foreground tracking-tight truncate">
                      {item.metric}
                    </span>
                    {item.subtext && (
                      <span className="text-[10px] text-muted-foreground truncate shrink-0">
                        {item.subtext}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
