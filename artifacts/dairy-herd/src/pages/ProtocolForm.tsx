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
import { ArrowLeft, Plus, Trash2, GripVertical, Pill, PenLine } from 'lucide-react';
import { Link } from 'wouter';

const TRIGGER_OPTIONS: { value: ProtocolTrigger; label: string }[] = [
  { value: 'calving',      label: 'After Calving' },
  { value: 'dry-off',     label: 'Dry Off' },
  { value: 'vaccination',  label: 'Vaccination' },
  { value: 'treatment',   label: 'Treatment' },
  { value: 'manual',      label: 'Manual / On-Demand' },
];

type AddMode = 'pharmacy' | 'custom';

export function ProtocolForm() {
  const [, navigate] = useLocation();
  const { farmId } = useAuth();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;

  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<ProtocolTrigger>('calving');
  const [items, setItems] = useState<ProtocolItem[]>([]);
  const [addMode, setAddMode] = useState<AddMode>('pharmacy');
  const [selectedDrugId, setSelectedDrugId] = useState('');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  // Pharmacy drugs for the picker
  const drugs = useLiveQuery(
    () => farmId ? db.drugProducts.toArray().then(d => d.sort((a, b) => a.name.localeCompare(b.name))) : [],
    [farmId],
  ) ?? [];

  // Load existing protocol when editing
  useEffect(() => {
    if (!isEdit || !params.id) return;
    db.protocols.get(params.id).then(p => {
      if (!p) { navigate('/protocols'); return; }
      setName(p.name);
      setTriggerType(p.triggerType);
      setItems(p.items);
      setLoaded(true);
    });
  }, [params.id, isEdit]);

  function addFromPharmacy() {
    if (!selectedDrugId) return;
    const drug = drugs.find(d => d.id === selectedDrugId);
    if (!drug) return;
    // Prevent duplicate
    if (items.some(i => i.label === drug.name)) return;
    setItems(prev => [...prev, { id: crypto.randomUUID(), label: drug.name }]);
    setSelectedDrugId('');
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
    if (isEdit && params.id) {
      await db.protocols.update(params.id, {
        name: name.trim(),
        triggerType,
        items,
        updatedAt: now,
      });
    } else {
      await db.protocols.add({
        id: crypto.randomUUID(),
        farmId,
        name: name.trim(),
        triggerType,
        items,
        createdAt: now,
        updatedAt: now,
      });
    }
    setSaving(false);
    navigate('/protocols');
  }

  if (!loaded) return null;

  // Drugs not already in the list
  const availableDrugs = drugs.filter(d => !items.some(i => i.label === d.name));

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/protocols">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-xl font-bold">{isEdit ? 'Edit Protocol' : 'New Protocol'}</h2>
      </div>

      {/* Name + trigger */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proto-name">Protocol Name</Label>
            <Input
              id="proto-name"
              className="h-12 text-base"
              placeholder="e.g. Newborn Calf Protocol"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>When does this run?</Label>
            <Select value={triggerType} onValueChange={v => setTriggerType(v as ProtocolTrigger)}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
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

      {/* Checklist items */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Checklist Items</p>

          {/* Current items */}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No items yet — add steps below.</p>
          )}
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2.5">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium flex-1">{idx + 1}. {item.label}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add mode toggle */}
          <div className="flex rounded-lg border overflow-hidden text-sm font-semibold mt-2">
            <button
              type="button"
              onClick={() => setAddMode('pharmacy')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors ${
                addMode === 'pharmacy'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-secondary'
              }`}
            >
              <Pill className="h-3.5 w-3.5" />
              From Pharmacy
            </button>
            <button
              type="button"
              onClick={() => setAddMode('custom')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors border-l ${
                addMode === 'custom'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-secondary'
              }`}
            >
              <PenLine className="h-3.5 w-3.5" />
              Custom
            </button>
          </div>

          {/* From Pharmacy */}
          {addMode === 'pharmacy' && (
            <div className="flex gap-2">
              {drugs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-1">
                  No drugs in your pharmacy yet.{' '}
                  <Link href="/pharmacy/new" className="text-primary underline">Add one</Link>
                  {' '}first.
                </p>
              ) : (
                <>
                  <select
                    value={selectedDrugId}
                    onChange={e => setSelectedDrugId(e.target.value)}
                    className="h-11 flex-1 rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select a drug…</option>
                    {availableDrugs.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-3 shrink-0"
                    disabled={!selectedDrugId}
                    onClick={addFromPharmacy}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Custom text */}
          {addMode === 'custom' && (
            <div className="flex gap-2">
              <Input
                className="h-11 text-base"
                placeholder="e.g. Iodine dip of navel"
                value={newItemLabel}
                onChange={e => setNewItemLabel(e.target.value)}
                onKeyDown={handleCustomKeyDown}
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 px-3 shrink-0"
                onClick={addCustom}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        className="w-full h-14 text-lg font-bold"
        disabled={!name.trim() || saving}
        onClick={handleSave}
      >
        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Protocol'}
      </Button>
    </div>
  );
}
