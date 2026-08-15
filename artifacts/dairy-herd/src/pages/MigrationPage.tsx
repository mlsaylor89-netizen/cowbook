import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { migrateToFirestore, countLocalRecords } from '@/lib/syncService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CloudUpload, CheckCircle2, SkipForward } from 'lucide-react';

export const MIGRATION_KEY_PREFIX = 'dairyHerdMigrated_';

interface Props {
  onComplete: () => void;
}

export function MigrationPage({ onComplete }: Props) {
  const { farmId, userDoc } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<'idle' | 'migrating' | 'done'>('idle');
  const [progress, setProgress] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    countLocalRecords().then(setCounts);
  }, []);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const nonEmpty = Object.entries(counts).filter(([, v]) => v > 0);

  async function handleMigrate() {
    if (!farmId) return;
    setStatus('migrating');
    setError('');
    const nonEmptyCols = nonEmpty.length;
    let done = 0;

    try {
      await migrateToFirestore(farmId, (msg) => {
        setProgress(msg);
        done++;
        setProgressPct(Math.round((done / nonEmptyCols) * 100));
      });
      setStatus('done');
      localStorage.setItem(`${MIGRATION_KEY_PREFIX}${farmId}`, '1');
      setTimeout(onComplete, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Migration failed');
      setStatus('idle');
    }
  }

  function handleSkip() {
    if (!farmId) return;
    localStorage.setItem(`${MIGRATION_KEY_PREFIX}${farmId}`, '1');
    onComplete();
  }

  const farmName = userDoc
    ? `farm account`
    : 'your farm';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black tracking-tight">🐄 HerdTrack</h1>
        </div>

        <Card>
          <CardContent className="p-6 space-y-5">
            {status === 'done' ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                <h2 className="text-xl font-bold">Import complete!</h2>
                <p className="text-sm text-muted-foreground">
                  Your herd data is now synced to the cloud.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <CloudUpload className="h-7 w-7 text-primary shrink-0" />
                  <div>
                    <h2 className="text-lg font-bold leading-tight">Local herd data found</h2>
                    <p className="text-sm text-muted-foreground">
                      Import it into {farmName} so all devices stay in sync.
                    </p>
                  </div>
                </div>

                {/* Summary table */}
                {nonEmpty.length > 0 && (
                  <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                    {nonEmpty.map(([col, count]) => (
                      <div key={col} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">
                          {col.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="font-bold">{count}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className="font-bold">Total records</span>
                      <span className="font-bold">{total}</span>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Your existing local data will <strong>not</strong> be deleted —
                  it stays on this device as a backup.
                </p>

                {status === 'migrating' && (
                  <div className="space-y-2">
                    <Progress value={progressPct} className="h-2" />
                    <p className="text-xs text-muted-foreground">{progress}</p>
                  </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  className="w-full h-12 font-bold gap-2"
                  onClick={handleMigrate}
                  disabled={status === 'migrating'}
                >
                  <CloudUpload className="h-4 w-4" />
                  {status === 'migrating' ? 'Uploading…' : 'Import to cloud'}
                </Button>

                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground flex items-center justify-center gap-1"
                  onClick={handleSkip}
                  disabled={status === 'migrating'}
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip — start fresh in the cloud
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
