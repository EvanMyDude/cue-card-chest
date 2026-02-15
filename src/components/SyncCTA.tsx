import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Cloud } from 'lucide-react';
import { AuthModal } from './AuthModal';

interface SyncCTAProps {
  onPreAuth?: () => void;
}

export function SyncCTA({ onPreAuth }: SyncCTAProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowAuthModal(true)}
        className="gap-1.5 h-8 border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 text-xs"
      >
        <Cloud className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sync</span>
      </Button>

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onPreAuth={onPreAuth}
      />
    </>
  );
}
