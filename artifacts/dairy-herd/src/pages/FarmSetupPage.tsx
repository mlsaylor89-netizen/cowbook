import { useState } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { createFarm, joinFarmByCode } from '@/lib/farmService';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Warehouse, Users, Copy, CheckCheck } from 'lucide-react';

type Step = 'choose' | 'create' | 'join' | 'created';

export function FarmSetupPage() {
  const { user, logout, refreshUserDoc } = useAuth();
  const [step, setStep] = useState<Step>('choose');
  const [farmName, setFarmName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [createdCode, setCreatedCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!farmName.trim()) return;
    setError('');
    setLoading(true);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Request timed out — check your connection and try again')),
        15000,
      ),
    );
    try {
      const { joinCode: code } = await Promise.race([
        createFarm(
          user!.uid,
          user!.email!,
          displayName.trim() || user!.email!,
          farmName.trim(),
        ),
        timeout,
      ]);
      setCreatedCode(code);
      setStep('created');
      await refreshUserDoc();
    } catch (err: unknown) {
      console.error('[createFarm]', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to create farm — check your connection and try again');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setError('');
    setLoading(true);
    try {
      await joinFarmByCode(
        user!.uid,
        user!.email!,
        displayName.trim() || user!.email!,
        joinCode.trim(),
      );
      await refreshUserDoc();
      // AuthGuard will detect farmId is now set and show the main app
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join farm');
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(createdCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black tracking-tight">🐄 HerdTrack</h1>
          <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
          <p className="text-xs text-muted-foreground/50 font-mono">
            {/* Build timestamp — tells us if you have the latest code */}
            v{new Date(__BUILD_TS__).toISOString().slice(0,16).replace('T',' ')}
          </p>
        </div>

        {step === 'choose' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-center">Set up your farm</h2>
            <p className="text-sm text-muted-foreground text-center">
              Create a new farm account or join an existing one with a code.
            </p>
            <button
              className="w-full text-left"
              onClick={() => setStep('create')}
            >
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Warehouse className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">Create a new farm</p>
                    <p className="text-sm text-muted-foreground">Start fresh and invite your team</p>
                  </div>
                </CardContent>
              </Card>
            </button>
            <button
              className="w-full text-left"
              onClick={() => setStep('join')}
            >
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-3 bg-emerald-100 rounded-xl">
                    <Users className="h-6 w-6 text-emerald-700" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">Join an existing farm</p>
                    <p className="text-sm text-muted-foreground">Enter the 6-character join code</p>
                  </div>
                </CardContent>
              </Card>
            </button>
            <button
              type="button"
              onClick={logout}
              className="w-full text-sm text-muted-foreground underline text-center block"
            >
              Sign out
            </button>
          </div>
        )}

        {step === 'create' && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-bold">Create your farm</h2>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1">
                  <Label>Your name</Label>
                  <Input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Farm name</Label>
                  <Input
                    value={farmName}
                    onChange={e => setFarmName(e.target.value)}
                    placeholder="e.g. Sunny Pastures Dairy"
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
                  {loading ? 'Creating…' : 'Create farm'}
                </Button>
              </form>
              <button
                type="button"
                className="text-sm text-primary underline"
                onClick={() => { setStep('choose'); setError(''); }}
              >
                ← Back
              </button>
            </CardContent>
          </Card>
        )}

        {step === 'join' && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-bold">Join a farm</h2>
              <p className="text-sm text-muted-foreground">
                Ask the farm owner for their 6-character join code.
              </p>
              <form onSubmit={handleJoin} className="space-y-3">
                <div className="space-y-1">
                  <Label>Your name</Label>
                  <Input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Join code</Label>
                  <Input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AB3K9Z"
                    maxLength={6}
                    className="font-mono text-lg tracking-widest text-center"
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
                  {loading ? 'Joining…' : 'Join farm'}
                </Button>
              </form>
              <button
                type="button"
                className="text-sm text-primary underline"
                onClick={() => { setStep('choose'); setError(''); }}
              >
                ← Back
              </button>
            </CardContent>
          </Card>
        )}

        {step === 'created' && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-center space-y-1">
                <div className="text-4xl">🎉</div>
                <h2 className="text-xl font-bold">Farm created!</h2>
                <p className="text-sm text-muted-foreground">
                  Share this code so family members can join your farm.
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4 text-center space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Join code</p>
                <p className="text-4xl font-black tracking-widest font-mono">{createdCode}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={copyCode}
                >
                  {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy code'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                You can always find this code in <strong>More → Settings</strong>.
              </p>
              <Button
                className="w-full h-12 font-bold"
                onClick={() => refreshUserDoc()}
              >
                Go to my farm →
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
