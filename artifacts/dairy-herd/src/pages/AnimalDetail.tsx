import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useRef } from 'react';
import { db } from '@/db';
import { getDIM } from '@/db/computed';
import { Link, useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Edit, Activity, Heart, Droplet, Baby, StickyNote, Trash2, Award, Pill, CheckCircle2, AlertTriangle, Thermometer, Camera, X, Syringe, Scissors, BarChart3, Milk, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

/** Compress an image file to a JPEG data URL, max 900px on longest side. */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 900;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = reject;
    img.src = url;
  });
}

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
  const { toast } = useToast();
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline quick-log panel state
  const [activePanel, setActivePanel] = useState<'wean' | 'hoof-trim' | 'bcs' | 'dehorn' | null>(null);
  const [panelDate, setPanelDate]     = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [panelValue, setPanelValue]   = useState('');
  const [panelNotes, setPanelNotes]   = useState('');
  const [panelSaving, setPanelSaving] = useState(false);

  const data = useLiveQuery(async () => {
    if (!id) return null;
    const animal = await db.animals.get(id);
    if (!animal) return null;

    const [breedings, calvings, treatments, pregChecks, notes, classifications, heats, vaccinations, healthEvents] =
      await Promise.all([
        db.breedings.where('animalId').equals(id).reverse().sortBy('date'),
        db.calvings.where('animalId').equals(id).reverse().sortBy('calvingDate'),
        db.treatments.where('animalId').equals(id).reverse().sortBy('date'),
        db.pregnancyChecks.where('animalId').equals(id).reverse().sortBy('checkDate'),
        db.animalNotes.where('animalId').equals(id).reverse().sortBy('createdAt'),
        db.classifications.where('animalId').equals(id).reverse().sortBy('date'),
        db.heats.where('animalId').equals(id).reverse().sortBy('observedAt'),
        db.vaccinations.where('animalId').equals(id).reverse().sortBy('vaccinationDate'),
        db.healthEvents.where('animalId').equals(id).reverse().sortBy('date'),
      ]);

    return { animal, breedings, calvings, treatments, pregChecks, notes, classifications, heats, vaccinations, healthEvents };
  }, [id]);

  if (data === undefined) return <div className="p-4">Loading...</div>;
  if (data === null) return <div className="p-4">Animal not found.</div>;

  const { animal, breedings, calvings, treatments, pregChecks, notes, classifications, heats, vaccinations, healthEvents } = data;
  const dim = getDIM(animal);

  function openPanel(panel: typeof activePanel) {
    setActivePanel(panel);
    setPanelDate(format(new Date(), 'yyyy-MM-dd'));
    setPanelValue('');
    setPanelNotes('');
  }

  async function submitHealthEvent() {
    if (!id || !activePanel) return;
    setPanelSaving(true);
    try {
      const now = new Date().toISOString();
      await db.healthEvents.add({
        id: crypto.randomUUID(),
        animalId: id,
        farmId: animal.farmId ?? '',
        type: activePanel,
        date: new Date(panelDate + 'T12:00:00').toISOString(),
        value: panelValue.trim() || undefined,
        notes: panelNotes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
      const labels: Record<string, string> = {
        'wean': 'Weaning recorded',
        'hoof-trim': 'Hoof trim recorded',
        'bcs': 'BCS recorded',
        'dehorn': 'Dehorn recorded',
      };
      toast({ title: labels[activePanel] ?? 'Event recorded' });
      setActivePanel(null);
    } catch {
      toast({ title: 'Error saving', variant: 'destructive' });
    } finally {
      setPanelSaving(false);
    }
  }

  async function deleteVaccination(vacId: string) {
    if (!confirm('Remove this vaccination record? This cannot be undone.')) return;
    await db.vaccinations.delete(vacId);
    toast({ title: 'Vaccination removed' });
  }

  async function deleteHealthEvent(evId: string) {
    if (!confirm('Remove this record? This cannot be undone.')) return;
    await db.healthEvents.delete(evId);
    toast({ title: 'Record removed' });
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setPhotoUploading(true);
    try {
      const photoUrl = await compressImage(file);
      await db.animals.update(id, { photoUrl, updatedAt: new Date().toISOString() });
    } catch {
      toast({ title: 'Could not save photo', variant: 'destructive' });
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removePhoto() {
    if (!id || !confirm('Remove this photo?')) return;
    await db.animals.update(id, { photoUrl: undefined, updatedAt: new Date().toISOString() });
  }

  async function deleteEvent(type: 'breeding' | 'calving' | 'heat', eventId: string) {
    if (!confirm(`Remove this ${type} record? This cannot be undone.`)) return;
    if (type === 'breeding') await db.breedings.delete(eventId);
    else if (type === 'calving') await db.calvings.delete(eventId);
    else await db.heats.delete(eventId);
    toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} record removed` });
  }

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

      {/* Photo */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelect}
      />
      {animal.photoUrl ? (
        <div className="relative w-full rounded-xl overflow-hidden bg-muted" style={{ aspectRatio: '16/9' }}>
          <img
            src={animal.photoUrl}
            alt={animal.barnName || animal.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
              title="Replace photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              onClick={removePhoto}
              className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
              title="Remove photo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={photoUploading}
          className="w-full rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/40 transition-colors flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground"
        >
          <Camera className="h-8 w-8" />
          <span className="text-sm font-medium">{photoUploading ? 'Saving…' : 'Add photo'}</span>
        </button>
      )}

      {/* Quick Actions */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-0.5">Actions</p>
        <div className="grid grid-cols-3 gap-2">
          <Link href={`/heat?animalId=${animal.id}`} className="block">
            <Button variant="outline" className="w-full h-14 flex-col gap-1 bg-card hover:bg-accent/10 border-border text-xs">
              <Thermometer className="h-4 w-4 text-rose-500" />
              <span>Heat</span>
            </Button>
          </Link>
          <Link href={`/breeding?animalId=${animal.id}`} className="block">
            <Button variant="outline" className="w-full h-14 flex-col gap-1 bg-card hover:bg-accent/10 border-border text-xs">
              <Heart className="h-4 w-4 text-destructive" />
              <span>Breed</span>
            </Button>
          </Link>
          <Link href={`/calving?animalId=${animal.id}`} className="block">
            <Button variant="outline" className="w-full h-14 flex-col gap-1 bg-card hover:bg-accent/10 border-border text-xs">
              <Baby className="h-4 w-4 text-primary" />
              <span>Calve</span>
            </Button>
          </Link>
          <Link href={`/preg-check?animalId=${animal.id}`} className="block">
            <Button variant="outline" className="w-full h-14 flex-col gap-1 bg-card hover:bg-accent/10 border-border text-xs">
              <Activity className="h-4 w-4 text-blue-600" />
              <span>Preg Check</span>
            </Button>
          </Link>
          <Link href={`/treatment?animalId=${animal.id}`} className="block">
            <Button variant="outline" className="w-full h-14 flex-col gap-1 bg-card hover:bg-accent/10 border-border text-xs">
              <Droplet className="h-4 w-4 text-purple-600" />
              <span>Treat</span>
            </Button>
          </Link>
          <Link href={`/vaccination?animalId=${animal.id}`} className="block">
            <Button variant="outline" className="w-full h-14 flex-col gap-1 bg-card hover:bg-accent/10 border-border text-xs">
              <Syringe className="h-4 w-4 text-green-600" />
              <span>Vaccinate</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            className={`w-full h-14 flex-col gap-1 border-border text-xs ${activePanel === 'hoof-trim' ? 'bg-accent/20 border-accent' : 'bg-card hover:bg-accent/10'}`}
            onClick={() => activePanel === 'hoof-trim' ? setActivePanel(null) : openPanel('hoof-trim')}
          >
            <Scissors className="h-4 w-4 text-amber-600" />
            <span>Hoof Trim</span>
          </Button>
          <Button
            variant="outline"
            className={`w-full h-14 flex-col gap-1 border-border text-xs ${activePanel === 'bcs' ? 'bg-accent/20 border-accent' : 'bg-card hover:bg-accent/10'}`}
            onClick={() => activePanel === 'bcs' ? setActivePanel(null) : openPanel('bcs')}
          >
            <BarChart3 className="h-4 w-4 text-sky-600" />
            <span>BCS</span>
          </Button>
          <Button
            variant="outline"
            className={`w-full h-14 flex-col gap-1 border-border text-xs ${activePanel === 'wean' ? 'bg-accent/20 border-accent' : 'bg-card hover:bg-accent/10'}`}
            onClick={() => activePanel === 'wean' ? setActivePanel(null) : openPanel('wean')}
          >
            <Milk className="h-4 w-4 text-orange-500" />
            <span>Wean</span>
          </Button>
        </div>

        {/* Inline quick-log panel */}
        {activePanel && (
          <Card className="border-accent/50">
            <CardContent className="p-4 space-y-3">
              <p className="font-bold text-sm capitalize">
                {activePanel === 'hoof-trim' ? 'Hoof Trim' : activePanel === 'bcs' ? 'Body Condition Score' : activePanel === 'wean' ? 'Record Weaning' : 'Dehorn'}
              </p>

              {activePanel === 'bcs' && (
                <div className="space-y-1.5">
                  <Label className="text-sm">BCS Score (1–9)</Label>
                  <select
                    value={panelValue}
                    onChange={e => setPanelValue(e.target.value)}
                    required
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select score…</option>
                    {['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9'].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm">Date</Label>
                <Input
                  type="date"
                  className="h-11 text-base"
                  value={panelDate}
                  onChange={e => setPanelDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  className="text-base min-h-[60px] resize-none"
                  placeholder={
                    activePanel === 'hoof-trim' ? 'Trimmer, condition, issues found…'
                    : activePanel === 'bcs' ? 'Observer, body area notes…'
                    : activePanel === 'wean' ? 'Weaning weight, method…'
                    : 'Method, notes…'
                  }
                  value={panelNotes}
                  onChange={e => setPanelNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 h-11"
                  onClick={submitHealthEvent}
                  disabled={panelSaving || (activePanel === 'bcs' && !panelValue)}
                >
                  {panelSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="outline" className="h-11 px-4" onClick={() => setActivePanel(null)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
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
            {animal.earTattooLeft && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Left Ear</p>
                <p className="font-bold font-mono text-sm">{animal.earTattooLeft}</p>
              </div>
            )}
            {animal.earTattooRight && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Right Ear</p>
                <p className="font-bold font-mono text-sm">{animal.earTattooRight}</p>
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
                      <div className="flex-1 min-w-0">
                        <p className="font-bold">{b.breedingType} Breeding</p>
                        <p className="text-sm text-muted-foreground">{fmt(b.date, 'MMM d, yyyy')} · Bull: {b.bullId || 'Unknown'}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 -mr-1"
                        onClick={() => deleteEvent('breeding', b.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
                      <div className="flex-1 min-w-0">
                        <p className="font-bold">Calved ({c.calfSex})</p>
                        <p className="text-sm text-muted-foreground">{fmt(c.calvingDate, 'MMM d, yyyy')}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 -mr-1"
                        onClick={() => deleteEvent('calving', c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
                    <div className="flex-1 min-w-0">
                      <p className="font-bold">Heat Observed — {h.breedingType === 'sexed' ? 'Sexed' : 'Conventional'}</p>
                      <p className="text-sm text-muted-foreground">
                        {fmt(h.observedAt, 'MMM d, yyyy h:mm a')}
                        {h.scheduledBreedAt ? <>{' · '}Breed by {fmt(h.scheduledBreedAt, 'h:mm a')}</> : null}
                      </p>
                      <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 -mr-1"
                      onClick={() => deleteEvent('heat', h.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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

      {/* Vaccinations */}
      {vaccinations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Syringe className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-bold">Vaccinations</h3>
            </div>
            <Link href={`/vaccination?animalId=${animal.id}`}>
              <Button size="sm" variant="outline">+ Add</Button>
            </Link>
          </div>
          <div className="space-y-2">
            {vaccinations.map(v => (
              <Card key={v.id}>
                <CardContent className="p-3 flex items-start gap-3">
                  <Syringe className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold leading-tight">{v.vaccineName}</p>
                    <p className="text-sm text-muted-foreground">
                      {fmt(v.vaccinationDate, 'MMM d, yyyy')}
                      {v.manufacturer ? ` · ${v.manufacturer}` : ''}
                      {v.lotNumber ? ` · Lot ${v.lotNumber}` : ''}
                    </p>
                    {v.followUpRequired && v.followUpDate && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mt-0.5 flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Booster due {fmt(v.followUpDate, 'MMM d, yyyy')}
                      </p>
                    )}
                    {v.notes && <p className="text-xs text-muted-foreground mt-0.5">{v.notes}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 -mr-1"
                    onClick={() => deleteVaccination(v.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Health Events (wean, hoof trim, BCS, dehorn) */}
      {healthEvents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-bold">Health Events</h3>
          </div>
          <div className="space-y-2">
            {healthEvents.map(ev => {
              const meta: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
                'wean':      { label: 'Weaned',    icon: <Milk className="h-4 w-4 text-orange-500" />,   color: 'text-orange-700' },
                'hoof-trim': { label: 'Hoof Trim', icon: <Scissors className="h-4 w-4 text-amber-600" />, color: 'text-amber-700' },
                'bcs':       { label: 'BCS',       icon: <BarChart3 className="h-4 w-4 text-sky-600" />,  color: 'text-sky-700' },
                'dehorn':    { label: 'Dehorned',  icon: <AlertTriangle className="h-4 w-4 text-red-500" />, color: 'text-red-700' },
              };
              const m = meta[ev.type] ?? { label: ev.type, icon: <Activity className="h-4 w-4" />, color: '' };
              return (
                <Card key={ev.id}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold leading-tight">
                        {m.label}
                        {ev.type === 'bcs' && ev.value ? ` — ${ev.value}` : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">{fmt(ev.date, 'MMM d, yyyy')}</p>
                      {ev.notes && <p className="text-xs text-muted-foreground mt-0.5">{ev.notes}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 -mr-1"
                      onClick={() => deleteHealthEvent(ev.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

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
