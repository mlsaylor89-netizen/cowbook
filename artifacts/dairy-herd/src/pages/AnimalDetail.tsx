import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { getDIM } from '@/db/computed';
import { Link, useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Activity, Heart, Droplet, Baby } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { StatusBadge } from './HerdList';

export function AnimalDetail() {
  const [match, params] = useRoute('/herd/:id');
  const id = params?.id;

  const data = useLiveQuery(async () => {
    if (!id) return null;
    const animal = await db.animals.get(id);
    if (!animal) return null;

    const breedings = await db.breedings.where('animalId').equals(id).reverse().sortBy('date');
    const calvings = await db.calvings.where('animalId').equals(id).reverse().sortBy('calvingDate');
    const treatments = await db.treatments.where('animalId').equals(id).reverse().sortBy('date');
    const pregChecks = await db.pregnancyChecks.where('animalId').equals(id).reverse().sortBy('checkDate');

    return { animal, breedings, calvings, treatments, pregChecks };
  }, [id]);

  if (data === undefined) return <div className="p-4">Loading...</div>;
  if (data === null) return <div className="p-4">Animal not found.</div>;

  const { animal, breedings, calvings, treatments, pregChecks } = data;
  const dim = getDIM(animal);

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/herd">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h2 className="text-2xl font-bold">{animal.number} {animal.name}</h2>
        </div>
        <Link href={`/herd/${animal.id}/edit`}>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Link href={`/breeding?animalId=${animal.id}`} className="block">
          <Button variant="outline" className="w-full h-14 bg-card hover:bg-accent/10 border-border">
            <Heart className="h-4 w-4 mr-2 text-destructive" /> Breed
          </Button>
        </Link>
        <Button variant="outline" className="w-full h-14 bg-card hover:bg-accent/10 border-border" disabled>
          <Baby className="h-4 w-4 mr-2 text-primary" /> Calve
        </Button>
        <Button variant="outline" className="w-full h-14 bg-card hover:bg-accent/10 border-border" disabled>
          <Activity className="h-4 w-4 mr-2 text-blue-600" /> Preg Check
        </Button>
        <Button variant="outline" className="w-full h-14 bg-card hover:bg-accent/10 border-border" disabled>
          <Droplet className="h-4 w-4 mr-2 text-purple-600" /> Treat
        </Button>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 gap-y-4 gap-x-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Status</p>
            <div className="mt-1"><StatusBadge status={animal.status} /></div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">DIM</p>
            <p className="font-bold">{dim !== null ? dim : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Lactation</p>
            <p className="font-bold">{animal.lactationNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Breed</p>
            <p className="font-bold">{animal.breed}</p>
          </div>
          {animal.expectedCalvingDate && (
            <div className="col-span-2 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-900">
              <p className="text-xs text-amber-800 dark:text-amber-500 uppercase font-bold">Due Date</p>
              <p className="font-bold text-amber-900 dark:text-amber-400">{format(parseISO(animal.expectedCalvingDate), 'MMM d, yyyy')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">History</h3>
        
        {treatments.filter(t => t.milkWithholdUntil && new Date(t.milkWithholdUntil) > new Date()).length > 0 && (
          <div className="bg-destructive text-destructive-foreground p-3 rounded-md font-bold uppercase tracking-wider text-sm flex items-center justify-center">
            Milk Withhold - Do Not Ship
          </div>
        )}

        <div className="space-y-3">
          {breedings.map(b => (
            <Card key={b.id}>
              <CardContent className="p-3 flex items-start gap-3">
                <Heart className="h-5 w-5 mt-0.5 text-destructive shrink-0" />
                <div>
                  <p className="font-bold">{b.breedingType} Breeding</p>
                  <p className="text-sm text-muted-foreground">{format(parseISO(b.date), 'MMM d, yyyy')} • Bull: {b.bullId || 'Unknown'}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {calvings.map(c => (
            <Card key={c.id}>
              <CardContent className="p-3 flex items-start gap-3">
                <Baby className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="font-bold">Calved ({c.calfSex})</p>
                  <p className="text-sm text-muted-foreground">{format(parseISO(c.calvingDate), 'MMM d, yyyy')}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {breedings.length === 0 && calvings.length === 0 && pregChecks.length === 0 && (
            <p className="text-muted-foreground text-center py-4 text-sm">No history records.</p>
          )}
        </div>
      </div>
    </div>
  );
}
