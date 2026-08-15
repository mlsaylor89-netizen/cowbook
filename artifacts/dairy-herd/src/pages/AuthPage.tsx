import { useState } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// ─── Root ──────────────────────────────────────────────────────────────────

type Mode = 'login' | 'signup' | 'forgot';

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* App identity */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black tracking-tight">🐄 HerdTrack</h1>
          <p className="text-sm text-muted-foreground">Dairy herd management</p>
          <p className="text-xs text-muted-foreground/50 font-mono">
            v{new Date(__BUILD_TS__).toISOString().slice(0, 16).replace('T', ' ')}
          </p>
        </div>

        {mode === 'login' && <LoginForm onSwitch={setMode} />}
        {mode === 'signup' && <SignupForm onSwitch={setMode} />}
        {mode === 'forgot' && <ForgotForm onSwitch={setMode} />}
      </div>
    </div>
  );
}

// ─── Login ─────────────────────────────────────────────────────────────────

function LoginForm({ onSwitch }: { onSwitch: (m: Mode) => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(friendlyFirebaseError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Sign in</h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full h-12 text-base font-bold" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <div className="text-center text-sm space-y-1 pt-1">
          <button
            type="button"
            className="text-primary underline block mx-auto"
            onClick={() => onSwitch('forgot')}
          >
            Forgot password?
          </button>
          <p className="text-muted-foreground">
            No account?{' '}
            <button type="button" className="text-primary underline" onClick={() => onSwitch('signup')}>
              Create one
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sign up ───────────────────────────────────────────────────────────────

function SignupForm({ onSwitch }: { onSwitch: (m: Mode) => void }) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setLoading(true);
    try {
      await signup(email, password, name.trim() || email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-up failed';
      setError(friendlyFirebaseError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Create account</h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="e.g. Jane Smith"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="su-email">Email</Label>
            <Input
              id="su-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="su-password">Password</Label>
            <Input
              id="su-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full h-12 text-base font-bold" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <button type="button" className="text-primary underline" onClick={() => onSwitch('login')}>
            Sign in
          </button>
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Forgot password ───────────────────────────────────────────────────────

function ForgotForm({ onSwitch }: { onSwitch: (m: Mode) => void }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed';
      setError(friendlyFirebaseError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Reset password</h2>
        {sent ? (
          <p className="text-sm">
            Check your inbox — a reset link has been sent to <strong>{email}</strong>.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="fp-email">Email</Label>
              <Input
                id="fp-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
        <button
          type="button"
          className="text-sm text-primary underline block"
          onClick={() => onSwitch('login')}
        >
          ← Back to sign in
        </button>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function friendlyFirebaseError(msg: string): string {
  if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential'))
    return 'Incorrect email or password.';
  if (msg.includes('email-already-in-use'))
    return 'An account with this email already exists.';
  if (msg.includes('weak-password'))
    return 'Password must be at least 6 characters.';
  if (msg.includes('invalid-email'))
    return 'Please enter a valid email address.';
  if (msg.includes('network-request-failed'))
    return 'No internet connection. Please try again.';
  return msg;
}
