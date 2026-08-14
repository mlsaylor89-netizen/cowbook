import { Link } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { getHerdSummary, getPregCheckList, getFreshCowList, getBreedingAttentionList, getDryOffList, getUpcomingCalvings, getTreatmentFollowUp } from '@/db/computed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Stethoscope, Baby, HeartPulse, Droplet, CheckSquare, Activity } from 'lucide-react';
import { seedDemoData } from '@/db/seed';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function Home() {
  const [demoLoaded, setDemoLoaded] = useState(false);

  useEffect(() => {
    seedDemoData().then(() => {
      if (localStorage.getItem('demoLoaded') !== 'true') {
        localStorage.setItem('demoLoaded', 'true');
        setDemoLoaded(true);
      }
    });
  }, []);

  const data = useLiveQuery(async () => {
    const animals = await db.animals.toArray();
    const breedings = await db.breedings.toArray();
    const pregChecks = await db.pregnancyChecks.toArray();
    const treatments = await db.treatments.toArray();
    const settings = await db.settings.get('default');

    if (!settings) return null;

    return {
      summary: getHerdSummary(animals, settings),
      pregCheck: getPregCheckList(animals, breedings, pregChecks, settings),
      fresh: getFreshCowList(animals, settings),
      breedingAttention: getBreedingAttentionList(animals, breedings, settings),
      dryOff: getDryOffList(animals, settings),
      calvings: getUpcomingCalvings(animals),
      treatments: getTreatmentFollowUp(treatments, animals)
    };
  });

  if (!data) {
    return <div className="p-4 text-center text-muted-foreground">Loading herd data...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {demoLoaded && (
        <div className="bg-accent/20 text-accent-foreground px-4 py-3 rounded-md flex justify-between items-center border border-accent/30">
          <p className="text-sm font-medium">Demo data loaded. You can clear it in Settings.</p>
          <Button variant="ghost" size="icon" onClick={() => setDemoLoaded(false)} className="h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard title="Milking" value={data.summary.milking} />
        <SummaryCard title="Dry" value={data.summary.dry} />
        <SummaryCard title="Pregnant" value={data.summary.pregnant} />
        <SummaryCard title="Open" value={data.summary.open} />
        <SummaryCard title="Total Head" value={data.summary.total} />
        <SummaryCard title="Avg DIM" value={data.summary.avgDIM} />
        <SummaryCard title="Due <30d" value={data.summary.due30Days} />
        <SummaryCard title="Heifers" value={data.summary.heifers} />
      </div>

      <div className="pt-2">
        <h2 className="text-lg font-bold mb-4 px-1 text-foreground">Today's Checklist</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ChecklistCard 
            title="Pregnancy Check" 
            count={data.pregCheck.length} 
            icon={<Stethoscope className="h-5 w-5 text-amber-600" />} 
            href="/checklist/preg-check" 
          />
          <ChecklistCard 
            title="Fresh Cow Check" 
            count={data.fresh.length} 
            icon={<Activity className="h-5 w-5 text-blue-600" />} 
            href="/checklist/fresh-cow" 
          />
          <ChecklistCard 
            title="Breeding Attention" 
            count={data.breedingAttention.length} 
            icon={<HeartPulse className="h-5 w-5 text-destructive" />} 
            href="/checklist/breeding" 
          />
          <ChecklistCard 
            title="Dry-Off Approaching" 
            count={data.dryOff.length} 
            icon={<Droplet className="h-5 w-5 text-gray-500" />} 
            href="/checklist/dry-off" 
          />
          <ChecklistCard 
            title="Upcoming Calvings" 
            count={data.calvings.due7Days.length + data.calvings.due30Days.length} 
            icon={<Baby className="h-5 w-5 text-green-600" />} 
            href="/checklist/calvings" 
          />
          <ChecklistCard 
            title="Treatment Follow-Up" 
            count={data.treatments.active.length} 
            subtitle={data.treatments.withholding.length > 0 ? `${data.treatments.withholding.length} withholding` : undefined}
            icon={<CheckSquare className="h-5 w-5 text-purple-600" />} 
            href="/checklist/treatments" 
            alert={data.treatments.withholding.length > 0}
          />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card className="shadow-xs border-border/50">
      <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
        <p className="text-2xl font-bold text-primary">{value}</p>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-1">{title}</p>
      </CardContent>
    </Card>
  );
}

function ChecklistCard({ title, count, icon, href, subtitle, alert }: { title: string; count: number; icon: React.ReactNode; href: string; subtitle?: string; alert?: boolean }) {
  return (
    <Link href={href} className="block active-elevate hover-elevate">
      <Card className={`shadow-sm ${alert ? 'border-destructive/50 bg-destructive/5' : ''}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-secondary/50 rounded-full">
              {icon}
            </div>
            <div>
              <p className="font-semibold text-foreground">{title}</p>
              {subtitle ? (
                <p className="text-sm font-medium text-destructive">{subtitle}</p>
              ) : (
                <p className="text-sm text-muted-foreground">{count} {count === 1 ? 'animal' : 'animals'}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {count > 0 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {count}
              </span>
            )}
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
