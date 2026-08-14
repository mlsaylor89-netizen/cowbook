import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, AlertTriangle } from 'lucide-react';

export function SemenInventory() {
  const data = useLiveQuery(async () => {
    const bulls = await db.semenBulls.toArray();
    const purchases = await db.semenPurchases.toArray();
    const breedings = await db.breedings.toArray();
    const settings = await db.settings.get('default');

    return bulls.map(bull => {
      const bullPurchases = purchases.filter(p => p.bullId === bull.id);
      const totalBought = bullPurchases.reduce((sum, p) => sum + p.unitsCount, 0);
      const totalUsed = breedings.filter(b => b.bullId === bull.id).length;
      const inventory = totalBought - totalUsed;
      
      return {
        bull,
        inventory,
        isLow: inventory <= (settings?.lowSemenThreshold || 2)
      };
    });
  });

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Semen Inventory</h2>
        <Link href="/semen/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" /> Add Bull
          </Button>
        </Link>
      </div>

      {data === undefined ? (
        <div className="p-4 text-center">Loading...</div>
      ) : data.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-xl border-dashed">
          No semen inventory recorded.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.map(({ bull, inventory, isLow }) => (
            <Link key={bull.id} href={`/semen/${bull.id}`} className="block active-elevate hover-elevate">
              <Card className={`shadow-sm ${isLow ? 'border-amber-500' : ''}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg">{bull.name}</p>
                    <p className="text-sm text-muted-foreground">{bull.studCompany}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${isLow ? 'text-amber-600' : 'text-primary'}`}>
                      {inventory}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Units</p>
                  </div>
                </CardContent>
                {isLow && (
                  <div className="bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider px-3 py-1 flex items-center justify-center gap-1 rounded-b-lg">
                    <AlertTriangle className="h-3 w-3" /> Low Inventory
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
