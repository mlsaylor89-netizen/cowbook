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

export function EmbryoDetail() {
  const [, params] = useRoute('/embryo/:id');
  const id = params?.id;
  const [, setLocation] = useLocation();

  async function removeEmbryo() {
    if (!id) return;
    await Promise.all([
      db.embryos.delete(id),
      db.embryoPurchases.where('embryoId').equals(id).delete(),
    ]);
    setLocation('/embryo');
  }

  const data = useLiveQuery(async () => {
    if (!id) return null;
    const embryo = await db.embryos.get(id);
    if (!embryo) return null;

    const purchases = await db.embryoPurchases.where('embryoId').equals(id).reverse().sortBy('purchaseDate');
    const breedings = await db.breedings.where('embryoId').equals(id).reverse().sortBy('date');

    const totalBought = purchases.reduce((sum, p) => sum + p.unitsCount, 0);
    const inventory = totalBought - breedings.length;

    // Aggregate grade breakdown across all purchases
    const gradeMap = new Map<string, number>();
    for (const p of purchases) {
      for (const g of p.gradeBreakdown ?? []) {
        gradeMap.set(g.grade, (gradeMap.get(g.grade) ?? 0) + g.count);
      }
    }
    const grades = [...gradeMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([grade, count]) => ({ grade, count }));

    return { embryo, purchases, breedings, inventory, grades };
  }, [id]);

  if (!data) return <div className="p-4 text-center">Loading...</div>;

  const { embryo, purchases, breedings, inventory, grades } = data;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3">
        <Link href="/embryo">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">{embryo.donorName}</h2>
          {embryo.sireName && (
            <p className="text-sm text-muted-foreground">Sire: {embryo.sireName}</p>
          )}
        </div>
      </div>

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-6 text-center">
          <p className="text-sm font-bold uppercase tracking-widest opacity-80">Current Inventory</p>
          <p className="text-6xl font-bold my-2">{inventory}</p>
          <p className="text-sm opacity-80">Embryos Available</p>
          {grades.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {grades.map(g => (
                <span key={g.grade} className="bg-white/20 text-white text-sm font-bold px-3 py-1 rounded-full">
                  Grade {g.grade}: {g.count}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {embryo.breed && (
          <Card><CardContent className="p-3"><p className="text-muted-foreground text-xs uppercase tracking-wider">Breed</p><p className="font-bold">{embryo.breed}</p></CardContent></Card>
        )}
        {embryo.studCompany && (
          <Card><CardContent className="p-3"><p className="text-muted-foreground text-xs uppercase tracking-wider">Company</p><p className="font-bold">{embryo.studCompany}</p></CardContent></Card>
        )}
        {embryo.sireNaabCode && (
          <Card><CardContent className="p-3"><p className="text-muted-foreground text-xs uppercase tracking-wider">Sire NAAB</p><p className="font-bold">{embryo.sireNaabCode}</p></CardContent></Card>
        )}
      </div>

      <Link href={`/embryo/${id}/purchase`}>
        <Button className="w-full h-14 text-lg font-bold">Record Purchase</Button>
      </Link>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full h-12 border-destructive text-destructive hover:bg-destructive hover:text-white"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Remove Embryo Lot
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {embryo.donorName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this embryo lot and all purchase records. Existing breeding records using these embryos will be kept for history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={removeEmbryo}
            >
              Yes, Remove Lot
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
                <CardContent className="p-3 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{format(parseISO(p.purchaseDate), 'MMM d, yyyy')}</p>
                    <p className="text-sm text-muted-foreground">${p.pricePerUnit}/embryo</p>
                    {p.gradeBreakdown && p.gradeBreakdown.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.gradeBreakdown.map(g => (
                          <span key={g.grade} className="text-xs px-1.5 py-0.5 rounded bg-muted font-semibold text-muted-foreground">
                            G{g.grade}: {g.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
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
                    <p className="font-bold">Embryo Transfer</p>
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
