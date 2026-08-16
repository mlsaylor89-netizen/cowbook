import { useState, useEffect } from 'react';
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

export function SemenBullForm() {
  const { isViewer } = usePermissions();
  if (isViewer) return <ViewerBlock backHref="/semen" />;

  const [, setLocation] = useLocation();
  const [saving, setSaving] = useState(false);

  // Matches both /semen/new (create) and /semen/:id/edit (edit)
  const [isNew] = useRoute('/semen/new');
  const [isEdit, editParams] = useRoute('/semen/:id/edit');
  const editId = isEdit ? editParams?.id : undefined;

  const existingBull = useLiveQuery(
    () => (editId ? db.semenBulls.get(editId) : Promise.resolve(undefined)),
    [editId]
  );

  const [form, setForm] = useState({
    name: '',
    naabCode: '',
    registrationNumber: '',
    breed: '',
    studCompany: '',
    tankNumber: '',
    canisterNumber: '',
    notes: '',
  });

  // Populate form when editing
  useEffect(() => {
    if (existingBull) {
      setForm({
        name: existingBull.name ?? '',
        naabCode: existingBull.naabCode ?? '',
        registrationNumber: existingBull.registrationNumber ?? '',
        breed: existingBull.breed ?? '',
        studCompany: existingBull.studCompany ?? '',
        tankNumber: existingBull.tankNumber ?? '',
        canisterNumber: existingBull.canisterNumber ?? '',
        notes: existingBull.notes ?? '',
      });
    }
  }, [existingBull]);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.breed.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const fields = {
        name: form.name.trim(),
        naabCode: form.naabCode.trim() || undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
        breed: form.breed.trim(),
        studCompany: form.studCompany.trim() || undefined,
        tankNumber: form.tankNumber.trim() || undefined,
        canisterNumber: form.canisterNumber.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editId) {
        await db.semenBulls.update(editId, { ...fields, updatedAt: now });
        setLocation(`/semen/${editId}`);
      } else {
        const id = self.crypto.randomUUID();
        await db.semenBulls.add({ id, ...fields, createdAt: now, updatedAt: now });
        setLocation(`/semen/${id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  // Loading state for edit mode only
  if (editId && existingBull === undefined) {
    return <div className="p-4 text-center">Loading…</div>;
  }
  if (editId && existingBull === null) {
    return <div className="p-4 text-center text-destructive">Bull not found.</div>;
  }

  const backHref = editId ? `/semen/${editId}` : '/semen';

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold">{editId ? 'Edit Bull' : 'Add Bull'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">Bull Name *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Holsteiner 1234"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="breed">Breed *</Label>
          <Input
            id="breed"
            value={form.breed}
            onChange={e => set('breed', e.target.value)}
            placeholder="e.g. Holstein, Jersey, Angus"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="studCompany">Stud Company</Label>
          <Input
            id="studCompany"
            value={form.studCompany}
            onChange={e => set('studCompany', e.target.value)}
            placeholder="e.g. Select Sires"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="naabCode">NAAB Code</Label>
          <Input
            id="naabCode"
            value={form.naabCode}
            onChange={e => set('naabCode', e.target.value)}
            placeholder="e.g. 7HO12345"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="registrationNumber">Registration Number</Label>
          <Input
            id="registrationNumber"
            value={form.registrationNumber}
            onChange={e => set('registrationNumber', e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Storage Location</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tankNumber">Tank #</Label>
              <Input
                id="tankNumber"
                value={form.tankNumber}
                onChange={e => set('tankNumber', e.target.value)}
                placeholder="e.g. Tank 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="canisterNumber">Canister #</Label>
              <Input
                id="canisterNumber"
                value={form.canisterNumber}
                onChange={e => set('canisterNumber', e.target.value)}
                placeholder="e.g. C3"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
          />
        </div>

        <Button type="submit" className="w-full h-12 text-base font-bold" disabled={saving}>
          {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Bull'}
        </Button>
      </form>
    </div>
  );
}
