import { useState } from 'react';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type AuthState = 'idle' | 'sending' | 'sent' | 'error';

export function AuthModal({ open, onOpenChange, onSuccess }: AuthModalProps) {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setErrorMessage('Please enter your email address');
      setAuthState('error');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address');
      setAuthState('error');
      return;
    }

    setAuthState('sending');
    setErrorMessage('');

    const { error } = await signInWithMagicLink(email);

    if (error) {
      setErrorMessage(error.message || 'Failed to send magic link');
      setAuthState('error');
    } else {
      setAuthState('sent');
    }
  };

  const handleClose = () => {
    setEmail('');
    setAuthState('idle');
    setErrorMessage('');
    onOpenChange(false);
  };

  const handleTryAgain = () => {
    setAuthState('idle');
    setErrorMessage('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Sign in to sync
          </DialogTitle>
          <DialogDescription>
            We'll send you a magic link to sign in. No password needed.
          </DialogDescription>
        </DialogHeader>

        {authState === 'sent' ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="rounded-full bg-primary/10 p-3">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">Check your email</h3>
              <p className="text-sm text-muted-foreground mt-1">
                We sent a magic link to <strong>{email}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Click the link in the email to sign in and start syncing.
              </p>
            </div>
            <Button variant="outline" onClick={handleTryAgain} className="mt-2">
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={authState === 'sending'}
                autoFocus
              />
            </div>

            {authState === 'error' && errorMessage && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Continue without sync
              </Button>
              <Button type="submit" disabled={authState === 'sending'}>
                {authState === 'sending' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send magic link'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
