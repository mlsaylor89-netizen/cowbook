import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { getPregCheckList, getFreshCowList, getBreedingAttentionList, getDryOffList, getUpcomingCalvings, getTreatmentFollowUp } from '@/db/computed';
import { format } from 'date-fns';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';
import { Link } from 'wouter';

export function PrintReport() {
  const data = useLiveQuery(async () => {
    const animals = await db.animals.toArray();
    const breedings = await db.breedings.toArray();
    const pregChecks = await db.pregnancyChecks.toArray();
    const treatments = await db.treatments.toArray();
    const settings = await db.settings.get('default');
    if (!settings) return null;

    return {
      settings,
      pregCheck: getPregCheckList(animals, breedings, pregChecks, settings),
      fresh: getFreshCowList(animals, settings),
      breedingAttention: getBreedingAttentionList(animals, breedings, settings),
      dryOff: getDryOffList(animals, settings),
      calvings: getUpcomingCalvings(animals),
      treatments: getTreatmentFollowUp(treatments, animals)
    };
  });

  useEffect(() => {
    if (data) {
      // Auto-print after a short delay to allow render
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [data]);

  if (!data) return <div className="p-4">Generating report...</div>;

  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <div className="bg-white text-black min-h-screen p-4 sm:p-8 max-w-4xl mx-auto font-sans">
      <div className="print-hidden mb-6 flex justify-between items-center">
        <Link href="/more">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
        </Link>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print</Button>
      </div>

      <div className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-3xl font-bold uppercase tracking-tight">{data.settings.farmName || 'Dairy Herd'} - Daily Worksheet</h1>
        <p className="text-lg mt-1 font-mono">{today}</p>
      </div>

      <div className="space-y-8">
        <PrintSection title="Pregnancy Check" count={data.pregCheck.length}>
          {data.pregCheck.map((item: any) => (
            <div key={item.animal.id} className="grid grid-cols-4 border-b border-gray-200 py-2 items-center">
              <div className="font-bold text-lg">{item.animal.number}</div>
              <div>{item.daysSinceBreeding} days bred</div>
              <div className="col-span-2 flex gap-4 text-sm font-mono items-center justify-end">
                <span>[ ] PREG</span>
                <span>[ ] OPEN</span>
                <span>[ ] RECHECK</span>
              </div>
            </div>
          ))}
        </PrintSection>

        <PrintSection title="Fresh Cow Check (0-10 DIM)" count={data.fresh.length}>
          {data.fresh.map((item: any) => (
            <div key={item.animal.id} className="grid grid-cols-4 border-b border-gray-200 py-2 items-center">
              <div className="font-bold text-lg">{item.animal.number}</div>
              <div>{item.dim} DIM</div>
              <div className="col-span-2 flex gap-4 text-sm font-mono items-center justify-end">
                <span>[ ] NORMAL</span>
                <span>[ ] TREAT</span>
              </div>
            </div>
          ))}
        </PrintSection>

        <PrintSection title="Breeding Attention (Open/Past VWP)" count={data.breedingAttention.length}>
          {data.breedingAttention.map((item: any) => (
            <div key={item.animal.id} className="grid grid-cols-4 border-b border-gray-200 py-2 items-center">
              <div className="font-bold text-lg">{item.animal.number}</div>
              <div>{item.dim} DIM</div>
              <div className="col-span-2 text-right">
                {item.servicesThisLactation} services
              </div>
            </div>
          ))}
        </PrintSection>

        <PrintSection title="Dry-Off Approaching" count={data.dryOff.length}>
          {data.dryOff.map((item: any) => (
            <div key={item.animal.id} className="grid grid-cols-4 border-b border-gray-200 py-2 items-center">
              <div className="font-bold text-lg">{item.animal.number}</div>
              <div>{item.daysUntilDryOff} days left</div>
              <div className="col-span-2 flex gap-4 text-sm font-mono items-center justify-end">
                <span>[ ] DRIED OFF</span>
              </div>
            </div>
          ))}
        </PrintSection>

        <PrintSection title="Active Treatments & Withholds" count={data.treatments.active.length}>
          {[...data.treatments.withholding, ...data.treatments.active.filter((a: any) => !data.treatments.withholding.some((w: any) => w.treatment.id === a.treatment.id))].map((item: any) => (
            <div key={item.treatment.id} className="grid grid-cols-4 border-b border-gray-200 py-2 items-center">
              <div className="font-bold text-lg">{item.animal?.number}</div>
              <div className="col-span-2">
                {item.treatment.condition} ({item.treatment.product})
              </div>
              <div className="text-right font-bold text-sm">
                {item.treatment.milkWithholdUntil && new Date(item.treatment.milkWithholdUntil) > new Date() ? 'WITHHOLD' : ''}
              </div>
            </div>
          ))}
        </PrintSection>
      </div>
    </div>
  );
}

function PrintSection({ title, count, children }: { title: string, count: number, children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section>
      <h2 className="text-xl font-bold bg-gray-100 py-1 px-2 mb-2 flex justify-between">
        <span>{title}</span>
        <span>{count}</span>
      </h2>
      <div className="px-2">
        {children}
      </div>
    </section>
  );
}
