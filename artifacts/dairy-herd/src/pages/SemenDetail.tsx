import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '@/db';
import type { SemenPurchase } from '@/db';
import { Link, useRoute, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Trash2, Edit, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
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

function PurchaseRow({ purchase }: { purchase: SemenPurchase }) {
  const [editing, setEditing] = useState(false);
  const [tank, setTank] = useState(purchase.tankNumber ?? '');
  const [canister, setCanister] = useState(purchase.canisterNumber ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await db.semenPurchases.update(purchase.id, {
        tankNumber: tank.trim() || undefined,
        canisterNumber: canister.trim() || undefined,
        updatedAt: new Date().toISOString(),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setTank(purchase.tankNumber ?? '');
    setCanister(purchase.canisterNumber ?? '');
    setEditing(false);
  }

  const location = [
    purchase.tankNumber ? `Tank ${purchase.tankNumber}` : '',
    purchase.canisterNumber ? `Can. ${purchase.canisterNumber}` : '',
  ].filter(Boolean).join(' / ');

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-bold">{format(parseISO(purchase.purchaseDate), 'MMM d, yyyy')}</p>
            <p className="text-sm text-muted-foreground">${purchase.pricePerUnit}/unit</p>
            {!editing && location && (
              <p className="text-xs text-muted-foreground mt-0.5">{location}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="font-bold text-lg">+{purchase.unitsCount}</p>
              <p className="text-sm text-muted-foreground">${purchase.totalCost}</p>
            </div>
            {!editing && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground"
                onClick={() => setEditing(true)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {editing && (
          <div className="pt-1 border-t space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Storage Location</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`tank-${purchase.id}`} className="text-xs">Tank #</Label>
                <Input
                  id={`tank-${purchase.id}`}
                  value={tank}
                  onChange={e => setTank(e.target.value)}
                  placeholder="e.g. 1"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`can-${purchase.id}`} className="text-xs">Canister #</Label>
                <Input
                  id={`can-${purchase.id}`}
                  value={canister}
                  onChange={e => setCanister(e.target.value)}
                  placeholder="e.g. 3"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8" onClick={save} disabled={saving}>
                <Check className="h-3.5 w-3.5 mr-1" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-8" onClick={cancel} disabled={saving}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SemenDetail() {
  const [match, params] = useRoute('/semen/:id');
  const id = params?.id;
  const [, setLocation] = useLocation();

  async function removeBull() {
    if (!id) return;
    await Promise.all([
      db.semenBulls.delete(id),
      db.semenPurchases.where('bullId').equals(id).delete(),
    ]);
    setLocation('/semen');
  }

  const data = useLiveQuery(async () => {
    if (!id) return null;
    const bull = await db.semenBulls.get(id);
    if (!bull) return null;

    const purchases = await db.semenPurchases.where('bullId').equals(id).reverse().sortBy('purchaseDate');
    const breedings = await db.breedings.where('bullId').equals(id).reverse().sortBy('date');

    const totalBought = purchases.reduce((sum, p) => sum + p.unitsCount, 0);
    const inventory = totalBought - breedings.length;

    return { bull, purchases, breedings, inventory };
  }, [id]);

  if (!data) return <div className="p-4 text-center">Loading...</div>;

  const { bull, purchases, breedings, inventory } = data;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/semen">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold">{bull.name}</h2>
            {bull.studCompany && (
              <p className="text-sm text-muted-foreground leading-tight">{bull.studCompany}</p>
            )}
          </div>
        </div>
        <Link href={`/semen/${id}/edit`}>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        </Link>
      </div>

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-6 text-center">
          <p className="text-sm font-bold uppercase tracking-widest opacity-80">Current Inventory</p>
          <p className="text-6xl font-bold my-2">{inventory}</p>
          <p className="text-sm opacity-80">Units Available</p>
        </CardContent>
      </Card>

      <Link href={`/semen/${id}/purchase`}>
        <Button className="w-full h-14 text-lg font-bold">Record Purchase</Button>
      </Link>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full h-12 border-destructive text-destructive hover:bg-destructive hover:text-white"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Remove Bull
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {bull.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this bull and all purchase records. Existing breeding
              records that used this bull will be kept for history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={removeBull}
            >
              Yes, Remove Bull
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purchase History */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Purchase History</h3>
        {purchases.length === 0 ? (
          <p className="text-muted-foreground text-sm">No purchases recorded.</p>
        ) : (
          <div className="space-y-2">
            {purchases.map(p => (
              <PurchaseRow key={p.id} purchase={p} />
            ))}
          </div>
        )}
      </div>

      {/* Usage History */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Usage History</h3>
        {breedings.length === 0 ? (
          <p className="text-muted-foreground text-sm">No usage recorded.</p>
        ) : (
          <div className="space-y-2">
            {breedings.slice(0, 10).map(b => (
              <Card key={b.id}>
                <CardContent className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold">Breeding</p>
                    <p className="text-sm text-muted-foreground">{format(parseISO(b.date), 'MMM d, yyyy')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-destructive">-1</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {breedings.length > 10 && (
              <p className="text-center text-sm text-muted-foreground">Showing last 10 uses.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
