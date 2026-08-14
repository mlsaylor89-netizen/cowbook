import { useState } from 'react';
import { useLocation, useRoute, Link } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

export function SemenPurchaseForm() {
  const [, params] = useRoute('/semen/:id/purchase');
  const bullId = params?.id ?? '';
  const [, setLocation] = useLocation();
  const [saving, setSaving] = useState(false);

  const bull = useLiveQuery(() => db.semenBulls.get(bullId), [bullId]);

  const [form, setForm] = useState({
    purchaseDate: format(new Date(), 'yyyy-MM-dd'),
    unitsCount: '',
    pricePerUnit: '',
    notes: '',
  });

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const units = parseInt(form.unitsCount) || 0;
  const price = parseFloat(form.pricePerUnit) || 0;
  const total = units * price;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bullId || units <= 0) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await db.semenPurchases.add({
        id: self.crypto.randomUUID(),
        bullId,
        purchaseDate: form.purchaseDate,
        unitsCount: units,
        pricePerUnit: price,
        totalCost: parseFloat(total.toFixed(2)),
        notes: form.notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
      setLocation(`/semen/${bullId}`);
    } finally {
      setSaving(false);
    }
  }

  if (bull === undefined) return <div className="p-4 text-center">Loading…</div>;
  if (bull === null) return <div className="p-4 text-center text-destructive">Bull not found.</div>;

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/semen/${bullId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Record Purchase</h2>
          <p className="text-sm text-muted-foreground">{bull.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="purchaseDate">Purchase Date *</Label>
          <Input
            id="purchaseDate"
            type="date"
            value={form.purchaseDate}
            onChange={e => set('purchaseDate', e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="unitsCount">Units Purchased *</Label>
          <Input
            id="unitsCount"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.unitsCount}
            onChange={e => set('unitsCount', e.target.value)}
            placeholder="e.g. 10"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pricePerUnit">Price Per Unit ($)</Label>
          <Input
            id="pricePerUnit"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.pricePerUnit}
            onChange={e => set('pricePerUnit', e.target.value)}
            placeholder="e.g. 25.00"
          />
        </div>

        {units > 0 && price > 0 && (
          <div className="rounded-lg bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">Total cost: </span>
            <span className="font-bold">${total.toFixed(2)}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Lot number, supplier, etc."
          />
        </div>

        <Button type="submit" className="w-full h-12 text-base font-bold" disabled={saving || units <= 0}>
          {saving ? 'Saving…' : 'Record Purchase'}
        </Button>
      </form>
    </div>
  );
}
