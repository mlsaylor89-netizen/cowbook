import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useLocation, Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Trash2, FlaskConical, Syringe } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { FlushRecord } from '@/db';

// ── stats helpers ───────────────────────────────────────────────────────────

function getStats(r: FlushRecord) {
  const g1 = r.grade1Count ?? 0;
  const g2 = r.grade2Count ?? 0;
  const g3 = r.grade3Count ?? 0;
  const fertilized = g1 + g2 + g3;

  if (r.flushType === 'conventional') {
    const unfert = r.unfertilizedCount ?? 0;
    const total = fertilized + unfert;
    const pctFert = total > 0 ? (fertilized / total) * 100 : null;
    const pctG1 = fertilized > 0 ? (g1 / fertilized) * 100 : null;
    const pctG2 = fertilized > 0 ? (g2 / fertilized) * 100 : null;
    const pctG3 = fertilized > 0 ? (g3 / fertilized) * 100 : null;
    return { fertilized, total, pctFert, pctG1, pctG2, pctG3, unfert };
  } else {
    const oocytes = r.oocyteCount ?? 0;
    const pctFert = oocytes > 0 ? (fertilized / oocytes) * 100 : null;
    const pctG1 = fertilized > 0 ? (g1 / fertilized) * 100 : null;
    const pctG2 = fertilized > 0 ? (g2 / fertilized) * 100 : null;
    const pctG3 = fertilized > 0 ? (g3 / fertilized) * 100 : null;
    return { fertilized, total: oocytes, pctFert, pctG1, pctG2, pctG3, oocytes };
  }
}

function fmt(n: number | null) {
  if (n === null) return '—';
  return `${Math.round(n)}%`;
}

// ── component ───────────────────────────────────────────────────────────────

export function FlushHistory() {
  const [, navigate] = useLocation();

  const data = useLiveQuery(async () => {
    const records = await db.flushRecords.orderBy('flushDate').reverse().toArray();
    const animals = await db.animals.toArray();
    const animalMap = new Map(animals.map(a => [a.id, a]));
    return records.map(r => {
      // Use free-text donor name if available (new records), fall back to herd lookup (legacy)
      const donorLabel = r.donorCowName
        ?? (() => { const a = r.animalId ? animalMap.get(r.animalId) : undefined; return a?.barnName || a?.name; })()
        ?? 'Unknown donor';
      return { record: r, donorLabel };
    });
  });

  async function deleteRecord(id: string) {
    await db.flushRecords.delete(id);
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/more">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold flex-1">Flush History</h2>
        <Button size="sm" onClick={() => navigate('/flush/new')}>
          <Plus className="h-4 w-4 mr-2" /> Record Flush
        </Button>
      </div>

      {data === undefined ? (
        <div className="p-4 text-center">Loading…</div>
      ) : data.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground border rounded-xl border-dashed space-y-2">
          <FlaskConical className="h-10 w-10 mx-auto opacity-30" />
          <p className="font-semibold">No flush records yet.</p>
          <Button size="sm" onClick={() => navigate('/flush/new')}>Record First Flush</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map(({ record: r, donorLabel }) => {
            const s = getStats(r);
            const isIVF = r.flushType === 'ivf';
            return (
              <Card key={r.id} className="shadow-sm">
                <CardContent className="p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-lg truncate">{donorLabel}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(r.flushDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                        isIVF
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {isIVF ? 'IVF' : 'Conventional'}
                      </span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete flush record?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this flush record. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90 text-white"
                              onClick={() => deleteRecord(r.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Sire */}
                  {r.sireName && (
                    <p className="text-sm flex items-center gap-1.5 text-muted-foreground">
                      <Syringe className="h-4 w-4 shrink-0" />
                      Sire: <span className="font-semibold text-foreground">{r.sireName}</span>
                    </p>
                  )}

                  {/* Key stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* IVF: oocytes; Conventional: total collected */}
                    <StatChip
                      label={isIVF ? 'Oocytes' : 'Total Collected'}
                      value={String(isIVF ? (r.oocyteCount ?? 0) : s.total)}
                    />
                    <StatChip
                      label="Embryos"
                      value={String(s.fertilized)}
                      highlight
                    />
                    <StatChip
                      label="% Fertilized"
                      value={fmt(s.pctFert)}
                    />
                    {!isIVF && (
                      <StatChip
                        label="Unfertilized"
                        value={String(r.unfertilizedCount ?? 0)}
                      />
                    )}
                  </div>

                  {/* Grade breakdown */}
                  {s.fertilized > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Grade 1', count: r.grade1Count ?? 0, pct: s.pctG1, color: 'bg-green-100 text-green-800' },
                        { label: 'Grade 2', count: r.grade2Count ?? 0, pct: s.pctG2, color: 'bg-yellow-100 text-yellow-800' },
                        { label: 'Grade 3', count: r.grade3Count ?? 0, pct: s.pctG3, color: 'bg-orange-100 text-orange-800' },
                      ].filter(g => g.count > 0).map(g => (
                        <span key={g.label} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${g.color}`}>
                          {g.label}: {g.count} ({fmt(g.pct)})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {r.notes && (
                    <p className="text-sm text-muted-foreground italic">{r.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${highlight ? 'bg-primary/10' : 'bg-muted'}`}>
      <p className={`text-lg font-bold ${highlight ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}
