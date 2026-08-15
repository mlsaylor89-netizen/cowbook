import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearch, Link } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, addHours, parseISO } from 'date-fns';
import { db } from '@/db';
import { useAuth } from '@/contexts/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Search, Thermometer, Clock, Bell } from 'lucide-react';
import {
  requestNotificationPermission,
  scheduleHeatNotifications,
} from '@/lib/heatNotifications';
import { useToast } from '@/hooks/use-toast';

function toLocalDatetimeValue(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function displayAnimal(a: { name: string; barnName?: string; number: string }) {
  return `${a.number} — ${a.barnName || a.name}`;
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
  const [breedingType, setBreedingType] = useState<'conventional' | 'sexed'>('conventional');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Load all active animals for picker
  const animals = useLiveQuery(() =>
    db.animals
      .where('status')
      .noneOf(['Sold', 'Dead'])
      .toArray()
      .then(a => a.sort((x, y) => x.number.localeCompare(y.number, undefined, { numeric: true }))),
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

  // Computed times
  const hoursToBreed = breedingType === 'sexed' ? 30 : 12;
  const scheduledBreedAt = useMemo(() => {
    try { return addHours(parseISO(observedAt), hoursToBreed); }
    catch { return addHours(new Date(), hoursToBreed); }
  }, [observedAt, hoursToBreed]);
  const alertAt = addHours(scheduledBreedAt, -1);

  // Request notification permission on mount
  useEffect(() => { requestNotificationPermission(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAnimalId || !farmId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const breedISO = scheduledBreedAt.toISOString();
      const alertISO = alertAt.toISOString();

      await db.heats.add({
        id,
        animalId: selectedAnimalId,
        farmId,
        observedAt: new Date(observedAt).toISOString(),
        breedingType,
        scheduledBreedAt: breedISO,
        alertAt: alertISO,
        status: 'pending',
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });

      const animalDisplay = selectedAnimal
        ? (selectedAnimal.barnName || selectedAnimal.name)
        : 'Cow';

      await requestNotificationPermission();
      scheduleHeatNotifications(id, breedISO, alertISO, animalDisplay, breedingType);

      toast({
        title: 'Heat recorded',
        description: `${animalDisplay} — breed at ${format(scheduledBreedAt, 'h:mm a')}. Alert set for ${format(alertAt, 'h:mm a')}.`,
      });
      setLocation('/');
    } finally {
      setSaving(false);
    }
  }

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
              <Input
                type="datetime-local"
                className="h-12 text-base"
                value={observedAt}
                onChange={e => setObservedAt(e.target.value)}
                required
              />
            </CardContent>
          </Card>

          {/* Breeding type */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Breeding Type</p>
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
                  <p className="text-sm text-muted-foreground mt-0.5">Breed in 12 hours</p>
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
                  <p className="text-sm text-muted-foreground mt-0.5">Breed in 30 hours</p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Calculated times */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Alarm Schedule</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">1-Hour Warning</p>
                    <p className="font-bold">{format(alertAt, 'EEE, MMM d @ h:mm a')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Breed Time ({hoursToBreed}h)</p>
                    <p className="font-bold text-primary">{format(scheduledBreedAt, 'EEE, MMM d @ h:mm a')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Textarea
            placeholder="Notes (optional)…"
            className="resize-none"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />

          <Button type="submit" className="w-full h-12 text-base font-bold" disabled={saving}>
            {saving ? 'Saving…' : 'Set Heat Alarm'}
          </Button>
        </form>
      )}
    </div>
  );
}
