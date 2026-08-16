import { useState } from 'react';
import { usePermissions } from '@/lib/permissions';
import { ViewerBlock } from '@/components/ViewerBlock';
import { useLocation, useRoute, Link } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

const GRADES = ['1', '2', '3', '4'];

export function EmbryoPurchaseForm() {
  const { isViewer } = usePermissions();
  if (isViewer) return <ViewerBlock backHref="/embryo" />;

  const [, params] = useRoute('/embryo/:id/purchase');
  const embryoId = params?.id ?? '';
  const [, setLocation] = useLocation();
  const [saving, setSaving] = useState(false);

  const embryo = useLiveQuery(() => db.embryos.get(embryoId), [embryoId]);

  const [form, setForm] = useState({
    purchaseDate: format(new Date(), 'yyyy-MM-dd'),
    unitsCount: '',
    pricePerUnit: '',
    notes: '',
  });

  // Grade breakdown: keyed by grade string, value is raw input string
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function setGrade(grade: string, value: string) {
    setGradeInputs(prev => ({ ...prev, [grade]: value }));
  }

  const units = parseInt(form.unitsCount) || 0;
  const price = parseFloat(form.pricePerUnit) || 0;
  const total = units * price;

  // Sum of all entered grade quantities
  const gradeTotal = GRADES.reduce((sum, g) => sum + (parseInt(gradeInputs[g] || '0') || 0), 0);
  const hasAnyGrade = gradeTotal > 0;
  const gradeMismatch = hasAnyGrade && units > 0 && gradeTotal !== units;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!embryoId || units <= 0) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();

      // Build grade breakdown — only include grades with a positive count
      const gradeBreakdown = GRADES
        .map(g => ({ grade: g, count: parseInt(gradeInputs[g] || '0') || 0 }))
        .filter(g => g.count > 0);

      await db.embryoPurchases.add({
        id: self.crypto.randomUUID(),
        embryoId,
        purchaseDate: form.purchaseDate,
        unitsCount: units,
        pricePerUnit: price,
        totalCost: parseFloat(total.toFixed(2)),
        gradeBreakdown: gradeBreakdown.length > 0 ? gradeBreakdown : undefined,
        notes: form.notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
      setLocation(`/embryo/${embryoId}`);
    } finally {
      setSaving(false);
    }
  }

  if (embryo === undefined) return <div className="p-4 text-center">Loading…</div>;
  if (embryo === null) return <div className="p-4 text-center text-destructive">Embryo lot not found.</div>;

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/embryo/${embryoId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Record Purchase</h2>
          <p className="text-sm text-muted-foreground">{embryo.donorName}</p>
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
          <Label htmlFor="unitsCount">Total Embryos *</Label>
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

        {/* Grade Breakdown */}
        <div className="space-y-3">
          <div>
            <Label>Grade Breakdown <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enter how many embryos are each grade. Leave blank if not graded.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {GRADES.map(g => (
              <div key={g} className="space-y-1">
                <Label htmlFor={`grade-${g}`} className="text-xs text-center block">Grade {g}</Label>
                <Input
                  id={`grade-${g}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={gradeInputs[g] || ''}
                  onChange={e => setGrade(g, e.target.value)}
                  placeholder="0"
                  className="text-center"
                />
              </div>
            ))}
          </div>
          {hasAnyGrade && (
            <div className={`text-xs flex items-center justify-between px-1 ${gradeMismatch ? 'text-destructive' : 'text-muted-foreground'}`}>
              <span>Grade total: <strong>{gradeTotal}</strong></span>
              {gradeMismatch && <span>⚠ Must equal {units} total embryos</span>}
              {!gradeMismatch && units > 0 && <span className="text-green-600">✓ Matches</span>}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pricePerUnit">Price Per Embryo ($)</Label>
          <Input
            id="pricePerUnit"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.pricePerUnit}
            onChange={e => set('pricePerUnit', e.target.value)}
            placeholder="e.g. 250.00"
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
            placeholder="Lot number, tank location, supplier, etc."
          />
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-base font-bold"
          disabled={saving || units <= 0 || gradeMismatch}
        >
          {saving ? 'Saving…' : 'Record Purchase'}
        </Button>
      </form>
    </div>
  );
}
