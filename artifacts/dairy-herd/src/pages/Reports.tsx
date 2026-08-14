import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { getDIM } from '@/db/computed';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

export function Reports() {
  const data = useLiveQuery(async () => {
    const animals = await db.animals.toArray();
    const breedings = await db.breedings.toArray();
    const pregChecks = await db.pregnancyChecks.toArray();

    const lactating = animals.filter(a => a.status === 'Lactating' || a.status === 'Pregnant' || a.status === 'Open');
    const dims = lactating.map(a => getDIM(a)).filter((dim): dim is number => dim !== null);
    const avgDim = dims.length > 0 ? Math.round(dims.reduce((sum, dim) => sum + dim, 0) / dims.length) : 0;

    // Days to first service (for cows with a breeding this lactation)
    const firstServices = lactating.map(a => {
      if (!a.lastCalvingDate) return null;
      const calvingDate = parseISO(a.lastCalvingDate);
      const animalBreedings = breedings.filter(b => b.animalId === a.id && new Date(b.date) > calvingDate).sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime());
      if (animalBreedings.length === 0) return null;
      return differenceInDays(parseISO(animalBreedings[0].date), calvingDate);
    }).filter((d): d is number => d !== null);

    const avgFirstService = firstServices.length > 0 ? Math.round(firstServices.reduce((sum, d) => sum + d, 0) / firstServices.length) : 0;

    return { avgDim, avgFirstService };
  });

  if (!data) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/more">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-xl font-bold">Reports & Metrics</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MetricCard title="Average DIM" value={data.avgDim} />
        <MetricCard title="Avg Days to 1st Service" value={data.avgFirstService} />
      </div>

      <div className="pt-8">
        <Link href="/print-report">
          <Button className="w-full h-14 text-lg font-bold">
            <Printer className="h-5 w-5 mr-2" /> Print Daily Worksheet
          </Button>
        </Link>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string, value: number | string }) {
  return (
    <Card>
      <CardContent className="p-6 text-center flex flex-col items-center justify-center">
        <p className="text-4xl font-bold text-primary">{value}</p>
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-2">{title}</p>
      </CardContent>
    </Card>
  );
}
