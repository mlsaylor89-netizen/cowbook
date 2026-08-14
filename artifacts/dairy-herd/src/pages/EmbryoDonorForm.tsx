import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { db } from '@/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';

export function EmbryoDonorForm() {
  const [, setLocation] = useLocation();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    donorName: '',
    sireName: '',
    sireNaabCode: '',
    breed: '',
    studCompany: '',
    notes: '',
  });

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.donorName.trim() || !form.breed.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const id = self.crypto.randomUUID();
      await db.embryos.add({
        id,
        donorName: form.donorName.trim(),
        sireName: form.sireName.trim() || undefined,
        sireNaabCode: form.sireNaabCode.trim() || undefined,
        breed: form.breed.trim(),
        studCompany: form.studCompany.trim() || undefined,
        notes: form.notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
      setLocation(`/embryo/${id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/embryo">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold">Add Embryo Lot</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="donorName">Donor Cow *</Label>
          <Input
            id="donorName"
            value={form.donorName}
            onChange={e => set('donorName', e.target.value)}
            placeholder="e.g. Bessie 42 or lot name"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="breed">Breed *</Label>
          <Input
            id="breed"
            value={form.breed}
            onChange={e => set('breed', e.target.value)}
            placeholder="e.g. Holstein, Jersey"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sireName">Sire Name</Label>
          <Input
            id="sireName"
            value={form.sireName}
            onChange={e => set('sireName', e.target.value)}
            placeholder="e.g. Holsteiner 1234"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sireNaabCode">Sire NAAB Code</Label>
          <Input
            id="sireNaabCode"
            value={form.sireNaabCode}
            onChange={e => set('sireNaabCode', e.target.value)}
            placeholder="e.g. 7HO12345"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="studCompany">Stud / Company</Label>
          <Input
            id="studCompany"
            value={form.studCompany}
            onChange={e => set('studCompany', e.target.value)}
            placeholder="e.g. Trans Ova, Select Sires"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Lot number, tank location, etc."
          />
        </div>

        <Button type="submit" className="w-full h-12 text-base font-bold" disabled={saving}>
          {saving ? 'Saving…' : 'Add Embryo Lot'}
        </Button>
      </form>
    </div>
  );
}
