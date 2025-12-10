import { Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SyncCTAProps {
  onClick: () => void;
}

export function SyncCTA({ onClick }: SyncCTAProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-2"
    >
      <Cloud className="h-4 w-4" />
      <span className="hidden sm:inline">Sync across devices</span>
      <span className="sm:hidden">Sync</span>
    </Button>
  );
}
