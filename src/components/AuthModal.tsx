import { useState } from 'react';
import { Mail, Loader2, CheckCircle2, AlertCircle, Chrome } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
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

type AuthState = 'idle' | 'sending' | 'sent' | 'error' | 'google-loading';

export function AuthModal({ open, onOpenChange, onSuccess }: AuthModalProps) {
  const { signInWithMagicLink, signInWithGoogle } = useAuth();
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

  const handleGoogleSignIn = async () => {
    setAuthState('google-loading');
    setErrorMessage('');

    const { error } = await signInWithGoogle();

    if (error) {
      setErrorMessage(error.message || 'Failed to sign in with Google');
      setAuthState('error');
    }
    // On success, the page will redirect to Google OAuth
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
          <div className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={authState === 'sending' || authState === 'google-loading'}
                  autoFocus
                />
              </div>

              {authState === 'error' && errorMessage && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errorMessage}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={authState === 'sending' || authState === 'google-loading'}>
                {authState === 'sending' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send magic link
                  </>
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={authState === 'sending' || authState === 'google-loading'}
            >
              {authState === 'google-loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleClose}
              disabled={authState === 'sending' || authState === 'google-loading'}
            >
              Continue without sync
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
