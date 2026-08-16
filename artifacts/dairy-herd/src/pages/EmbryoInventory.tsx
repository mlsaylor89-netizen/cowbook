import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, AlertTriangle } from 'lucide-react';

export function EmbryoInventory() {
  const [, navigate] = useLocation();

  const data = useLiveQuery(async () => {
    const embryos = await db.embryos.toArray();
    const purchases = await db.embryoPurchases.toArray();
    const breedings = await db.breedings.filter(b => b.breedingType === 'Embryo').toArray();

    return embryos.map(embryo => {
      const embryoPurchases = purchases.filter(p => p.embryoId === embryo.id);
      const totalBought = embryoPurchases.reduce((sum, p) => sum + p.unitsCount, 0);
      const totalUsed = breedings.filter(b => b.embryoId === embryo.id).length;
      const inventory = totalBought - totalUsed;

      // Aggregate grade breakdown across all purchases
      const gradeMap = new Map<string, number>();
      for (const p of embryoPurchases) {
        for (const g of p.gradeBreakdown ?? []) {
          gradeMap.set(g.grade, (gradeMap.get(g.grade) ?? 0) + g.count);
        }
      }
      const grades = [...gradeMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([grade, count]) => ({ grade, count }));

      return { embryo, inventory, isLow: inventory <= 2, grades };
    });
  });

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Embryo Inventory</h2>
        <Button size="sm" onClick={() => navigate('/embryo/new')}>
          <Plus className="h-4 w-4 mr-2" /> Add Embryo Lot
        </Button>
      </div>

      {data === undefined ? (
        <div className="p-4 text-center">Loading...</div>
      ) : data.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-xl border-dashed">
          No embryo inventory recorded.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.map(({ embryo, inventory, isLow, grades }) => (
            <div
              key={embryo.id}
              className="cursor-pointer active-elevate hover-elevate"
              onClick={() => navigate(`/embryo/${embryo.id}`)}
            >
              <Card className={`shadow-sm ${isLow ? 'border-amber-500' : ''}`}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-lg truncate">{embryo.donorName}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {embryo.sireName ? `× ${embryo.sireName}` : embryo.breed}
                    </p>
                    {grades.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {grades.map(g => (
                          <span key={g.grade} className="text-xs px-1.5 py-0.5 rounded bg-muted font-semibold text-muted-foreground">
                            G{g.grade}: {g.count}
                          </span>
                        ))}
                      </div>
                    )}
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
                      onClick={e => { e.stopPropagation(); navigate(`/embryo/${embryo.id}/purchase`); }}
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
