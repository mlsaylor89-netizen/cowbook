import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { getPregCheckList, getFreshCowList, getBreedingAttentionList, getDryOffList, getUpcomingCalvings, getTreatmentFollowUp, processPregCheck, getWatchForHeatList, getETRecipientList } from '@/db/computed';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useRoute } from 'wouter';
import { ArrowLeft, Check, X, Calendar, AlertCircle, Thermometer, Pipette, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';

export function Checklist() {
  const [match, params] = useRoute('/checklist/:type');
  const type = params?.type;

  const data = useLiveQuery(async () => {
    const animals = await db.animals.toArray();
    const [breedings, pregChecks, treatments, heats, settings] = await Promise.all([
      db.breedings.toArray(),
      db.pregnancyChecks.toArray(),
      db.treatments.toArray(),
      db.heats.toArray(),
      db.settings.get('default'),
    ]);
    if (!settings) return null;

    return {
      settings,
      pregCheck: getPregCheckList(animals, breedings, pregChecks, settings),
      fresh: getFreshCowList(animals, settings),
      breedingAttention: getBreedingAttentionList(animals, breedings, settings),
      dryOff: getDryOffList(animals, settings),
      calvings: getUpcomingCalvings(animals),
      treatments: getTreatmentFollowUp(treatments, animals),
      watchHeat: getWatchForHeatList(animals, breedings, heats),
      etRecipients: getETRecipientList(animals, heats),
    };
  });

  if (!data) return <div className="p-4">Loading...</div>;

  let title = 'Checklist';
  let content = null;

  switch (type) {
    case 'preg-check':
      title = 'Pregnancy Check';
      content = <PregCheckList list={data.pregCheck} settings={data.settings} />;
      break;
    case 'fresh-cow':
      title = 'Fresh Cow Check';
      content = <FreshCowList list={data.fresh} />;
      break;
    case 'breeding':
      title = 'Breeding Attention';
      content = <BreedingAttentionList list={data.breedingAttention} />;
      break;
    case 'dry-off':
      title = 'Dry-Off Approaching';
      content = <DryOffList list={data.dryOff} />;
      break;
    case 'calvings':
      title = 'Upcoming Calvings';
      content = <CalvingsList list={data.calvings} />;
      break;
    case 'treatments':
      title = 'Treatment Follow-Up';
      content = <TreatmentsList data={data.treatments} />;
      break;
    case 'watch-heat':
      title = 'Watch for Heat';
      content = <WatchHeatList list={data.watchHeat} etRecipients={data.etRecipients} />;
      break;
    default:
      content = <div>Unknown checklist type.</div>;
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {content}
    </div>
  );
}

function PregCheckList({ list, settings }: { list: any[], settings: any }) {
  if (list.length === 0) return <EmptyState text="No animals due for pregnancy check." />;

  return (
    <div className="space-y-3">
      {list.map(({ animal, breeding, daysSinceBreeding }) => (
        <Card key={animal.id}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <Link href={`/herd/${animal.id}`} className="font-bold text-lg text-primary hover:underline">
                  {animal.number} {animal.name}
                </Link>
                <p className="text-sm text-muted-foreground">Bred {format(parseISO(breeding.date), 'MMM d')} ({daysSinceBreeding} days ago)</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                className="flex-1 bg-green-700 hover:bg-green-800" 
                onClick={async () => {
                  await processPregCheck({ animalId: animal.id, breedingId: breeding.id, checkDate: new Date().toISOString(), result: 'Pregnant' }, animal, settings);
                }}
              >
                Pregnant
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-white"
                onClick={async () => {
                  await processPregCheck({ animalId: animal.id, breedingId: breeding.id, checkDate: new Date().toISOString(), result: 'Open' }, animal, settings);
                }}
              >
                Open
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FreshCowList({ list }: { list: any[] }) {
  if (list.length === 0) return <EmptyState text="No fresh cows in the window." />;

  return (
    <div className="space-y-3">
      {list.map(({ animal, dim }) => (
        <Card key={animal.id}>
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <Link href={`/herd/${animal.id}`} className="font-bold text-lg text-primary hover:underline">
                {animal.number} {animal.name}
              </Link>
              <p className="text-sm text-muted-foreground">{dim} DIM • Calved {format(parseISO(animal.lastCalvingDate), 'MMM d')}</p>
            </div>
            <Link href={`/herd/${animal.id}`}>
              <Button variant="secondary" size="sm">View</Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BreedingAttentionList({ list }: { list: any[] }) {
  if (list.length === 0) return <EmptyState text="No animals need breeding attention." />;

  return (
    <div className="space-y-3">
      {list.map(({ animal, dim, lastBreedingDate, servicesThisLactation }) => (
        <Card key={animal.id}>
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <Link href={`/herd/${animal.id}`} className="font-bold text-lg text-primary hover:underline">
                {animal.number} {animal.name}
              </Link>
              <p className="text-sm font-medium">{animal.status} • {dim} DIM</p>
              <p className="text-xs text-muted-foreground">
                {servicesThisLactation} services {lastBreedingDate && `• Last: ${format(parseISO(lastBreedingDate), 'MMM d')}`}
              </p>
            </div>
            <Link href={`/breeding?animalId=${animal.id}`}>
              <Button size="sm">Breed</Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DryOffList({ list }: { list: any[] }) {
  if (list.length === 0) return <EmptyState text="No cows approaching dry-off." />;

  return (
    <div className="space-y-3">
      {list.map(({ animal, daysUntilDryOff }) => (
        <Card key={animal.id}>
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <Link href={`/herd/${animal.id}`} className="font-bold text-lg text-primary hover:underline">
                {animal.number} {animal.name}
              </Link>
              <p className="text-sm text-muted-foreground">Due: {format(parseISO(animal.expectedCalvingDate!), 'MMM d, yyyy')}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">{daysUntilDryOff < 0 ? 'Past Due' : `${daysUntilDryOff} days`}</p>
              <p className="text-xs text-muted-foreground text-right">{format(parseISO(animal.expectedDryOffDate!), 'MMM d')}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CalvingsList({ list }: { list: any }) {
  const all = [...list.due7Days, ...list.due30Days, ...list.due60Days];
  if (all.length === 0) return <EmptyState text="No upcoming calvings." />;

  return (
    <div className="space-y-6">
      {list.due7Days.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-destructive uppercase tracking-wider mb-3 px-1">Due in ≤ 7 Days</h3>
          <div className="space-y-3">
            {list.due7Days.map((item: any) => <CalvingRow key={item.animal.id} item={item} />)}
          </div>
        </div>
      )}
      {list.due30Days.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">Due in 8–30 Days</h3>
          <div className="space-y-3">
            {list.due30Days.map((item: any) => <CalvingRow key={item.animal.id} item={item} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function CalvingRow({ item }: { item: any }) {
  const { animal, daysUntilCalving } = item;
  return (
    <Card>
      <CardContent className="p-4 flex justify-between items-center">
        <div>
          <Link href={`/herd/${animal.id}`} className="font-bold text-lg text-primary hover:underline">
            {animal.number} {animal.name}
          </Link>
          <p className="text-sm text-muted-foreground">Date: {format(parseISO(animal.expectedCalvingDate!), 'MMM d, yyyy')}</p>
        </div>
        <div className="text-right">
          <p className={`font-bold text-lg ${daysUntilCalving <= 7 ? 'text-destructive' : ''}`}>
            {daysUntilCalving < 0 ? 'Past Due' : `${daysUntilCalving} days`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function TreatmentsList({ data }: { data: any }) {
  const all = [...data.withholding, ...data.active.filter((a: any) => !data.withholding.some((w: any) => w.treatment.id === a.treatment.id))];
  
  if (all.length === 0) return <EmptyState text="No active treatments." />;

  return (
    <div className="space-y-3">
      {all.map(({ animal, treatment }: any) => {
        const isWithholding = treatment.milkWithholdUntil && new Date(treatment.milkWithholdUntil) > new Date();
        
        return (
          <Card key={treatment.id} className={isWithholding ? 'border-destructive' : ''}>
            {isWithholding && (
              <div className="bg-destructive text-white text-xs font-bold uppercase tracking-wider text-center py-1">
                Milk Withhold - Do Not Ship
              </div>
            )}
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <Link href={`/herd/${animal?.id}`} className="font-bold text-lg text-primary hover:underline">
                  {animal?.number} {animal?.name}
                </Link>
                <Button variant="outline" size="sm" onClick={() => {
                  db.treatments.update(treatment.id, { resolved: true, updatedAt: new Date().toISOString() });
                }}>
                  Resolve
                </Button>
              </div>
              <p className="font-medium text-sm">{treatment.condition} — {treatment.product}</p>
              {isWithholding && (
                <p className="text-xs text-destructive mt-1 font-bold">
                  Withhold until {format(parseISO(treatment.milkWithholdUntil), 'MMM d, yyyy h:mm a')}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function WatchHeatList({
  list,
  etRecipients,
}: {
  list: ReturnType<typeof getWatchForHeatList>;
  etRecipients: ReturnType<typeof getETRecipientList>;
}) {
  if (list.length === 0 && etRecipients.length === 0) {
    return <EmptyState text="No cows in the watch window or pending ET transfers right now." />;
  }

  return (
    <div className="space-y-4">
      {/* ── ET Recipients ── */}
      {etRecipients.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider px-1 text-violet-700 dark:text-violet-300">
            Pending ET Transfers ({etRecipients.length})
          </p>
          {etRecipients.map(({ animal, heat, etScheduledAt, hoursUntilET, isOverdue }) => (
            <Card key={heat.id} className="border-violet-300 dark:border-violet-700">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Pipette className="h-4 w-4 text-violet-500 shrink-0" />
                    <Link href={`/herd/${animal.id}`} className="font-bold text-base hover:underline truncate">
                      {animal.number} {animal.barnName || animal.name}
                    </Link>
                  </div>
                  <p className="text-sm mt-0.5 ml-6">
                    <span className={`font-semibold ${isOverdue ? 'text-destructive' : 'text-violet-700 dark:text-violet-300'}`}>
                      {isOverdue
                        ? `Overdue ${Math.abs(hoursUntilET)}h ago`
                        : `Transfer in ${hoursUntilET}h`}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      {format(parseISO(etScheduledAt), 'EEE, MMM d @ h:mm a')}
                    </span>
                  </p>
                </div>
                <Link href={`/heat?animalId=${animal.id}`} className="shrink-0">
                  <Button size="sm" variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50">
                    Record Heat
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Watch for Return to Heat ── */}
      {list.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider px-1 text-rose-600 dark:text-rose-400">
            Watch for Heat ({list.length})
          </p>
          <p className="text-sm text-muted-foreground px-1">
            Watch closely and record a heat if observed.
          </p>
          {list.map(item => (
            <Card key={item.animal.id} className="border-rose-300 dark:border-rose-800">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {item.source === 'heat'
                      ? <Eye className="h-4 w-4 text-amber-500 shrink-0" />
                      : <Thermometer className="h-4 w-4 text-rose-500 shrink-0" />}
                    <Link href={`/herd/${item.animal.id}`} className="font-bold text-base hover:underline truncate">
                      {item.animal.number} {item.animal.barnName || item.animal.name}
                    </Link>
                  </div>
                  {item.source === 'heat' && item.nextHeatExpectedAt ? (
                    <p className="text-sm text-muted-foreground mt-0.5 ml-6">
                      Next heat expected{' '}
                      <span className={`font-semibold ${item.daysUntilNextHeat! < 0 ? 'text-destructive' : 'text-rose-600'}`}>
                        {item.daysUntilNextHeat === 0
                          ? 'today'
                          : item.daysUntilNextHeat! < 0
                            ? `${Math.abs(item.daysUntilNextHeat!)}d overdue`
                            : `in ${item.daysUntilNextHeat}d`}
                      </span>
                      {' · '}{format(parseISO(item.nextHeatExpectedAt), 'EEE, MMM d @ h:mm a')}
                    </p>
                  ) : item.source === 'breeding' && item.breeding ? (
                    <p className="text-sm text-muted-foreground mt-0.5 ml-6">
                      Bred {format(parseISO(item.breeding.date), 'MMM d')} ·{' '}
                      <span className="font-semibold text-rose-600">Day {item.daysSinceBreeding} post-breeding</span>
                    </p>
                  ) : null}
                </div>
                <Link href={`/heat?animalId=${item.animal.id}`} className="shrink-0">
                  <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50">
                    Record Heat
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-card/50">
      <Check className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-3" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}
