import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '@/db';
import { getDIM } from '@/db/computed';
import { Link, useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Edit, Activity, Heart, Droplet, Baby, StickyNote, Trash2, Award, Pill, CheckCircle2, AlertTriangle, Thermometer } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

/** Safely format an ISO date string — returns fallback if missing or invalid. */
function fmt(dateStr: string | undefined | null, pattern: string, fallback = '—') {
  if (!dateStr) return fallback;
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, pattern) : fallback;
  } catch {
    return fallback;
  }
}
import { LactationBadge, ReproBadge } from './HerdList';
import { lactStat, reproStat } from '@/db/computed';
import type { ClassificationScore, Treatment } from '@/db';

export function AnimalDetail() {
  const [match, params] = useRoute('/herd/:id');
  const id = params?.id;

  const data = useLiveQuery(async () => {
    if (!id) return null;
    const animal = await db.animals.get(id);
    if (!animal) return null;

    const breedings = await db.breedings.where('animalId').equals(id).reverse().sortBy('date');
    const calvings = await db.calvings.where('animalId').equals(id).reverse().sortBy('calvingDate');
    const treatments = await db.treatments.where('animalId').equals(id).reverse().sortBy('date');
    const pregChecks = await db.pregnancyChecks.where('animalId').equals(id).reverse().sortBy('checkDate');
    const notes = await db.animalNotes.where('animalId').equals(id).reverse().sortBy('createdAt');
    const classifications = await db.classifications.where('animalId').equals(id).reverse().sortBy('date');
    const heats = await db.heats.where('animalId').equals(id).reverse().sortBy('observedAt');

    return { animal, breedings, calvings, treatments, pregChecks, notes, classifications, heats };
  }, [id]);

  if (data === undefined) return <div className="p-4">Loading...</div>;
  if (data === null) return <div className="p-4">Animal not found.</div>;

  const { animal, breedings, calvings, treatments, pregChecks, notes, classifications, heats } = data;
  const dim = getDIM(animal);

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/herd">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold">{animal.number} {animal.barnName || animal.name}</h2>
            {animal.barnName && <p className="text-sm text-muted-foreground leading-tight">{animal.name}</p>}
          </div>
        </div>
        <Link href={`/herd/${animal.id}/edit`}>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Link href={`/heat?animalId=${animal.id}`} className="block">
          <Button variant="outline" className="w-full h-14 bg-card hover:bg-accent/10 border-border">
            <Thermometer className="h-4 w-4 mr-2 text-rose-500" /> Heat
          </Button>
        </Link>
        <Link href={`/breeding?animalId=${animal.id}`} className="block">
          <Button variant="outline" className="w-full h-14 bg-card hover:bg-accent/10 border-border">
            <Heart className="h-4 w-4 mr-2 text-destructive" /> Breed
          </Button>
        </Link>
        <Link href={`/calving?animalId=${animal.id}`} className="block">
          <Button variant="outline" className="w-full h-14 bg-card hover:bg-accent/10 border-border">
            <Baby className="h-4 w-4 mr-2 text-primary" /> Calve
          </Button>
        </Link>
        <Link href={`/preg-check?animalId=${animal.id}`} className="block">
          <Button variant="outline" className="w-full h-14 bg-card hover:bg-accent/10 border-border">
            <Activity className="h-4 w-4 mr-2 text-blue-600" /> Preg Check
          </Button>
        </Link>
        <Link href={`/treatment?animalId=${animal.id}`} className="block">
          <Button variant="outline" className="w-full h-14 bg-card hover:bg-accent/10 border-border">
            <Droplet className="h-4 w-4 mr-2 text-purple-600" /> Treat
          </Button>
        </Link>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Status row */}
          <div className="flex items-center gap-3 flex-wrap">
            <LactationBadge status={lactStat(animal)} />
            <ReproBadge status={reproStat(animal)} />
            {dim !== null && (
              <span className="text-sm text-muted-foreground">{dim} DIM</span>
            )}
          </div>

          {animal.expectedCalvingDate && (
            <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-900">
              <p className="text-xs text-amber-800 dark:text-amber-500 uppercase font-bold">Due Date</p>
              <p className="font-bold text-amber-900 dark:text-amber-400">{format(parseISO(animal.expectedCalvingDate), 'MMM d, yyyy')}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Lactation #</p>
              <p className="font-bold">{animal.lactationNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Breed</p>
              <p className="font-bold">{animal.breed}</p>
            </div>
            {animal.lastCalvingDate && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Last Calving</p>
                <p className="font-bold">{format(parseISO(animal.lastCalvingDate), 'MMM d, yyyy')}</p>
              </div>
            )}
            {animal.birthDate && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Date of Birth</p>
                <p className="font-bold">{format(parseISO(animal.birthDate), 'MMM d, yyyy')}</p>
              </div>
            )}
            {animal.sire && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Sire</p>
                <p className="font-bold">{animal.sire}</p>
              </div>
            )}
            {animal.dam && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Dam</p>
                <p className="font-bold">{animal.dam}</p>
              </div>
            )}
            {animal.rfidTag && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">RFID</p>
                <p className="font-bold font-mono text-sm">{animal.rfidTag}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">History</h3>
        
        {treatments.filter(t => t.milkWithholdUntil && new Date(t.milkWithholdUntil) > new Date()).length > 0 && (
          <div className="bg-destructive text-destructive-foreground p-3 rounded-md font-bold uppercase tracking-wider text-sm flex items-center justify-center">
            Milk Withhold - Do Not Ship
          </div>
        )}

        <div className="space-y-3">
          {/* Unified chronological timeline */}
          {[
            ...breedings.map(b => ({ type: 'breeding' as const, date: b.date ?? '', item: b })),
            ...calvings.map(c => ({ type: 'calving'  as const, date: c.calvingDate ?? '', item: c })),
            ...heats.map(h =>    ({ type: 'heat'     as const, date: h.observedAt ?? '',  item: h })),
          ]
            .sort((a, b) => {
              const ta = a.date ? new Date(a.date).getTime() : 0;
              const tb = b.date ? new Date(b.date).getTime() : 0;
              return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
            })
            .map(entry => {
              if (entry.type === 'breeding') {
                const b = entry.item as (typeof breedings)[0];
                return (
                  <Card key={`b-${b.id}`}>
                    <CardContent className="p-3 flex items-start gap-3">
                      <Heart className="h-5 w-5 mt-0.5 text-destructive shrink-0" />
                      <div>
                        <p className="font-bold">{b.breedingType} Breeding</p>
                        <p className="text-sm text-muted-foreground">{fmt(b.date, 'MMM d, yyyy')} · Bull: {b.bullId || 'Unknown'}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              if (entry.type === 'calving') {
                const c = entry.item as (typeof calvings)[0];
                return (
                  <Card key={`c-${c.id}`}>
                    <CardContent className="p-3 flex items-start gap-3">
                      <Baby className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                      <div>
                        <p className="font-bold">Calved ({c.calfSex})</p>
                        <p className="text-sm text-muted-foreground">{fmt(c.calvingDate, 'MMM d, yyyy')}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              // heat
              const h = entry.item as (typeof heats)[0];
              const statusLabel = h.status === 'bred' ? 'Bred' : h.status === 'missed' ? 'Dismissed' : 'Pending';
              const statusColor  = h.status === 'bred' ? 'text-green-600' : h.status === 'missed' ? 'text-muted-foreground' : 'text-amber-600';
              return (
                <Card key={`h-${h.id}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <Thermometer className="h-5 w-5 mt-0.5 text-rose-500 shrink-0" />
                    <div>
                      <p className="font-bold">Heat Observed — {h.breedingType === 'sexed' ? 'Sexed' : 'Conventional'}</p>
                      <p className="text-sm text-muted-foreground">
                        {fmt(h.observedAt, 'MMM d, yyyy h:mm a')}
                        {h.scheduledBreedAt ? <>{' · '}Breed by {fmt(h.scheduledBreedAt, 'h:mm a')}</> : null}
                      </p>
                      <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          }
          {breedings.length === 0 && calvings.length === 0 && heats.length === 0 && pregChecks.length === 0 && (
            <p className="text-muted-foreground text-center py-4 text-sm">No history records.</p>
          )}
        </div>
      </div>

      {/* Treatments */}
      <TreatmentsSection animalId={animal.id} treatments={treatments} />

      {/* Classifications */}
      <ClassificationsSection animalId={animal.id} classifications={classifications} />

      {/* Notes */}
      <NotesSection animalId={animal.id} notes={notes} />
    </div>
  );
}

function TreatmentsSection({ animalId, treatments }: { animalId: string; treatments: Treatment[] }) {
  const now = new Date();
  const active = treatments.filter(t => !t.resolved);
  const resolved = treatments.filter(t => t.resolved);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-bold">Treatments</h3>
        </div>
        <Link href={`/treatment?animalId=${animalId}`}>
          <Button size="sm" variant="outline">+ Add</Button>
        </Link>
      </div>

      {treatments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">No treatment records yet.</p>
      ) : (
        <div className="space-y-2">
          {[...active, ...resolved].map(t => {
            const milkExpiry = t.milkWithholdUntil ? new Date(t.milkWithholdUntil) : null;
            const meatExpiry = t.meatWithholdUntil ? new Date(t.meatWithholdUntil) : null;
            const milkActive = milkExpiry && milkExpiry > now;
            const meatActive = meatExpiry && meatExpiry > now;
            const milkDaysLeft = milkExpiry ? Math.ceil((milkExpiry.getTime() - now.getTime()) / 86400000) : 0;
            const meatDaysLeft = meatExpiry ? Math.ceil((meatExpiry.getTime() - now.getTime()) / 86400000) : 0;

            return (
              <Card key={t.id} className={!t.resolved && (milkActive || meatActive) ? 'border-destructive/50' : ''}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <Pill className="h-4 w-4 mt-0.5 text-purple-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold">{t.condition}</p>
                          {t.resolved ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3" /> Resolved
                            </span>
                          ) : (milkActive || meatActive) ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 border border-destructive/30 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="h-3 w-3" /> Withholding
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {format(parseISO(t.date), 'MMM d, yyyy')} · {t.product}
                          {t.dose ? ` · ${t.dose}` : ''}
                          {t.route ? ` · ${t.route}` : ''}
                        </p>
                        {(milkActive || meatActive) && (
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {milkActive && (
                              <span className="text-xs font-semibold text-destructive">
                                🥛 Milk withhold: {milkDaysLeft}d left ({format(milkExpiry!, 'MMM d')})
                              </span>
                            )}
                            {meatActive && (
                              <span className="text-xs font-semibold text-orange-700">
                                🥩 Meat withhold: {meatDaysLeft}d left ({format(meatExpiry!, 'MMM d')})
                              </span>
                            )}
                          </div>
                        )}
                        {t.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{t.notes}</p>
                        )}
                      </div>
                    </div>
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

const SCORE_COLOR: Record<string, string> = {
  E: 'text-emerald-700 bg-emerald-50 border-emerald-300',
  VG: 'text-green-700 bg-green-50 border-green-300',
  'G+': 'text-lime-700 bg-lime-50 border-lime-300',
  G: 'text-yellow-700 bg-yellow-50 border-yellow-300',
  F: 'text-orange-700 bg-orange-50 border-orange-300',
  P: 'text-red-700 bg-red-50 border-red-300',
};

function ClassificationsSection({ animalId, classifications }: { animalId: string; classifications: ClassificationScore[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-bold">Classification</h3>
        </div>
        <Link href={`/classification?animalId=${animalId}`}>
          <Button size="sm" variant="outline">+ Add</Button>
        </Link>
      </div>

      {classifications.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">No classification records yet.</p>
      ) : (
        <div className="space-y-2">
          {classifications.map(c => (
            <Card key={c.id}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {c.finalScore && (
                    <span className={`shrink-0 border rounded px-2 py-0.5 text-sm font-bold ${SCORE_COLOR[c.finalScore]}`}>
                      {c.finalScore}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold">{c.finalPoints ? `${c.finalPoints} pts` : '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {format(parseISO(c.date), 'MMM d, yyyy')}{c.classifier ? ` · ${c.classifier}` : ''}
                    </p>
                    {c.notes && <p className="text-xs text-muted-foreground italic truncate">{c.notes}</p>}
                  </div>
                </div>
                <Link href={`/classification?animalId=${animalId}&editId=${c.id}`}>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesSection({ animalId, notes }: { animalId: string; notes: any[] }) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  async function addNote() {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    await db.animalNotes.add({
      id: self.crypto.randomUUID(),
      animalId,
      note: text,
      createdAt: new Date().toISOString(),
    });
    setDraft('');
    setSaving(false);
  }

  async function deleteNote(id: string) {
    await db.animalNotes.delete(id);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <StickyNote className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-bold">Notes</h3>
      </div>

      {/* Add note */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Add a note about this animal…"
            className="text-base min-h-[80px] resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote();
            }}
          />
          <Button
            className="w-full h-11"
            onClick={addNote}
            disabled={!draft.trim() || saving}
          >
            Save Note
          </Button>
        </CardContent>
      </Card>

      {/* Existing notes */}
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map(n => (
            <Card key={n.id}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">
                    {format(parseISO(n.createdAt), 'MMM d, yyyy · h:mm a')}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                </div>
                <button
                  onClick={() => deleteNote(n.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
                  aria-label="Delete note"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
