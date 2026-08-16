import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, AlertTriangle, Search, FlaskConical, MapPin } from 'lucide-react';

export function SemenInventory() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');

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

      // Collect unique tank/canister location strings for quick display
      const locations = Array.from(
        new Set(
          bullPurchases
            .filter(p => p.tankNumber || p.canisterNumber)
            .map(p => {
              const parts: string[] = [];
              if (p.tankNumber) parts.push(`Tank ${p.tankNumber}`);
              if (p.canisterNumber) parts.push(`Can. ${p.canisterNumber}`);
              return parts.join(' / ');
            })
        )
      );

      return {
        bull,
        inventory,
        locations,
        isLow: inventory <= (settings?.lowSemenThreshold || 2),
      };
    });
  });

  const filtered = data?.filter(({ bull }) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      bull.name.toLowerCase().includes(s) ||
      (bull.naabCode && bull.naabCode.toLowerCase().includes(s)) ||
      (bull.breed && bull.breed.toLowerCase().includes(s)) ||
      (bull.studCompany && bull.studCompany.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Semen Inventory</h2>
        <Button size="sm" onClick={() => navigate('/semen/new')}>
          <Plus className="h-4 w-4 mr-2" /> Add Bull
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search bull, NAAB code, breed, stud..."
          className="pl-10 h-12 text-lg bg-card"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {data === undefined ? (
        <div className="p-4 text-center">Loading...</div>
      ) : filtered!.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-xl border-dashed">
          {search.trim() ? 'No bulls match your search.' : 'No semen inventory recorded.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered!.map(({ bull, inventory, locations, isLow }) => (
            <div
              key={bull.id}
              className="cursor-pointer active-elevate hover-elevate"
              onClick={() => navigate(`/semen/${bull.id}`)}
            >
              <Card className={`shadow-sm ${isLow ? 'border-amber-500' : ''}`}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-lg truncate">{bull.name}</p>
                    {locations.length > 0 ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <p className="text-sm text-muted-foreground truncate">{locations.join(' · ')}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground truncate">{bull.studCompany || bull.breed || '—'}</p>
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
