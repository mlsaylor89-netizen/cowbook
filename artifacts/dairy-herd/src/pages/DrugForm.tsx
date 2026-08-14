import { useEffect, useState } from 'react';
import { useLocation, useRoute, Link } from 'wouter';
import { db, type DrugRoute } from '@/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const ROUTES: DrugRoute[] = ['IM', 'SQ', 'IV', 'Oral', 'Intramammary', 'Topical', 'Other'];
const COMMON_UNITS = ['mL', 'cc', 'tablets', 'tubes', 'g', 'oz', 'lb', 'packets', 'boluses', 'doses'];

export function DrugForm() {
  const [, setLocation] = useLocation();
  const [matchEdit, params] = useRoute('/pharmacy/:id/edit');
  const isEdit = matchEdit && params?.id !== 'new';
  const editId = isEdit ? params!.id : undefined;
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    unit: 'mL',
    customUnit: '',
    bottleSize: '',
    quantityOnHand: '',
    milkWithholdDays: '',
    meatWithholdDays: '',
    defaultDose: '',
    defaultRoute: '' as DrugRoute | '',
    lowStockThreshold: '',
    notes: '',
  });

  useEffect(() => {
    if (isEdit && editId) {
      db.drugProducts.get(editId).then(drug => {
        if (!drug) return;
        const knownUnit = COMMON_UNITS.includes(drug.unit);
        setForm({
          name: drug.name,
          unit: knownUnit ? drug.unit : 'custom',
          customUnit: knownUnit ? '' : drug.unit,
          bottleSize: drug.bottleSize != null ? String(drug.bottleSize) : '',
          quantityOnHand: String(drug.quantityOnHand),
          milkWithholdDays: drug.milkWithholdDays > 0 ? String(drug.milkWithholdDays) : '',
          meatWithholdDays: drug.meatWithholdDays > 0 ? String(drug.meatWithholdDays) : '',
          defaultDose: drug.defaultDose ?? '',
          defaultRoute: drug.defaultRoute ?? '',
          lowStockThreshold: drug.lowStockThreshold != null ? String(drug.lowStockThreshold) : '',
          notes: drug.notes ?? '',
        });
      });
    }
  }, [isEdit, editId]);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const resolvedUnit = form.unit === 'custom' ? form.customUnit : form.unit;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !resolvedUnit.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        name: form.name.trim(),
        unit: resolvedUnit.trim(),
        bottleSize: form.bottleSize ? parseFloat(form.bottleSize) : undefined,
        quantityOnHand: parseFloat(form.quantityOnHand) || 0,
        milkWithholdDays: parseInt(form.milkWithholdDays) || 0,
        meatWithholdDays: parseInt(form.meatWithholdDays) || 0,
        defaultDose: form.defaultDose.trim() || undefined,
        defaultRoute: (form.defaultRoute as DrugRoute) || undefined,
        lowStockThreshold: form.lowStockThreshold ? parseFloat(form.lowStockThreshold) : undefined,
        notes: form.notes.trim() || undefined,
        updatedAt: now,
      };

      if (isEdit && editId) {
        await db.drugProducts.update(editId, payload);
      } else {
        await db.drugProducts.add({ ...payload, id: self.crypto.randomUUID(), createdAt: now });
      }
      setLocation('/pharmacy');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    await db.drugProducts.delete(editId);
    setLocation('/pharmacy');
  }

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/pharmacy">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h2 className="text-2xl font-bold">{isEdit ? 'Edit Drug' : 'Add Drug'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Drug / Product Name *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Penicillin G, Banamine, Draxxin"
            required
          />
        </div>

        {/* Unit */}
        <div className="space-y-1.5">
          <Label>Unit *</Label>
          <Select value={form.unit} onValueChange={val => set('unit', val)}>
            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMMON_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              <SelectItem value="custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          {form.unit === 'custom' && (
            <Input
              value={form.customUnit}
              onChange={e => set('customUnit', e.target.value)}
              placeholder="Enter unit name"
              required
            />
          )}
        </div>

        {/* Bottle size */}
        <div className="space-y-1.5">
          <Label htmlFor="bottleSize">Full Bottle / Package Size ({resolvedUnit})</Label>
          <Input
            id="bottleSize"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.bottleSize}
            onChange={e => set('bottleSize', e.target.value)}
            placeholder={`e.g. 500 ${resolvedUnit}`}
          />
          <p className="text-xs text-muted-foreground">Used to show a low-stock warning on the home screen when ≤25% remains.</p>
        </div>

        {/* Quantity on hand */}
        <div className="space-y-1.5">
          <Label htmlFor="qty">Quantity on Hand *</Label>
          <Input
            id="qty"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.quantityOnHand}
            onChange={e => set('quantityOnHand', e.target.value)}
            placeholder={`0 ${resolvedUnit}`}
            required
          />
        </div>

        {/* Withhold days */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="milk">Milk Withhold (days)</Label>
            <Input
              id="milk"
              type="number"
              inputMode="numeric"
              min="0"
              value={form.milkWithholdDays}
              onChange={e => set('milkWithholdDays', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meat">Meat Withhold (days)</Label>
            <Input
              id="meat"
              type="number"
              inputMode="numeric"
              min="0"
              value={form.meatWithholdDays}
              onChange={e => set('meatWithholdDays', e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Default dose + route */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="dose">Default Dose</Label>
            <Input
              id="dose"
              value={form.defaultDose}
              onChange={e => set('defaultDose', e.target.value)}
              placeholder={`e.g. 10 ${resolvedUnit}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default Route</Label>
            <Select value={form.defaultRoute} onValueChange={val => set('defaultRoute', val)}>
              <SelectTrigger className="h-12"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {ROUTES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Low stock threshold */}
        <div className="space-y-1.5">
          <Label htmlFor="threshold">Low Stock Alert Threshold ({resolvedUnit})</Label>
          <Input
            id="threshold"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.lowStockThreshold}
            onChange={e => set('lowStockThreshold', e.target.value)}
            placeholder="e.g. 50"
          />
          <p className="text-xs text-muted-foreground">Show a warning when quantity falls at or below this amount.</p>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Storage instructions, supplier, lot number, etc."
          />
        </div>

        <Button type="submit" className="w-full h-12 text-base font-bold" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Drug'}
        </Button>
      </form>

      {isEdit && (
        <div className="mt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full h-12 border-destructive text-destructive hover:bg-destructive hover:text-white">
                <Trash2 className="h-4 w-4 mr-2" /> Remove Drug
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {form.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the drug from pharmacy. Existing treatment records that used it are kept. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-white" onClick={handleDelete}>
                  Yes, Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
