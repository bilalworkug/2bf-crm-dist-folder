'use client';

import { useState, useEffect } from 'react';
import { Bookmark, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SavedViewOption {
  id: string;
  label: string;
  badge?: string | number;
}

interface SavedViewsBarProps {
  storageKey: string;
  views: SavedViewOption[];
  activeView: string;
  onSelectView: (viewId: string) => void;
  className?: string;
}

export function SavedViewsBar({
  storageKey,
  views,
  activeView,
  onSelectView,
  className,
}: SavedViewsBarProps) {
  const [currentActive, setCurrentActive] = useState(activeView);

  // Initialize from localStorage if saved preference exists
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`saved_view_${storageKey}`);
      if (saved && views.some((v) => v.id === saved)) {
        setCurrentActive(saved);
        onSelectView(saved);
      } else {
        setCurrentActive(activeView);
      }
    } catch {
      setCurrentActive(activeView);
    }
  }, [storageKey]);

  const handleSelect = (id: string) => {
    setCurrentActive(id);
    onSelectView(id);
    try {
      localStorage.setItem(`saved_view_${storageKey}`, id);
    } catch {}
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1 overflow-x-auto no-scrollbar text-xs',
        className
      )}
    >
      <div className="flex items-center gap-1 text-muted-foreground shrink-0 font-medium mr-1">
        <Bookmark className="h-3.5 w-3.5 text-primary" />
        <span className="hidden sm:inline">Views:</span>
      </div>

      <div className="flex items-center gap-1.5 flex-nowrap">
        {views.map((v) => {
          const isSelected = currentActive === v.id;
          return (
            <button
              key={v.id}
              onClick={() => handleSelect(v.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap touch-press border',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-muted-foreground border-border/80 hover:bg-muted hover:text-foreground'
              )}
            >
              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
              <span>{v.label}</span>
              {v.badge !== undefined && (
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {v.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
