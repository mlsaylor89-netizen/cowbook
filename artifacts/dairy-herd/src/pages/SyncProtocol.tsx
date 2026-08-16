/**
 * Sync Protocol hub:
 *  - Default view: pending / today's events across all active batches
 *  - "Start New Batch" → 4-step wizard:
 *      1. Select animals
 *      2. Choose protocol
 *      3. Set start date + preview schedule
 *      4. Confirm & save
 */

import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO, addDays, addHours, isToday, isPast, isFuture } from 'date-fns';
import { db } from '@/db';
import type { SyncProtocolType } from '@/db';
import { useAuth } from '@/contexts/useAuth';
import { PROTOCOL_DEFS, EVENT_META } from '@/lib/syncProtocolDefs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Check, SkipForward, Plus, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ─────────────────────────────────────────────────────────────────

type WizardStep = 'animals' | 'protocol' | 'date' | 'confirm';

// ─── Helpers ───────────────────────────────────────────────────────────────

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

function animalLabel(a: { number: string; name: string; barnName?: string }) {
  return `${a.number} — ${a.barnName || a.name}`;
}

// ─── Main page ─────────────────────────────────────────────────────────────

export function SyncProtocol() {
  const [view, setView] = useState<'list' | 'new'>('list');

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/more">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Sync Protocols
          </h2>
        </div>
        {view === 'list' && (
          <Button size="sm" onClick={() => setView('new')}>
            <Plus className="h-4 w-4 mr-1" /> New Batch
          </Button>
        )}
        {view === 'new' && (
          <Button variant="ghost" size="sm" onClick={() => setView('list')}>Cancel</Button>
        )}
      </div>

      {view === 'list' ? <EventList /> : <NewBatchWizard onDone={() => setView('list')} />}
    </div>
  );
}

// ─── Event list (default view) ─────────────────────────────────────────────

