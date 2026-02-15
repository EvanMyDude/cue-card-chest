import { Cloud, CloudOff, AlertCircle, Loader2, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SyncIndicatorProps {
  status: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  lastSyncAt: Date | null;
  pendingChanges: number;
  error?: string | null;
}

export function SyncIndicator({ status, lastSyncAt, pendingChanges, error }: SyncIndicatorProps) {
  const getIcon = () => {
    switch (status) {
      case 'syncing':
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
      case 'synced':
        return <Check className="h-3.5 w-3.5 text-success" />;
      case 'error':
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      case 'offline':
        return <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />;
      default:
        return <Cloud className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'syncing':
        return 'Syncing...';
      case 'synced':
        return 'Synced';
      case 'error':
        return 'Sync error';
      case 'offline':
        return 'Offline';
      default:
        return 'Idle';
    }
  };

  const formatLastSync = () => {
    if (!lastSyncAt) return 'Never synced';

    const now = new Date();
    const diff = now.getTime() - lastSyncAt.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return lastSyncAt.toLocaleDateString();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/40 cursor-default transition-colors hover:border-border/60">
          {getIcon()}
          <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
            {getStatusText()}
          </span>
          {pendingChanges > 0 && (
            <span className="text-[10px] font-medium bg-primary/15 text-primary px-1.5 py-0.5 rounded-full tabular-nums">
              {pendingChanges}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="bg-popover border-border">
        <div className="space-y-1 text-xs">
          <p className="font-medium">{getStatusText()}</p>
          <p className="text-muted-foreground">Last sync: {formatLastSync()}</p>
          {pendingChanges > 0 && (
            <p className="text-muted-foreground">{pendingChanges} pending changes</p>
          )}
          {error && <p className="text-destructive">{error}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
