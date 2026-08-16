import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { db } from '@/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, FlaskConical, Microscope } from 'lucide-react';
import { format } from 'date-fns';

// ── stats helpers ────────────────────────────────────────────────────────────

function pct(num: number, denom: number) {
  if (denom <= 0 || num <= 0) return null;
  return (num / denom) * 100;
}

function fmtPct(n: number | null) {
  if (n === null) return null;
  return `${Math.round(n)}%`;
}

// ── component ─────────────────────────────────────────────────────────────

export function FlushForm() {
  const [, setLocation] = useLocation();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    donorCowName: '',
    sireName: '',
    flushDate: format(new Date(), 'yyyy-MM-dd'),
    flushType: '' as '' | 'conventional' | 'ivf',
    grade1Count: '',
    grade2Count: '',
    grade3Count: '',
    unfertilizedCount: '',
    oocyteCount: '',
    numberFrozen: '',
    notes: '',
  });

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  // ── live stat calculations ──────────────────────────────────────────────

  const g1 = parseInt(form.grade1Count) || 0;
  const g2 = parseInt(form.grade2Count) || 0;
  const g3 = parseInt(form.grade3Count) || 0;
  const fertilized = g1 + g2 + g3;
  const frozen = parseInt(form.numberFrozen) || 0;

  const isConventional = form.flushType === 'conventional';
  const isIVF = form.flushType === 'ivf';

  const unfert = parseInt(form.unfertilizedCount) || 0;
  const oocytes = parseInt(form.oocyteCount) || 0;

  const denominator = isConventional ? fertilized + unfert : oocytes;
  const pctFert = fmtPct(pct(fertilized, denominator));
  const pctG1 = fmtPct(pct(g1, fertilized));
  const pctG2 = fmtPct(pct(g2, fertilized));
  const pctG3 = fmtPct(pct(g3, fertilized));

  const showStats = fertilized > 0 && (
    (isConventional && denominator > 0) || (isIVF && oocytes > 0)
  );

  // ── submit ──────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.donorCowName.trim() || !form.flushType) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const donorName = form.donorCowName.trim();

      // Save flush record
      await db.flushRecords.add({
        id: self.crypto.randomUUID(),
        donorCowName: donorName,
        flushDate: form.flushDate,
        flushType: form.flushType,
        sireName: form.sireName.trim() || undefined,
        grade1Count: g1 || undefined,
        grade2Count: g2 || undefined,
        grade3Count: g3 || undefined,
        unfertilizedCount: isConventional ? (unfert || undefined) : undefined,
        oocyteCount: isIVF ? (oocytes || undefined) : undefined,
        numberFrozen: frozen || undefined,
        notes: form.notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });

      // If embryos were frozen, update embryo inventory
      if (frozen > 0) {
        const sireName = form.sireName.trim() || undefined;

        // Find an existing embryo lot for this donor (case-insensitive match)
        const allEmbryos = await db.embryos.toArray();
        const existingLot = allEmbryos.find(
          e => e.donorName.toLowerCase() === donorName.toLowerCase()
        );

        let embryoId: string;
        if (existingLot) {
          embryoId = existingLot.id;
        } else {
          // Create a new lot
          embryoId = self.crypto.randomUUID();
          await db.embryos.add({
            id: embryoId,
            donorName,
            sireName,
            breed: '',
            createdAt: now,
            updatedAt: now,
          });
        }

        // Build grade breakdown from flush grades (proportional to frozen count isn't
        // tracked here — we record what the user entered and use frozen as the unit count)
        const gradeBreakdown = [
          { grade: '1', count: g1 },
          { grade: '2', count: g2 },
          { grade: '3', count: g3 },
        ].filter(g => g.count > 0);

        await db.embryoPurchases.add({
          id: self.crypto.randomUUID(),
          embryoId,
          purchaseDate: form.flushDate,
          unitsCount: frozen,
          pricePerUnit: 0,
          totalCost: 0,
          gradeBreakdown: gradeBreakdown.length > 0 ? gradeBreakdown : undefined,
          notes: `From flush on ${format(new Date(form.flushDate), 'MMM d, yyyy')}`,
          createdAt: now,
          updatedAt: now,
        });
      }

      setLocation('/flush');
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = !!form.donorCowName.trim() && !!form.flushType;

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/flush">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold">Record Flush</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Donor Cow — free text */}
        <div className="space-y-1.5">
          <Label htmlFor="donorCowName">Donor Cow *</Label>
          <Input
            id="donorCowName"
            value={form.donorCowName}
            onChange={e => set('donorCowName', e.target.value)}
            placeholder="e.g. Ella 412"
            required
          />
        </div>

        {/* Sire — above flush date */}
        <div className="space-y-1.5">
          <Label htmlFor="sireName">Mating Sire</Label>
          <Input
            id="sireName"
            value={form.sireName}
            onChange={e => set('sireName', e.target.value)}
            placeholder="Bull name or NAAB code"
          />
        </div>

        {/* Flush Date */}
        <div className="space-y-1.5">
          <Label htmlFor="flushDate">Flush Date *</Label>
          <Input
            id="flushDate"
            type="date"
            value={form.flushDate}
            onChange={e => set('flushDate', e.target.value)}
            required
          />
        </div>

        {/* Flush type */}
        <div className="space-y-1.5">
          <Label>Flush Type *</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => set('flushType', 'conventional')}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                form.flushType === 'conventional'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-border bg-background text-muted-foreground hover:border-muted-foreground'
              }`}
            >
              <FlaskConical className="h-7 w-7" />
              <span className="font-bold text-sm">Conventional Flush</span>
            </button>
            <button
              type="button"
              onClick={() => set('flushType', 'ivf')}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                form.flushType === 'ivf'
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-border bg-background text-muted-foreground hover:border-muted-foreground'
              }`}
            >
              <Microscope className="h-7 w-7" />
              <span className="font-bold text-sm">IVF</span>
            </button>
          </div>
        </div>

        {/* Type-specific fields */}
        {form.flushType && (
          <>
            {/* IVF: oocyte count */}
            {isIVF && (
              <div className="space-y-1.5">
                <Label htmlFor="oocyteCount">Oocytes Produced</Label>
                <Input
                  id="oocyteCount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.oocyteCount}
                  onChange={e => set('oocyteCount', e.target.value)}
                  placeholder="e.g. 15"
                />
              </div>
            )}

            {/* Grade counts */}
            <div className="space-y-3">
              <Label>
                {isConventional ? 'Embryo Counts' : 'Fertilized Embryo Counts'}
              </Label>
              <div className={`grid gap-3 ${isConventional ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <GradeInput label="Grade 1" id="grade1Count" value={form.grade1Count} onChange={v => set('grade1Count', v)} color="green" />
                <GradeInput label="Grade 2" id="grade2Count" value={form.grade2Count} onChange={v => set('grade2Count', v)} color="yellow" />
                <GradeInput label="Grade 3" id="grade3Count" value={form.grade3Count} onChange={v => set('grade3Count', v)} color="orange" />
                {isConventional && (
                  <GradeInput label="Unfert." id="unfertilizedCount" value={form.unfertilizedCount} onChange={v => set('unfertilizedCount', v)} color="gray" />
                )}
              </div>
            </div>

            {/* Number frozen */}
            <div className="space-y-1.5">
              <Label htmlFor="numberFrozen">Number Frozen</Label>
              <Input
                id="numberFrozen"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.numberFrozen}
                onChange={e => set('numberFrozen', e.target.value)}
                placeholder="e.g. 8"
              />
              {frozen > 0 && (
                <p className="text-xs text-teal-700 font-medium">
                  ✓ {frozen} unit{frozen !== 1 ? 's' : ''} will be added to Embryo Inventory for {form.donorCowName.trim() || 'this donor'}.
                </p>
              )}
            </div>

            {/* Live stats preview */}
            {showStats && (
              <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Results Preview</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatRow label={isIVF ? 'Oocytes collected' : 'Total collected'} value={String(denominator)} />
                  <StatRow label="Embryos (fertilized)" value={String(fertilized)} bold />
                  {pctFert && <StatRow label="% Fertilized" value={pctFert} bold />}
                  {frozen > 0 && <StatRow label="Frozen" value={String(frozen)} />}
                </div>
                {fertilized > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Grade breakdown (of fertilized)</p>
                    <div className="space-y-1.5">
                      {g1 > 0 && <GradeBar label="Grade 1" count={g1} pct={pctG1} color="bg-green-500" />}
                      {g2 > 0 && <GradeBar label="Grade 2" count={g2} pct={pctG2} color="bg-yellow-500" />}
                      {g3 > 0 && <GradeBar label="Grade 3" count={g3} pct={pctG3} color="bg-orange-500" />}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={2}
                placeholder="Technician, lab, comments…"
              />
            </div>
          </>
        )}

        <Button
          type="submit"
          className="w-full h-12 text-base font-bold"
          disabled={saving || !canSubmit}
        >
          {saving ? 'Saving…' : 'Save Flush Record'}
        </Button>
      </form>
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────

function GradeInput({
  label, id, value, onChange, color,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void; color: string;
}) {
  const border: Record<string, string> = {
    green: 'border-green-400', yellow: 'border-yellow-400',
    orange: 'border-orange-400', gray: 'border-gray-300',
  };
  const text: Record<string, string> = {
    green: 'text-green-700', yellow: 'text-yellow-700',
    orange: 'text-orange-700', gray: 'text-muted-foreground',
  };
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className={`text-xs block text-center ${text[color]}`}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
        className={`text-center border-2 ${border[color]}`}
      />
    </div>
  );
}

function StatRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-bold' : 'font-semibold'}>{value}</span>
    </div>
  );
}

function GradeBar({ label, count, pct, color }: { label: string; count: number; pct: string | null; color: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 text-muted-foreground">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: pct ? pct : '0%' }}
        />
      </div>
      <span className="w-14 text-right font-semibold">{count} {pct ? `(${pct})` : ''}</span>
    </div>
  );
}
