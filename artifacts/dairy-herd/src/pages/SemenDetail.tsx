import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { Link, useRoute, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2 } from 'lucide-react';
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
      <div className="flex items-center gap-3">
        <Link href="/semen">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold">{bull.name}</h2>
      </div>

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-6 text-center">
          <p className="text-sm font-bold uppercase tracking-widest opacity-80">Current Inventory</p>
          <p className="text-6xl font-bold my-2">{inventory}</p>
          <p className="text-sm opacity-80">Units Available</p>
        </CardContent>
      </Card>

      <Button className="w-full h-14 text-lg font-bold" disabled>Record Purchase</Button>

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
              This will permanently delete this bull and all purchase records. Existing breeding records that used this bull will be kept for history. This cannot be undone.
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

      <div className="space-y-4">
        <h3 className="text-lg font-bold">Purchase History</h3>
        {purchases.length === 0 ? (
          <p className="text-muted-foreground text-sm">No purchases recorded.</p>
        ) : (
          <div className="space-y-2">
            {purchases.map(p => (
              <Card key={p.id}>
                <CardContent className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold">{format(parseISO(p.purchaseDate), 'MMM d, yyyy')}</p>
                    <p className="text-sm text-muted-foreground">${p.pricePerUnit}/unit</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">+{p.unitsCount}</p>
                    <p className="text-sm text-muted-foreground">${p.totalCost}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

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
