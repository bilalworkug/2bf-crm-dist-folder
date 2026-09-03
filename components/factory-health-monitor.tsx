'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Database, ScanLine, Camera, Layers, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface FactoryHealthMonitorProps {
  queueCount?: number;
  lastSyncTime?: Date | null;
  className?: string;
}

export function FactoryHealthMonitor({
  queueCount = 0,
  lastSyncTime = null,
  className = '',
}: FactoryHealthMonitorProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'reconnecting' | 'error'>('connected');
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [formattedLastSync, setFormattedLastSync] = useState<string>('Never');

  useEffect(() => {
    // Check initial online status
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);

      const handleOnline = () => {
        setIsOnline(true);
        pingSupabase();
      };
      const handleOffline = () => {
        setIsOnline(false);
        setSupabaseStatus('reconnecting');
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Check camera availability
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices
          .enumerateDevices()
          .then((devices) => {
            const hasVideoInput = devices.some((device) => device.kind === 'videoinput');
            setCameraAvailable(hasVideoInput);
          })
          .catch(() => setCameraAvailable(false));
      } else {
        setCameraAvailable(false);
      }

      // Initial Supabase check
      pingSupabase();

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  async function pingSupabase() {
    try {
      const { error } = await supabase.from('roles').select('key').limit(1);
      if (error) {
        setSupabaseStatus('reconnecting');
      } else {
        setSupabaseStatus('connected');
      }
    } catch {
      setSupabaseStatus('reconnecting');
    }
  }

  useEffect(() => {
    if (lastSyncTime) {
      setFormattedLastSync(
        lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }
  }, [lastSyncTime]);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-500/15 border-2 border-amber-500/40 rounded-xl p-3 flex items-center gap-3 text-amber-900 dark:text-amber-200 animate-pulse">
          <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">Internet Offline. </span>
            <span>Offline queue active — your scans are safely stored locally and will sync automatically when reconnected.</span>
          </div>
        </div>
      )}

      {/* Main Health Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            Factory Health Monitor
          </span>
          <span className="text-[11px] font-normal normal-case text-slate-400">
            Last Sync: {formattedLastSync}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {/* Internet */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <WifiOff className="h-4 w-4 text-amber-500 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 leading-tight">Internet</p>
              <p className={`text-xs font-medium truncate ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>

          {/* Supabase */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <Database className={`h-4 w-4 shrink-0 ${supabaseStatus === 'connected' ? 'text-emerald-500' : 'text-amber-500'}`} />
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 leading-tight">Supabase</p>
              <p className={`text-xs font-medium truncate ${supabaseStatus === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {supabaseStatus === 'connected' ? 'Connected' : 'Reconnecting'}
              </p>
            </div>
          </div>

          {/* Scanner */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <ScanLine className="h-4 w-4 text-sky-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 leading-tight">Scanner</p>
              <p className="text-xs font-medium text-sky-600 dark:text-sky-400 truncate">
                Ready
              </p>
            </div>
          </div>

          {/* Camera */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <Camera className={`h-4 w-4 shrink-0 ${cameraAvailable ? 'text-emerald-500' : cameraAvailable === false ? 'text-slate-400' : 'text-sky-500'}`} />
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 leading-tight">Camera</p>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                {cameraAvailable ? 'Available' : cameraAvailable === false ? 'Unavailable' : 'Checking'}
              </p>
            </div>
          </div>

          {/* Offline Queue */}
          <div className={`col-span-2 sm:col-span-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${
            queueCount > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            <Layers className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 leading-tight">Offline Queue</p>
              <p className="text-xs font-semibold truncate">
                {queueCount > 0 ? `${queueCount} Waiting` : '0 Empty'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
