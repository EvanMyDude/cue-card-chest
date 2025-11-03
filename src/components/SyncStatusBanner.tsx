/**
 * Persistent sync status banner shown in header
 * Displays current sync state and conflicts
 */

import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SyncStatus } from '@/lib/syncEngine';

interface SyncStatusBannerProps {
  status: SyncStatus;
  conflictCount?: number;
  parkedCount?: number;
  onResolveConflicts?: () => void;
  onRetryParked?: () => void;
  className?: string;
}

export function SyncStatusBanner({
  status,
  conflictCount = 0,
  parkedCount = 0,
  onResolveConflicts,
  onRetryParked,
  className,
}: SyncStatusBannerProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'idle':
        return {
          icon: CheckCircle2,
          text: 'Synced',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          show: false, // Don't show when idle
        };
      case 'syncing':
        return {
          icon: RefreshCw,
          text: 'Syncing...',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          show: true,
          animate: true,
        };
      case 'offline':
        return {
          icon: CloudOff,
          text: 'Offline',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          show: true,
        };
      case 'error':
        return {
          icon: AlertCircle,
          text: 'Sync Error',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          show: true,
        };
      case 'conflicts':
        return {
          icon: AlertCircle,
          text: `${conflictCount} Conflict${conflictCount !== 1 ? 's' : ''}`,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          show: true,
        };
      default:
        return {
          icon: Cloud,
          text: 'Unknown',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          show: false,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Don't render if status is idle and no issues
  if (!config.show && conflictCount === 0 && parkedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 border-b',
        config.bgColor,
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            'h-4 w-4',
            config.color,
            config.animate && 'animate-spin'
          )}
        />
        <span className={cn('text-sm font-medium', config.color)}>
          {config.text}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Parked items indicator */}
        {parkedCount > 0 && (
          <button
            onClick={onRetryParked}
            className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
          >
            {parkedCount} Failed Item{parkedCount !== 1 ? 's' : ''} - Retry
          </button>
        )}

        {/* Conflict resolution button */}
        {status === 'conflicts' && conflictCount > 0 && (
          <button
            onClick={onResolveConflicts}
            className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
          >
            Resolve
          </button>
        )}
      </div>
    </div>
  );
}
