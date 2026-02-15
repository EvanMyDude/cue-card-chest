import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Lock, Loader2 } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreAuth?: () => void;
}

export function AuthModal({ open, onOpenChange, onPreAuth }: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail, signInWithMagicLink, signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    onPreAuth?.();

    try {
      const { error } = authMode === 'signin'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password');
        } else if (error.message.includes('User already registered')) {
          toast.error('An account with this email already exists. Try signing in instead.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success(authMode === 'signin' ? 'Signed in successfully!' : 'Account created successfully!');
        onOpenChange(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setIsLoading(true);
    onPreAuth?.();

    try {
      const { error } = await signInWithMagicLink(email);
      if (error) {
        toast.error(error.message);
      } else {
        setMagicLinkSent(true);
        toast.success('Magic link sent! Check your email.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    onPreAuth?.();

    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast.error(error.message);
        setIsLoading(false);
      }
      // Don't set loading to false here - redirect will happen
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">Sync across devices</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Sign in to sync your prompts across all your devices
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50 border border-border/40">
            <TabsTrigger value="email" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Email</TabsTrigger>
            <TabsTrigger value="magic" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Magic Link</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4 mt-4">
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-10 bg-input/50 border-border/60 text-sm placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/20"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-10 bg-input/50 border-border/60 text-sm placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/20"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-10 font-medium bg-primary hover:bg-primary/90" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {authMode === 'signin' ? 'Sign In' : 'Create Account'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                disabled={isLoading}
              >
                {authMode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic" className="space-y-4 mt-4">
            {magicLinkSent ? (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 mb-4">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">Check your email</h3>
                <p className="text-xs text-muted-foreground">
                  We sent a magic link to <strong className="text-foreground">{email}</strong>
                </p>
                <Button
                  variant="ghost"
                  className="mt-4 text-xs text-muted-foreground"
                  onClick={() => setMagicLinkSent(false)}
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="magic-email" className="text-xs font-medium text-muted-foreground">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/50" />
                    <Input
                      id="magic-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-10 bg-input/50 border-border/60 text-sm placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/20"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-10 font-medium bg-primary hover:bg-primary/90" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Magic Link
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>

        <div className="relative my-3">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/40" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
            <span className="bg-card px-3 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full h-10 border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border"
          onClick={handleGoogleAuth}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
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
          )}
          Continue with Google
        </Button>
      </DialogContent>
    </Dialog>
  );
}
