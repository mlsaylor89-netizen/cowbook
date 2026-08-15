import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { getDIM, lactStat, reproStat } from '@/db/computed';
import { Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function HerdList() {
  const [search, setSearch] = useState('');
  
  const animals = useLiveQuery(async () => {
    let collection = db.animals.toCollection();
    let all = await collection.sortBy('number');
    
    if (search.trim()) {
      const s = search.toLowerCase();
      all = all.filter(a =>
        a.number.toLowerCase().includes(s) ||
        a.name.toLowerCase().includes(s) ||
        (a.barnName && a.barnName.toLowerCase().includes(s)) ||
        (a.rfidTag && a.rfidTag.toLowerCase().includes(s))
      );
    }
    return all;
  }, [search]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Herd</h2>
        <Link href="/herd/new">
          <Button size="sm" className="hidden sm:flex">
            <Plus className="h-4 w-4 mr-2" /> Add Animal
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Search number, name, or RFID..." 
          className="pl-10 h-12 text-lg bg-card"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {animals === undefined ? (
        <div className="p-4 text-center text-muted-foreground">Loading...</div>
      ) : animals.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-xl border-dashed">
          No animals found.
        </div>
      ) : (
        <div className="space-y-2 pb-16">
          {animals.map(animal => (
            <Link key={animal.id} href={`/herd/${animal.id}`} className="block active-elevate hover-elevate">
              <Card className="shadow-sm">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-lg shrink-0">
                      {animal.number}
                    </div>
                    <div>
                      <p className="font-bold text-base leading-tight">
                        {animal.barnName || animal.name}
                      </p>
                      {animal.barnName && animal.barnName !== animal.name && (
                        <p className="text-xs text-muted-foreground leading-tight">{animal.name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <LactationBadge status={lactStat(animal)} />
                        <ReproBadge status={reproStat(animal)} />
                        {lactStat(animal) !== 'Heifer' && getDIM(animal) !== null && (
                          <span className="text-xs text-muted-foreground">{getDIM(animal)} DIM</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Legacy badge — still used by AnimalDetail for old records without split fields */
export function StatusBadge({ status }: { status: string }) {
  let color = 'bg-gray-100 text-gray-800 border-gray-200';
  switch (status) {
    case 'Lactating': color = 'bg-green-100 text-green-800 border-green-200'; break;
    case 'Dry': color = 'bg-blue-100 text-blue-800 border-blue-200'; break;
    case 'Pregnant': color = 'bg-amber-100 text-amber-800 border-amber-200'; break;
    case 'Open': color = 'bg-red-100 text-red-800 border-red-200'; break;
    case 'Heifer': case 'BredHeifer': color = 'bg-purple-100 text-purple-800 border-purple-200'; break;
  }
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${color}`}>
      {status}
    </span>
  );
}

export function LactationBadge({ status }: { status: string }) {
  const color =
    status === 'Milking' ? 'bg-green-100 text-green-800 border-green-200' :
    status === 'Dry'     ? 'bg-blue-100 text-blue-800 border-blue-200' :
                           'bg-purple-100 text-purple-800 border-purple-200';
  const label = status === 'Milking' ? 'Milking' : status;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  );
}

export function ReproBadge({ status }: { status: string }) {
  const color =
    status === 'Open'     ? 'bg-red-100 text-red-800 border-red-200' :
    status === 'Bred'     ? 'bg-amber-100 text-amber-800 border-amber-200' :
    status === 'Pregnant' ? 'bg-amber-200 text-amber-900 border-amber-300' :
    status === 'Fresh'    ? 'bg-sky-100 text-sky-800 border-sky-200' :
                            'bg-gray-100 text-gray-800 border-gray-200';
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${color}`}>
      {status}
    </span>
  );
}