function EventList() {
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const today = todayStr();

  const data = useLiveQuery(async () => {
    const events = await db.syncEvents
      .where('status').equals('pending')
      .toArray();

    events.sort((a, b) => {
      const d = a.scheduledDate.localeCompare(b.scheduledDate);
      if (d !== 0) return d;
      return (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? '');
    });

    const animalIds = [...new Set(events.map(e => e.animalId))];
    const batchIds  = [...new Set(events.map(e => e.batchId))];

    const [animals, batches] = await Promise.all([
      db.animals.where('id').anyOf(animalIds).toArray(),
      db.syncProtocolBatches.where('id').anyOf(batchIds).toArray(),
    ]);

    const animalMap = new Map(animals.map(a => [a.id, a]));
    const batchMap  = new Map(batches.map(b => [b.id, b]));

    return { events, animalMap, batchMap };
  });

  if (!data) return <div className="p-4 text-muted-foreground text-sm">Loading…</div>;

  const { events, animalMap, batchMap } = data;

  const overdue  = events.filter(e => e.scheduledDate < today);
  const dueToday = events.filter(e => e.scheduledDate === today);
  const upcoming = events.filter(e => e.scheduledDate > today);

  if (events.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground space-y-2">
        <CalendarDays className="h-10 w-10 mx-auto opacity-30" />
        <p className="font-semibold">No active sync events</p>
        <p className="text-sm">Start a new batch to schedule a protocol.</p>
      </div>
    );
  }

  async function markDone(id: string) {
    await db.syncEvents.update(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async function markSkip(id: string) {
    await db.syncEvents.update(id, {
      status: 'skipped',
      updatedAt: new Date().toISOString(),
    });
  }

  function EventRow({ event }: { event: typeof events[0] }) {
    const animal = animalMap.get(event.animalId);
    const meta   = EVENT_META[event.eventType];
    return (
      <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${meta.bgColor} ${meta.color} shrink-0`}>
            {meta.shortLabel}
          </span>
          <div className="min-w-0">
            <span className="font-semibold text-sm truncate block">
              {animal ? animalLabel(animal) : event.animalId}
            </span>
            {event.scheduledTime && (
              <span className="text-xs text-muted-foreground font-medium">{
                (() => {
                  const [h, m] = event.scheduledTime.split(':').map(Number);
                  const d = new Date(); d.setHours(h, m, 0);
                  return format(d, 'h:mm a');
                })()
              }</span>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {event.eventType === 'timed-ai' ? (
            <Link href={`/breeding?animalId=${event.animalId}`}>
              <Button size="sm" className="h-7 text-xs" onClick={() => markDone(event.id)}>
                <Check className="h-3 w-3 mr-1" /> Breed
              </Button>
            </Link>
          ) : (
            <Button size="sm" className="h-7 text-xs" onClick={() => markDone(event.id)}>
              <Check className="h-3 w-3 mr-1" /> Done
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => markSkip(event.id)}>
            <SkipForward className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  function Section({ title, items, accent }: { title: string; items: typeof events; accent: string }) {
    if (items.length === 0) return null;
    return (
      <div>
        <p className={`text-xs font-bold uppercase tracking-wider px-1 mb-2 ${accent}`}>{title} ({items.length})</p>
        <Card className={`shadow-sm ${accent.includes('destructive') ? 'border-destructive/40' : accent.includes('amber') ? 'border-amber-400' : 'border-primary/30'}`}>
          <CardContent className="p-3 divide-y divide-border">
            {items.map(e => <EventRow key={e.id} event={e} />)}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group upcoming by batch for a cleaner view
  const upcomingByBatch = new Map<string, typeof events>();
  for (const e of upcoming) {
    if (!upcomingByBatch.has(e.batchId)) upcomingByBatch.set(e.batchId, []);
    upcomingByBatch.get(e.batchId)!.push(e);
  }

  function toggleBatch(id: string) {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Section title="Overdue" items={overdue} accent="text-destructive" />
      <Section title="Today" items={dueToday} accent="text-amber-700" />

      {/* Upcoming grouped by batch */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider px-1 text-muted-foreground">Upcoming</p>
          {[...upcomingByBatch.entries()].map(([batchId, batchEvents]) => {
            const batch  = batchMap.get(batchId);
            const def    = batch ? PROTOCOL_DEFS[batch.protocol] : null;
            const isOpen = expandedBatches.has(batchId);
            const nextEvent = batchEvents[0];
            return (
              <Card key={batchId} className="shadow-sm">
                <button
                  className="w-full p-3 flex items-center justify-between"
                  onClick={() => toggleBatch(batchId)}
                >
                  <div className="text-left">
                    <p className="font-semibold text-sm">{def?.label ?? batch?.protocol}</p>
                    <p className="text-xs text-muted-foreground">
                      Started {batch?.startDate} · {batchEvents.length} events left ·
                      Next: <span className="font-medium">
                        {format(parseISO(nextEvent.scheduledDate), 'MMM d')}
                        {nextEvent.scheduledTime && ` ${(() => { const [h,m]=nextEvent.scheduledTime.split(':').map(Number); const d=new Date(); d.setHours(h,m,0); return format(d,'h:mm a'); })()}`}
                      </span>
                    </p>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isOpen && (
                  <CardContent className="px-3 pb-3 pt-0 divide-y divide-border border-t">
                    {batchEvents.map(e => <EventRow key={e.id} event={e} />)}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── New Batch Wizard ──────────────────────────────────────────────────────

function NewBatchWizard({ onDone }: { onDone: () => void }) {
  const { farmId } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<WizardStep>('animals');

  // Wizard state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [protocol, setProtocol] = useState<SyncProtocolType | null>(null);
  // startDatetime is stored in the datetime-local input format: 'yyyy-MM-ddTHH:mm'
  const [startDatetime, setStartDatetime] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [saving, setSaving] = useState(false);

  // Derived: date-only portion for batch record & display
  const startDate = startDatetime.slice(0, 10);

  // Animal search
  const [animalSearch, setAnimalSearch] = useState('');

  const animals = useLiveQuery(() =>
    db.animals
      .where('status')
      .noneOf(['Sold', 'Dead'])
      .toArray()
      .then(a => a.sort((x, y) => (x.barnName || x.name).localeCompare(y.barnName || y.name))),
  );

  const filtered = useMemo(() => {
    if (!animals) return [];
    const s = animalSearch.toLowerCase();
    return s
      ? animals.filter(a =>
          a.number.toLowerCase().includes(s) ||
          a.name.toLowerCase().includes(s) ||
          (a.barnName && a.barnName.toLowerCase().includes(s)),
        )
      : animals;
  }, [animals, animalSearch]);

  // Computed schedule for preview — hour-accurate
  const protocolDef = protocol ? PROTOCOL_DEFS[protocol] : null;
  const scheduledEvents = useMemo(() => {
    if (!protocolDef || !startDatetime) return [];
    const base = parseISO(startDatetime);
    return protocolDef.events.map(e => {
      const dt = addHours(base, e.hours);
      return {
        ...e,
        date:        format(dt, 'yyyy-MM-dd'),
        displayDate: format(dt, 'EEE, MMM d'),
        displayTime: format(dt, 'h:mm a'),
      };
    });
  }, [protocolDef, startDatetime]);

  function toggleAnimal(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!filtered) return;
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(a => a.id)));
    }
  }

  async function handleSubmit() {
    if (!protocol || !farmId || selectedIds.size === 0 || !protocolDef) return;
    setSaving(true);
    try {
      const now    = new Date().toISOString();
      const batchId = crypto.randomUUID();

      await db.syncProtocolBatches.add({
        id: batchId,
        farmId,
        protocol,
        startDate,
        animalIds: [...selectedIds],
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      const base = parseISO(startDatetime);
      const events = [];
      for (const animalId of selectedIds) {
        for (const e of protocolDef.events) {
          const eventDt = addHours(base, e.hours);
          events.push({
            id: crypto.randomUUID(),
            farmId,
            batchId,
            animalId,
            day: e.day,
            eventType: e.eventType,
            label: e.label,
            scheduledDate: format(eventDt, 'yyyy-MM-dd'),
            scheduledTime: format(eventDt, 'HH:mm'),
            status: 'pending' as const,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      await db.syncEvents.bulkAdd(events);

      toast({
        title: 'Protocol started',
        description: `${protocolDef.label} for ${selectedIds.size} cow${selectedIds.size !== 1 ? 's' : ''} — ${events.length} events scheduled`,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  const STEPS: WizardStep[] = ['animals', 'protocol', 'date', 'confirm'];
  const stepIdx = STEPS.indexOf(step);

  function StepDots() {
    return (
      <div className="flex items-center gap-2 justify-center">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-2 rounded-full transition-all ${i === stepIdx ? 'w-6 bg-primary' : i < stepIdx ? 'w-2 bg-primary/50' : 'w-2 bg-border'}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StepDots />

      {/* ── Step 1: Animals ── */}
      {step === 'animals' && (
        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-1">Select Cows for this Batch</p>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search number or name…"
              className="pl-9 h-11"
              value={animalSearch}
              onChange={e => setAnimalSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between px-1">
            <button className="text-xs text-primary font-semibold" onClick={toggleAll}>
              {filtered.length > 0 && selectedIds.size === filtered.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-sm text-muted-foreground font-medium">
              {selectedIds.size} selected
            </span>
          </div>
          <Card className="shadow-sm">
            <div className="max-h-72 overflow-y-auto divide-y divide-border">
              {filtered.map(a => {
                const checked = selectedIds.has(a.id);
                return (
                  <button
                    key={a.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-accent/30'}`}
                    onClick={() => toggleAnimal(a.id)}
                  >
                    <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div>
                      <span className="font-bold text-sm">{a.number}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{a.barnName || a.name}</span>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">No animals found</p>
              )}
            </div>
          </Card>
          <Button className="w-full h-12" disabled={selectedIds.size === 0} onClick={() => setStep('protocol')}>
            Next — Choose Protocol
          </Button>
        </div>
      )}

      {/* ── Step 2: Protocol ── */}
      {step === 'protocol' && (
        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-1">
            Choose Protocol ({selectedIds.size} cow{selectedIds.size !== 1 ? 's' : ''})
          </p>
          {(Object.entries(PROTOCOL_DEFS) as [SyncProtocolType, typeof PROTOCOL_DEFS[SyncProtocolType]][]).map(([key, def]) => (
            <button
              key={key}
              className={`w-full text-left rounded-xl border-2 p-4 space-y-2 transition-all ${protocol === key ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
              onClick={() => setProtocol(key)}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold">{def.label}</p>
                <Badge variant="outline" className="text-xs">{def.totalDays}d</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{def.description}</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {def.events.map((e, i) => {
                  const m = EVENT_META[e.eventType];
                  return (
                    <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${m.bgColor} ${m.color}`}>
                      Day {e.day}: {m.shortLabel}
                    </span>
                  );
                })}
              </div>
            </button>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 h-11" onClick={() => setStep('animals')}>Back</Button>
            <Button className="flex-1 h-11" disabled={!protocol} onClick={() => setStep('date')}>Next — Set Date</Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Start date + time of first shot ── */}
      {step === 'date' && protocolDef && (
        <div className="space-y-4">
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-1">
            When is the first shot? (Day 0)
          </p>
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Date and time of first injection — all subsequent events will be timed from this moment.</p>
              <Input
                type="datetime-local"
                className="h-12 text-base"
                value={startDatetime}
                onChange={e => setStartDatetime(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Schedule preview */}
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Schedule Preview</p>
              {scheduledEvents.map((e, i) => {
                const m = EVENT_META[e.eventType];
                const past  = e.date < todayStr();
                const today = e.date === todayStr();
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${m.bgColor} ${m.color} w-20 text-center shrink-0`}>
                      {m.shortLabel}
                    </span>
                    <div className={`flex-1 ${past ? 'line-through text-muted-foreground' : today ? 'text-amber-700' : ''}`}>
                      <span className="text-sm font-semibold">{e.displayDate}</span>
                      <span className="text-xs text-muted-foreground ml-2">{e.displayTime}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">+{e.hours}h</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-11" onClick={() => setStep('protocol')}>Back</Button>
            <Button className="flex-1 h-11" disabled={!startDatetime} onClick={() => setStep('confirm')}>Next — Confirm</Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Confirm ── */}
      {step === 'confirm' && protocolDef && (
        <div className="space-y-4">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Summary</p>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">Protocol</span>
                <span className="font-bold">{protocolDef.label}</span>
                <span className="text-muted-foreground">Cows</span>
                <span className="font-bold">{selectedIds.size}</span>
                <span className="text-muted-foreground">First shot</span>
                <span className="font-bold">{format(parseISO(startDatetime), 'EEE, MMM d h:mm a')}</span>
                <span className="text-muted-foreground">Timed AI</span>
                <span className="font-bold text-primary">
                  {(() => {
                    const aiEvent = scheduledEvents.findLast(e => e.eventType === 'timed-ai');
                    return aiEvent ? `${aiEvent.displayDate} ${aiEvent.displayTime}` : '—';
                  })()}
                </span>
                <span className="text-muted-foreground">Events created</span>
                <span className="font-bold">{selectedIds.size * protocolDef.events.length}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-12" onClick={() => setStep('date')} disabled={saving}>Back</Button>
            <Button className="flex-1 h-12 font-bold" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : 'Start Protocol'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
