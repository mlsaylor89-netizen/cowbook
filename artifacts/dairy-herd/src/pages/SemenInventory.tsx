import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, AlertTriangle } from 'lucide-react';

export function SemenInventory() {
  const [, navigate] = useLocation();

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
      return { bull, inventory, isLow: inventory <= (settings?.lowSemenThreshold || 2) };
    });
  });

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Semen Inventory</h2>
        <Button size="sm" onClick={() => navigate('/semen/new')}>
          <Plus className="h-4 w-4 mr-2" /> Add Bull
        </Button>
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
            <div
              key={bull.id}
              className="cursor-pointer active-elevate hover-elevate"
              onClick={() => navigate(`/semen/${bull.id}`)}
            >
              <Card className={`shadow-sm ${isLow ? 'border-amber-500' : ''}`}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-lg truncate">{bull.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{bull.studCompany}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${isLow ? 'text-amber-600' : 'text-primary'}`}>
                        {inventory}
                      </p>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Units</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0 shrink-0"
                      title="Add units"
                      onClick={e => { e.stopPropagation(); navigate(`/semen/${bull.id}/purchase`); }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
                {isLow && (
                  <div className="bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider px-3 py-1 flex items-center justify-center gap-1 rounded-b-lg">
                    <AlertTriangle className="h-3 w-3" /> Low Inventory
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
