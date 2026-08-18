import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useSearch, Link } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, addHours, parseISO } from 'date-fns';
import { db } from '@/db';
import { useAuth } from '@/contexts/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Search, Thermometer, Clock, Bell, Pipette, Eye, HeartPulse } from 'lucide-react';
import {
  requestNotificationPermission,
  scheduleHeatNotifications,
} from '@/lib/heatNotifications';
import { useToast } from '@/hooks/use-toast';

type HeatAction = 'breed' | 'et-recipient' | 'pass';

function toLocalDatetimeValue(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function displayAnimal(a: { name: string; barnName?: string; number: string }) {
  return `${a.number} — ${a.barnName || a.name}`;
}

function safeParse(val: string): Date {
  try { return parseISO(val); } catch { return new Date(); }
}

export function RecordHeat() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { farmId } = useAuth();
  const { toast } = useToast();

  const presetAnimalId = new URLSearchParams(search).get('animalId') ?? '';

  // Step 1: animal selection
  const [animalSearch, setAnimalSearch] = useState('');
  const [selectedAnimalId, setSelectedAnimalId] = useState(presetAnimalId);

  // Step 2: form fields
  const [observedAt, setObservedAt] = useState(() => toLocalDatetimeValue(new Date()));
  const [heatAction, setHeatAction] = useState<HeatAction>('breed');
  const [breedingType, setBreedingType] = useState<'conventional' | 'sexed'>('conventional');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Load all active animals for picker
  const animals = useLiveQuery(() =>
    db.animals
      .where('status')
      .noneOf(['Sold', 'Dead'])
      .toArray()
      .then(a => a.sort((x, y) => (x.barnName || x.name).localeCompare(y.barnName || y.name))),
  );

  const selectedAnimal = useMemo(
    () => animals?.find(a => a.id === selectedAnimalId),
    [animals, selectedAnimalId],
  );

  const filteredAnimals = useMemo(() => {
    if (!animals) return [];
    const s = animalSearch.toLowerCase();
    if (!s) return animals;
    return animals.filter(
      a =>
        a.number.toLowerCase().includes(s) ||
        a.name.toLowerCase().includes(s) ||
        (a.barnName && a.barnName.toLowerCase().includes(s)),
    );
  }, [animals, animalSearch]);

  // Load breeding timing from settings (fall back to defaults if not yet saved)
  const settings = useLiveQuery(() => db.settings.get('default'));
  const conventionalHours   = settings?.conventionalBreedingHours ?? 12;
  const sexedHours          = settings?.sexedBreedingHours        ?? 30;
  const etHours             = settings?.embryoTransferHours       ?? 168;
  const sexedMaxService     = settings?.sexedSemenMaxService      ?? 2;

  // Service number = breedings since last calving + 1
  const serviceNumber = useLiveQuery(async () => {
    if (!selectedAnimalId) return null;
    const [calvings, breedings] = await Promise.all([
      db.calvings.where('animalId').equals(selectedAnimalId).toArray(),
      db.breedings.where('animalId').equals(selectedAnimalId).toArray(),
    ]);
    const lastCalving = calvings.sort((a, b) => b.calvingDate.localeCompare(a.calvingDate))[0];
    const sinceDate = lastCalving?.calvingDate ?? '1900-01-01';
    const count = breedings.filter(b => b.date.slice(0, 10) >= sinceDate).length;
    return count + 1;
  }, [selectedAnimalId]);

  // Auto-default semen type when animal or settings threshold changes
  // Use a ref to avoid overriding a manual selection within the same animal
  const lastAutoAnimalId = useRef<string>('');
  useEffect(() => {
    if (serviceNumber == null) return;
    // Always re-default when switching to a new animal; also apply on first load
    if (selectedAnimalId !== lastAutoAnimalId.current) {
      lastAutoAnimalId.current = selectedAnimalId;
      setBreedingType(serviceNumber <= sexedMaxService ? 'sexed' : 'conventional');
    }
  }, [selectedAnimalId, serviceNumber, sexedMaxService]);

  // Computed times — all derived from the observed heat datetime
  const observedDt = useMemo(() => safeParse(observedAt), [observedAt]);

  const hoursToBreed = breedingType === 'sexed' ? sexedHours : conventionalHours;

  // All times derived from the observed heat datetime — declared in dependency order
  const scheduledBreedAt   = useMemo(() => addHours(observedDt, hoursToBreed),  [observedDt, hoursToBreed]);
  const etScheduledAt      = useMemo(() => addHours(observedDt, etHours),       [observedDt, etHours]);
  const etAlertAt          = useMemo(() => addHours(etScheduledAt, -1),         [etScheduledAt]);
  // Next heat: exactly 21 days (504 h) from the recorded heat — NOT from breeding time
  const nextHeatExpectedAt = useMemo(() => addHours(observedDt, 504),           [observedDt]);

  // Request notification permission on mount
  useEffect(() => { requestNotificationPermission(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAnimalId || !farmId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const id  = crypto.randomUUID();

      if (heatAction === 'breed') {
        const breedISO = scheduledBreedAt.toISOString();
        const alertISO = addHours(scheduledBreedAt, -1).toISOString();
        await db.heats.add({
          id, animalId: selectedAnimalId, farmId,
          observedAt: observedDt.toISOString(),
          heatAction: 'breed',
          breedingType,
          scheduledBreedAt: breedISO,
          alertAt: alertISO,
          status: 'pending',
          notes: notes.trim() || undefined,
          createdAt: now, updatedAt: now,
        });
        await requestNotificationPermission();
        scheduleHeatNotifications(id, breedISO, alertISO,
          selectedAnimal ? (selectedAnimal.barnName || selectedAnimal.name) : 'Cow',
          breedingType);
        toast({
          title: 'Heat recorded',
          description: `Breed at ${format(scheduledBreedAt, 'h:mm a')}. Alert set for ${format(addHours(scheduledBreedAt, -1), 'h:mm a')}.`,
        });

      } else if (heatAction === 'et-recipient') {
        const etISO   = etScheduledAt.toISOString();
        const alertISO = etAlertAt.toISOString();
        await db.heats.add({
          id, animalId: selectedAnimalId, farmId,
          observedAt: observedDt.toISOString(),
          heatAction: 'et-recipient',
          breedingType: 'conventional',
          scheduledBreedAt: etISO,   // reuse field for the scheduled action
          alertAt: alertISO,
          etScheduledAt: etISO,
          nextHeatExpectedAt: nextHeatExpectedAt.toISOString(),
          status: 'pending',
          notes: notes.trim() || undefined,
          createdAt: now, updatedAt: now,
        });
        await requestNotificationPermission();
        scheduleHeatNotifications(id, etISO, alertISO,
          selectedAnimal ? (selectedAnimal.barnName || selectedAnimal.name) : 'Cow',
          'conventional');
        toast({
          title: 'ET recipient scheduled',
          description: `Embryo transfer: ${format(etScheduledAt, 'EEE, MMM d @ h:mm a')}. Next heat watch: ${format(nextHeatExpectedAt, 'MMM d')}.`,
        });

      } else {
        // pass
        await db.heats.add({
          id, animalId: selectedAnimalId, farmId,
          observedAt: observedDt.toISOString(),
          heatAction: 'pass',
          breedingType: 'conventional',
          scheduledBreedAt: observedDt.toISOString(),
          alertAt: observedDt.toISOString(),
          nextHeatExpectedAt: nextHeatExpectedAt.toISOString(),
          status: 'missed',
          notes: notes.trim() || undefined,
          createdAt: now, updatedAt: now,
        });
        toast({
          title: 'Heat passed — watching for next cycle',
          description: `Next heat expected ${format(nextHeatExpectedAt, 'EEE, MMM d @ h:mm a')}.`,
        });
      }

      setLocation('/');
    } finally {
      setSaving(false);
    }
  }

  const submitLabel =
    heatAction === 'breed'        ? 'Set Heat Alarm' :
    heatAction === 'et-recipient' ? 'Schedule ET Transfer' :
                                    'Pass & Watch Next Cycle';

  return (
    <div className="space-y-5 max-w-xl mx-auto pb-20">
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-rose-500" /> Record Heat
        </h2>
      </div>

      {/* ── Animal picker ── */}
      {!selectedAnimalId ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Select Animal</p>
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
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredAnimals.map(a => (
                <button
                  key={a.id}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent/50 active:bg-accent transition-colors"
                  onClick={() => setSelectedAnimalId(a.id)}
                >
                  <span className="font-bold">{a.number}</span>
                  <span className="text-muted-foreground ml-2 text-sm">
                    {a.barnName || a.name}
                    {a.barnName && a.barnName !== a.name && (
                      <span className="ml-1 text-xs opacity-60">({a.name})</span>
                    )}
                  </span>
                </button>
              ))}
              {filteredAnimals.length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-4 text-center">No animals found</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Animal</p>
              <p className="font-bold text-lg">{selectedAnimal ? displayAnimal(selectedAnimal) : selectedAnimalId}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedAnimalId('')}>Change</Button>
          </CardContent>
        </Card>
      )}

      {/* ── Heat form ── */}
      {selectedAnimalId && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Time observed */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Heat Observed At</p>
              <p className="text-xs text-muted-foreground">All subsequent times are calculated from this moment.</p>
              <Input
                type="datetime-local"
                className="h-12 text-base"
                value={observedAt}
                onChange={e => setObservedAt(e.target.value)}
                required
              />
            </CardContent>
          </Card>

          {/* ── Action selector ── */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Action</p>
              <div className="grid grid-cols-3 gap-2">
                {/* Breed */}
                <button
                  type="button"
                  onClick={() => setHeatAction('breed')}
                  className={`rounded-xl border-2 p-3 text-center transition-all ${
                    heatAction === 'breed'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <HeartPulse className={`h-5 w-5 mx-auto mb-1 ${heatAction === 'breed' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className="font-bold text-sm">Breed</p>
                </button>
                {/* ET Recipient */}
                <button
                  type="button"
                  onClick={() => setHeatAction('et-recipient')}
                  className={`rounded-xl border-2 p-3 text-center transition-all ${
                    heatAction === 'et-recipient'
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                      : 'border-border hover:border-violet-300'
                  }`}
                >
                  <Pipette className={`h-5 w-5 mx-auto mb-1 ${heatAction === 'et-recipient' ? 'text-violet-600' : 'text-muted-foreground'}`} />
                  <p className="font-bold text-sm">ET Recipient</p>
                </button>
                {/* Pass */}
                <button
                  type="button"
                  onClick={() => setHeatAction('pass')}
                  className={`rounded-xl border-2 p-3 text-center transition-all ${
                    heatAction === 'pass'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                      : 'border-border hover:border-amber-300'
                  }`}
                >
                  <Eye className={`h-5 w-5 mx-auto mb-1 ${heatAction === 'pass' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <p className="font-bold text-sm">Pass / Watch</p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* ── Breed sub-options ── */}
          {heatAction === 'breed' && (
            <>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Semen Type</p>
                    {serviceNumber != null && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        serviceNumber <= sexedMaxService
                          ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400'
                          : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                      }`}>
                        Service #{serviceNumber}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setBreedingType('conventional')}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        breedingType === 'conventional'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <p className="font-bold text-base">Conventional</p>
                      <p className="text-sm text-muted-foreground mt-0.5">Breed in {conventionalHours}h</p>
                      {serviceNumber != null && serviceNumber > sexedMaxService && (
                        <p className="text-xs text-primary font-semibold mt-1">← Recommended</p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBreedingType('sexed')}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        breedingType === 'sexed'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <p className="font-bold text-base">Sexed</p>
                      <p className="text-sm text-muted-foreground mt-0.5">Breed in {sexedHours}h</p>
                      {serviceNumber != null && serviceNumber <= sexedMaxService && (
                        <p className="text-xs text-primary font-semibold mt-1">← Recommended</p>
                      )}
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Alarm Schedule</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Bell className="h-4 w-4 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">1-Hour Warning</p>
                        <p className="font-bold">{format(addHours(scheduledBreedAt, -1), 'EEE, MMM d @ h:mm a')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">
                          Breed Time (+{hoursToBreed}h from heat)
                        </p>
                        <p className="font-bold text-primary">{format(scheduledBreedAt, 'EEE, MMM d @ h:mm a')}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ── ET Recipient schedule ── */}
          {heatAction === 'et-recipient' && (
            <Card className="border-violet-300 bg-violet-50 dark:bg-violet-950/20">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                  ET Transfer Schedule
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Bell className="h-4 w-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">1-Hour Warning</p>
                      <p className="font-bold">{format(etAlertAt, 'EEE, MMM d @ h:mm a')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Pipette className="h-4 w-4 text-violet-600 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">
                        ET Transfer (+{etHours}h from heat)
                      </p>
                      <p className="font-bold text-violet-700 dark:text-violet-300">
                        {format(etScheduledAt, 'EEE, MMM d @ h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Eye className="h-4 w-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">
                        Next heat watch (+504h from heat)
                      </p>
                      <p className="font-bold text-amber-700 dark:text-amber-300">
                        {format(nextHeatExpectedAt, 'EEE, MMM d @ h:mm a')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Pass / Watch Next Cycle ── */}
          {heatAction === 'pass' && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Next Heat Watch
                </p>
                <p className="text-sm text-muted-foreground">
                  This heat will be passed. The animal will appear on the Watch for Heat checklist when her next cycle is due.
                </p>
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">
                      Next heat expected (+504h / 21 days from heat)
                    </p>
                    <p className="font-bold text-amber-700 dark:text-amber-300 text-lg">
                      {format(nextHeatExpectedAt, 'EEE, MMM d @ h:mm a')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Textarea
            placeholder="Notes (optional)…"
            className="resize-none"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />

          <Button type="submit" className="w-full h-12 text-base font-bold" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </form>
      )}
    </div>
  );
}
