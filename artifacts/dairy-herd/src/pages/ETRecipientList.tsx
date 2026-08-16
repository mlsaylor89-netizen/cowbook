import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Pipette, MapPin, FlaskConical, Trash2, CheckCircle2, XCircle, Clock, Baby } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { ETRecipientRecord } from '@/db';

const STATUS_CONFIG: Record<ETRecipientRecord['status'], { label: string; color: string; icon: React.ReactNode }> = {
  pending:     { label: 'Pending',     color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',   icon: <Clock className="h-3 w-3" /> },
  transferred: { label: 'Transferred', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',       icon: <Pipette className="h-3 w-3" /> },
  pregnant:    { label: 'Pregnant',    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',   icon: <Baby className="h-3 w-3" /> },
  failed:      { label: 'Failed',      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',           icon: <XCircle className="h-3 w-3" /> },
};

export function ETRecipientList() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<ETRecipientRecord['status'] | 'all'>('all');

  const records = useLiveQuery(async () => {
    const all = (await db.etRecipients.toArray()).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );
    const animals = await db.animals.toArray();
    const animalMap = new Map(animals.map(a => [a.id, a]));
    return all.map(r => ({ ...r, linkedAnimal: r.animalId ? animalMap.get(r.animalId) : undefined }));
  });

  const filtered = records?.filter(r => filter === 'all' || r.status === filter) ?? [];

  async function updateStatus(id: string, status: ETRecipientRecord['status']) {
    await db.etRecipients.update(id, { status, updatedAt: new Date().toISOString() });
    toast({ title: 'Status updated' });
  }

  async function deleteRecord(id: string, label: string) {
    if (!confirm(`Remove recipient "${label}"?`)) return;
    await db.etRecipients.delete(id);
    toast({ title: 'Recipient removed' });
  }

  const counts = records ? {
    all: records.length,
    pending: records.filter(r => r.status === 'pending').length,
    transferred: records.filter(r => r.status === 'transferred').length,
    pregnant: records.filter(r => r.status === 'pregnant').length,
    failed: records.filter(r => r.status === 'failed').length,
  } : null;

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/more">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <h2 className="text-xl font-bold">ET Recipients</h2>
        </div>
        <Link href="/et-recipients/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Recipient
          </Button>
        </Link>
      </div>

      {/* Status filter tabs */}
      {counts && counts.all > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'pending', 'transferred', 'pregnant', 'failed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                filter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
              <span className="ml-1.5 opacity-70">{s === 'all' ? counts.all : counts[s]}</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Pipette className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No ET recipients recorded yet.</p>
            <p className="text-sm mt-1">Tap "Add Recipient" to log an animal.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const cfg = STATUS_CONFIG[r.status];
            const displayName = r.linkedAnimal
              ? `${r.linkedAnimal.number ? r.linkedAnimal.number + ' ' : ''}${r.linkedAnimal.barnName || r.linkedAnimal.name}`
              : r.animalIdentifier;

            return (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-lg">{displayName}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      {r.linkedAnimal && r.animalIdentifier !== displayName && (
                        <p className="text-xs text-muted-foreground">ID: {r.animalIdentifier}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => deleteRecord(r.id, displayName)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Detail pills */}
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    {r.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {r.location}
                      </span>
                    )}
                    {(r.embryoIdentifier || r.embryoId) && (
                      <span className="flex items-center gap-1">
                        <FlaskConical className="h-3.5 w-3.5" />
                        {r.embryoIdentifier || 'Embryo linked'}
                      </span>
                    )}
                    {r.transferDate && (
                      <span className="flex items-center gap-1">
                        <Pipette className="h-3.5 w-3.5" />
                        {format(parseISO(r.transferDate), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>

                  {r.notes && (
                    <p className="text-sm text-muted-foreground italic">{r.notes}</p>
                  )}

                  {/* Status actions */}
                  <div className="flex gap-2 flex-wrap pt-1">
                    {r.status !== 'transferred' && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-950/40"
                        onClick={() => updateStatus(r.id, 'transferred')}>
                        <Pipette className="h-3.5 w-3.5" /> Mark Transferred
                      </Button>
                    )}
                    {r.status !== 'pregnant' && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-950/40"
                        onClick={() => updateStatus(r.id, 'pregnant')}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Pregnant
                      </Button>
                    )}
                    {r.status !== 'failed' && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-red-700 border-red-300 hover:bg-red-50 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-950/40"
                        onClick={() => updateStatus(r.id, 'failed')}>
                        <XCircle className="h-3.5 w-3.5" /> Mark Failed
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
