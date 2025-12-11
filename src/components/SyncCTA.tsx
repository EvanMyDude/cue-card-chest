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
        className="gap-2"
      >
        <Cloud className="h-4 w-4" />
        Sync across devices
      </Button>

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onPreAuth={onPreAuth}
      />
    </>
  );
}
