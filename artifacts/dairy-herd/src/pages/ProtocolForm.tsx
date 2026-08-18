import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ProtocolTrigger, type ProtocolItem } from '@/db';
import { useAuth } from '@/contexts/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, GripVertical, Pill, PenLine, Clock } from 'lucide-react';
import { Link } from 'wouter';

const TRIGGER_OPTIONS: { value: ProtocolTrigger; label: string }[] = [
  { value: 'calving',      label: 'After Calving' },
  { value: 'dry-off',     label: 'Dry Off' },
  { value: 'vaccination',  label: 'Vaccination' },
  { value: 'treatment',   label: 'Treatment' },
  { value: 'manual',      label: 'Manual / On-Demand' },
];

type AddMode = 'pharmacy' | 'custom';

function timingPreview(anchor: 'calving' | 'birth', days: number | undefined): string {
  if (days === undefined || days === null || isNaN(days as number)) {
    return 'Enter a number — negative for before, positive for after';
  }
  const anchorLabel = anchor === 'calving' ? 'calving' : 'birth';
  if (days === 0) return `On the day of ${anchorLabel}`;
  if (days < 0)   return `${Math.abs(days)} days before ${anchor === 'calving' ? 'the expected calving date' : 'birth'}`;
  return `${days} days after ${anchorLabel}`;
}

