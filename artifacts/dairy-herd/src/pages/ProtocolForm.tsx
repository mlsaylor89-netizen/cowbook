import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
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
import { ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react';
import { Link } from 'wouter';

const TRIGGER_OPTIONS: { value: ProtocolTrigger; label: string }[] = [
  { value: 'calving',     label: 'After Calving' },
  { value: 'dry-off',    label: 'Dry Off' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'treatment',  label: 'Treatment' },
  { value: 'manual',     label: 'Manual / On-Demand' },
];

export function ProtocolForm() {
  const [, navigate] = useLocation();
  const { farmId } = useAuth();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;

  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<ProtocolTrigger>('calving');
  const [items, setItems] = useState<ProtocolItem[]>([]);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

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

  function addItem() {
    const label = newItemLabel.trim();
    if (!label) return;
    setItems(prev => [...prev, { id: crypto.randomUUID(), label }]);
    setNewItemLabel('');
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function handleItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addItem(); }
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

      {/* Name */}
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
              {triggerType === 'manual'      && 'Run this checklist manually from an animal\'s profile at any time.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Checklist items */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Checklist Items</p>

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No items yet — add your first step below.</p>
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

          <div className="flex gap-2 pt-1">
            <Input
              className="h-11 text-base"
              placeholder="Add a checklist item…"
              value={newItemLabel}
              onChange={e => setNewItemLabel(e.target.value)}
              onKeyDown={handleItemKeyDown}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 px-3 shrink-0"
              onClick={addItem}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
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
