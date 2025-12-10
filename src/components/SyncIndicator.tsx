import { Check, RefreshCw, AlertCircle, WifiOff, Cloud } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SyncStatus } from '@/hooks/useSyncQueue';

interface SyncIndicatorProps {
  status: SyncStatus;
  pendingCount: number;
  lastSyncAt: string | null;
}

export function SyncIndicator({ status, pendingCount, lastSyncAt }: SyncIndicatorProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'offline':
        return <WifiOff className="h-4 w-4" />;
      case 'idle':
      default:
        return pendingCount > 0 ? <Cloud className="h-4 w-4" /> : <Check className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'syncing':
        return 'text-primary';
      case 'error':
        return 'text-destructive';
      case 'offline':
        return 'text-muted-foreground';
      case 'idle':
      default:
        return pendingCount > 0 ? 'text-amber-500' : 'text-emerald-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync error';
      case 'offline':
        return 'Offline';
      case 'idle':
      default:
        return pendingCount > 0 ? `${pendingCount} pending` : 'Synced';
    }
  };

  const getTooltipContent = () => {
    const lines = [getStatusText()];
    
    if (pendingCount > 0 && status !== 'syncing') {
      lines.push(`${pendingCount} change${pendingCount > 1 ? 's' : ''} waiting to sync`);
    }
    
    if (lastSyncAt) {
      const date = new Date(lastSyncAt);
      lines.push(`Last synced: ${date.toLocaleTimeString()}`);
    }
    
    return lines.join('\n');
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm cursor-default',
            'transition-colors duration-200',
            getStatusColor()
          )}>
            {getStatusIcon()}
            <span className="hidden md:inline text-xs">{getStatusText()}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="whitespace-pre-line">{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