export function ProtocolForm() {
  const [, navigate] = useLocation();
  const { farmId } = useAuth();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;

  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<ProtocolTrigger>('calving');
  const [items, setItems] = useState<ProtocolItem[]>([]);
  const [addMode, setAddMode] = useState<AddMode>('pharmacy');

  // Timing state
  const [timingEnabled, setTimingEnabled] = useState(false);
  const [timingAnchor, setTimingAnchor] = useState<'calving' | 'birth'>('calving');
  const [timingDays, setTimingDays] = useState<number | undefined>(undefined);

  // Pharmacy add state
  const [selectedDrugId, setSelectedDrugId] = useState('');
  const [pendingDose, setPendingDose] = useState('');

  // Custom add state
  const [newItemLabel, setNewItemLabel] = useState('');

  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  const drugs = useLiveQuery(
    () => farmId ? db.drugProducts.toArray().then(d => d.sort((a, b) => a.name.localeCompare(b.name))) : [],
    [farmId],
  ) ?? [];

  useEffect(() => {
    if (!isEdit || !params.id) return;
    db.protocols.get(params.id).then(p => {
      if (!p) { navigate('/protocols'); return; }
      setName(p.name);
      setTriggerType(p.triggerType);
      setItems(p.items);
      if (p.timingAnchor != null && p.timingDays != null) {
        setTimingEnabled(true);
        setTimingAnchor(p.timingAnchor);
        setTimingDays(p.timingDays);
      }
      setLoaded(true);
    });
  }, [params.id, isEdit]);

  // Reset dose when drug changes
  useEffect(() => { setPendingDose(''); }, [selectedDrugId]);

  function addFromPharmacy() {
    if (!selectedDrugId) return;
    const drug = drugs.find(d => d.id === selectedDrugId);
    if (!drug) return;
    if (items.some(i => i.drugProductId === drug.id)) return;
    const dose = parseFloat(pendingDose);
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      label: drug.name,
      drugProductId: drug.id,
      dosePerAnimal: isNaN(dose) || dose <= 0 ? undefined : dose,
    }]);
    setSelectedDrugId('');
    setPendingDose('');
  }

  function addCustom() {
    const label = newItemLabel.trim();
    if (!label) return;
    setItems(prev => [...prev, { id: crypto.randomUUID(), label }]);
    setNewItemLabel('');
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function handleCustomKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
  }

  async function handleSave() {
    if (!name.trim() || !farmId) return;
    setSaving(true);
    const now = new Date().toISOString();
    const timingData = timingEnabled && timingDays !== undefined
      ? { timingAnchor, timingDays }
      : { timingAnchor: undefined, timingDays: undefined };

    if (isEdit && params.id) {
      await db.protocols.update(params.id, { name: name.trim(), triggerType, items, ...timingData, updatedAt: now });
    } else {
      await db.protocols.add({
        id: crypto.randomUUID(), farmId, name: name.trim(), triggerType, items,
        ...timingData,
        createdAt: now, updatedAt: now,
      });
    }
    setSaving(false);
    navigate('/protocols');
  }

  if (!loaded) return null;

  const availableDrugs = drugs.filter(d => !items.some(i => i.drugProductId === d.id));
  const selectedDrug = drugs.find(d => d.id === selectedDrugId);

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/protocols">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h2 className="text-xl font-bold">{isEdit ? 'Edit Protocol' : 'New Protocol'}</h2>
      </div>

      {/* Name + trigger */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proto-name">Protocol Name</Label>
            <Input id="proto-name" className="h-12 text-base" placeholder="e.g. Newborn Calf Protocol"
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>When does this run?</Label>
            <Select value={triggerType} onValueChange={v => setTriggerType(v as ProtocolTrigger)}>
              <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {triggerType === 'calving'     && 'This checklist will appear automatically after recording a calving.'}
              {triggerType === 'dry-off'     && 'This checklist will appear after marking a cow as dry.'}
              {triggerType === 'vaccination' && 'This checklist will appear after recording a vaccination.'}
              {triggerType === 'treatment'   && 'This checklist will appear after recording a treatment.'}
              {triggerType === 'manual'      && "Run this checklist manually from an animal's profile at any time."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Timing */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Scheduled Timing</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setTimingEnabled(v => !v);
                if (timingEnabled) setTimingDays(undefined);
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${timingEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${timingEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {!timingEnabled && (
            <p className="text-xs text-muted-foreground">
              Turn on to schedule this protocol at a specific number of days before or after calving / birth.
              It will appear as an upcoming alert on the home page.
            </p>
          )}

          {timingEnabled && (
            <>
              {/* Anchor selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTimingAnchor('calving')}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${timingAnchor === 'calving' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                >
                  <p className="font-bold text-sm leading-tight">From Calving</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Cows & bred heifers</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTimingAnchor('birth')}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${timingAnchor === 'birth' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                >
                  <p className="font-bold text-sm leading-tight">From Birth</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Calves & young stock</p>
                </button>
              </div>

              {/* Days offset */}
              <div className="space-y-1.5">
                <Label htmlFor="timing-days">Days offset</Label>
                <Input
                  id="timing-days"
                  type="number"
                  className="h-12 text-base"
                  placeholder="e.g. −30 or +14"
                  value={timingDays ?? ''}
                  onChange={e => setTimingDays(e.target.value === '' ? undefined : Number(e.target.value))}
                />
                <p className={`text-xs font-medium ${timingDays !== undefined ? 'text-primary' : 'text-muted-foreground'}`}>
                  {timingPreview(timingAnchor, timingDays)}
                </p>
              </div>

              {/* Quick presets */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Quick presets</p>
                <div className="flex flex-wrap gap-2">
                  {(timingAnchor === 'calving'
                    ? [
                        { label: '−60 days', value: -60 },
                        { label: '−30 days', value: -30 },
                        { label: '−21 days', value: -21 },
                        { label: 'Day 0',    value: 0 },
                        { label: '+3 days',  value: 3 },
                        { label: '+14 days', value: 14 },
                        { label: '+30 days', value: 30 },
                      ]
                    : [
                        { label: 'Day 0',    value: 0 },
                        { label: '+7 days',  value: 7 },
                        { label: '+14 days', value: 14 },
                        { label: '+30 days', value: 30 },
                        { label: '+60 days', value: 60 },
                        { label: '+90 days', value: 90 },
                      ]
                  ).map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setTimingDays(p.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        timingDays === p.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:border-primary/50 text-muted-foreground'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Checklist items */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Checklist Items</p>

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No items yet — add steps below.</p>
          )}
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2.5">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{idx + 1}. {item.label}</p>
                  {item.drugProductId && (
                    <p className="text-xs text-muted-foreground">
                      {item.dosePerAnimal != null
                        ? `Dose: ${item.dosePerAnimal} ${drugs.find(d => d.id === item.drugProductId)?.unit ?? ''} per animal`
                        : "No dose recorded — inventory won't be deducted"}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={() => removeItem(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add mode toggle */}
          <div className="flex rounded-lg border overflow-hidden text-sm font-semibold mt-2">
            <button type="button" onClick={() => setAddMode('pharmacy')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors ${
                addMode === 'pharmacy' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-secondary'
              }`}>
              <Pill className="h-3.5 w-3.5" /> From Pharmacy
            </button>
            <button type="button" onClick={() => setAddMode('custom')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors border-l ${
                addMode === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-secondary'
              }`}>
              <PenLine className="h-3.5 w-3.5" /> Custom
            </button>
          </div>

          {/* From Pharmacy */}
          {addMode === 'pharmacy' && (
            <div className="space-y-2">
              {drugs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-1">
                  No drugs in your pharmacy yet.{' '}
                  <Link href="/pharmacy/new" className="text-primary underline">Add one</Link> first.
                </p>
              ) : (
                <>
                  <select
                    value={selectedDrugId}
                    onChange={e => setSelectedDrugId(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select a drug…</option>
                    {availableDrugs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>

                  {selectedDrugId && (
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 relative">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          className="h-11 text-base pr-16"
                          placeholder="Dose per animal"
                          value={pendingDose}
                          onChange={e => setPendingDose(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFromPharmacy(); } }}
                          autoFocus
                        />
                        {selectedDrug && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                            {selectedDrug.unit}
                          </span>
                        )}
                      </div>
                      <Button type="button" variant="outline" className="h-11 px-3 shrink-0" onClick={addFromPharmacy}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {selectedDrugId && (
                    <p className="text-xs text-muted-foreground">
                      Enter a dose so inventory is automatically deducted each time this item is completed.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Custom */}
          {addMode === 'custom' && (
            <div className="flex gap-2">
              <Input className="h-11 text-base" placeholder="e.g. Iodine dip of navel"
                value={newItemLabel} onChange={e => setNewItemLabel(e.target.value)}
                onKeyDown={handleCustomKeyDown} autoFocus />
              <Button type="button" variant="outline" className="h-11 px-3 shrink-0" onClick={addCustom}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Button className="w-full h-14 text-lg font-bold" disabled={!name.trim() || saving} onClick={handleSave}>
        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Protocol'}
      </Button>
    </div>
  );
}
