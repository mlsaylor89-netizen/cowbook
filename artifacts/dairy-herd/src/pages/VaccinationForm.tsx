/**
 * VaccinationForm — record a vaccination event for a single animal.
 * Accessible at /vaccination?animalId=<id>
 */

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Syringe } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const COMMON_VACCINES = [
  { group: 'Respiratory / Reproductive', items: [
    'Bovishield GOLD FP 5 VL5',
    'Cattlemaster GOLD FP 5',
    'Triangle 9',
    'Express FP 5',
    'Vista Once SQ',
  ]},
  { group: 'Clostridial', items: [
    'Vision 7 with SPUR',
    'Bar-Vac CD/T',
    'Ultrabac 7',
  ]},
  { group: 'Scours / Neonatal', items: [
    'Scour Bos 9',
    'Bovilis ScourGuard 4KC',
    'Inforce 3',
  ]},
  { group: 'Trace Minerals / Other', items: [
    'Multimin 90',
    'Pinkeye vaccine',
    'Lepto 5-way',
  ]},
  { group: 'Custom', items: ['Other (enter name below)'] },
];

const ALL_PRESETS = COMMON_VACCINES.flatMap(g => g.items);

export function VaccinationForm() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Parse animalId from query string
  const initialAnimalId = new URLSearchParams(window.location.search).get('animalId') ?? '';

  const [animalId, setAnimalId]             = useState(initialAnimalId);
  const [vaccinePreset, setVaccinePreset]   = useState('');
  const [customName, setCustomName]         = useState('');
  const [date, setDate]                     = useState(format(new Date(), 'yyyy-MM-dd'));
  const [manufacturer, setManufacturer]     = useState('');
  const [lotNumber, setLotNumber]           = useState('');
  const [followUp, setFollowUp]             = useState(false);
  const [followUpDate, setFollowUpDate]     = useState('');
  const [notes, setNotes]                   = useState('');
  const [saving, setSaving]                 = useState(false);

  const animals = useLiveQuery(() =>
    db.animals.toArray().then(a =>
      [...a].sort((x, y) => {
        const lx = x.barnName || x.name;
        const ly = y.barnName || y.name;
        return lx.localeCompare(ly);
      })
    )
  ) ?? [];

  // Which animal label to show when pre-selected
  const preSelectedAnimal = animals.find(a => a.id === initialAnimalId);

  const vaccineName = vaccinePreset === 'Other (enter name below)' ? customName.trim() : vaccinePreset;
  const backHref = initialAnimalId ? `/herd/${initialAnimalId}` : '/herd';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!animalId || !vaccineName) return;

    const animal = animals.find(a => a.id === animalId);
    if (!animal) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      await db.vaccinations.add({
        id: crypto.randomUUID(),
        animalId,
        farmId: animal.farmId ?? '',
        vaccineName,
        vaccinationDate: new Date(date + 'T12:00:00').toISOString(),
        manufacturer: manufacturer.trim() || undefined,
        lotNumber: lotNumber.trim() || undefined,
        followUpRequired: followUp,
        followUpDate: followUp && followUpDate ? new Date(followUpDate + 'T12:00:00').toISOString() : undefined,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
      toast({ title: 'Vaccination recorded', description: `${vaccineName} logged successfully.` });
      navigate(backHref);
    } catch {
      toast({ title: 'Error saving vaccination', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Syringe className="h-5 w-5 text-green-600" /> Record Vaccination
          </h2>
          {preSelectedAnimal && (
            <p className="text-sm text-muted-foreground">
              {preSelectedAnimal.number} — {preSelectedAnimal.barnName || preSelectedAnimal.name}
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Animal selector (only when not pre-selected) */}
            {!initialAnimalId && (
              <div className="space-y-1.5">
                <Label>Animal <span className="text-destructive">*</span></Label>
                <select
                  value={animalId}
                  onChange={e => setAnimalId(e.target.value)}
                  required
                  className="h-12 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select animal…</option>
                  {animals.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.number} — {a.barnName || a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Vaccine selection */}
            <div className="space-y-1.5">
              <Label>Vaccine <span className="text-destructive">*</span></Label>
              <select
                value={vaccinePreset}
                onChange={e => setVaccinePreset(e.target.value)}
                required
                className="h-12 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select vaccine…</option>
                {COMMON_VACCINES.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map(v => <option key={v} value={v}>{v}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            {vaccinePreset === 'Other (enter name below)' && (
              <div className="space-y-1.5">
                <Label>Vaccine Name <span className="text-destructive">*</span></Label>
                <Input
                  className="h-12 text-base"
                  placeholder="e.g. IBR-BVD-PI3 Modified Live"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Date */}
            <div className="space-y-1.5">
              <Label>Date Given <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                className="h-12 text-base"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>

            {/* Manufacturer + Lot (side by side) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Manufacturer <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  className="h-11 text-base"
                  placeholder="e.g. Zoetis"
                  value={manufacturer}
                  onChange={e => setManufacturer(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Lot # <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  className="h-11 text-base"
                  placeholder="Lot number"
                  value={lotNumber}
                  onChange={e => setLotNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Follow-up / booster */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">Booster / Follow-Up Required?</p>
                  <p className="text-xs text-muted-foreground">Schedule a reminder for a second dose</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFollowUp(v => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    followUp ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      followUp ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {followUp && (
                <div className="space-y-1.5 pt-1">
                  <Label>Follow-Up Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    className="h-12 text-base"
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                    required={followUp}
                    min={date}
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>
                Notes <span className="text-muted-foreground font-normal text-sm">(optional)</span>
              </Label>
              <Textarea
                className="text-base min-h-[80px] resize-none"
                placeholder="Dose, route (IM/SQ), any reactions, etc."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-14 text-base font-bold"
              disabled={saving || !animalId || !vaccineName}
            >
              {saving ? 'Saving…' : 'Record Vaccination'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
