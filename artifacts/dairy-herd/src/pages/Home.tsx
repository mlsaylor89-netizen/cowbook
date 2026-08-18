import { Link } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO, isToday, isBefore } from 'date-fns';
import { db } from '@/db';
import { getHerdSummary, getPregCheckList, getFreshCowList, getBreedingAttentionList, getDryOffList, getUpcomingCalvings, getTreatmentFollowUp, getWatchForHeatList, getScheduledProtocolsDue } from '@/db/computed';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Stethoscope, Baby, HeartPulse, Droplet, CheckSquare, Activity, Pill, Thermometer, CalendarDays, ClipboardList, FlaskConical } from 'lucide-react';
import { HeatAlerts } from '@/pages/HeatAlerts';
import { SyncEventWidget } from '@/pages/SyncEventWidget';
import { seedDemoData } from '@/db/seed';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, AlertTriangle } from 'lucide-react';

export function Home() {
  const [demoLoaded, setDemoLoaded] = useState(false);

  useEffect(() => {
    // Only run seed if it hasn't already been marked done — avoids an async
    // DB round-trip on every mount for established users.
    if (localStorage.getItem('demoLoaded') !== 'true') {
      seedDemoData().then(() => {
        localStorage.setItem('demoLoaded', 'true');
        setDemoLoaded(true);
      });
    }
  }, []);

  const data = useLiveQuery(async () => {
    const [animals, breedings, pregChecks, treatments, settings, drugs, heats, protocols] = await Promise.all([
      db.animals.toArray(),
      db.breedings.toArray(),
      db.pregnancyChecks.toArray(),
      db.treatments.toArray(),
      db.settings.get('default'),
      db.drugProducts.toArray(),
      db.heats.toArray(),
      db.protocols.toArray(),
    ]);

    if (!settings) return null;

    // Drugs at or below 25% of their bottle size
    const lowDrugs = drugs.filter(d => {
      if (d.bottleSize && d.bottleSize > 0) {
        return d.quantityOnHand <= d.bottleSize * 0.25;
      }
      // Fall back to low-stock threshold if no bottle size set
      return d.quantityOnHand <= (d.lowStockThreshold ?? 1);
    });

    const today = new Date().toISOString().slice(0, 10);
    const syncPending = await db.syncEvents.where('status').equals('pending').toArray();
    const syncDueCount = syncPending.filter(e => e.scheduledDate <= today).length;
    const syncAnimalCount = new Set(syncPending.map(e => e.animalId)).size;
    const sortedDates = syncPending.map(e => e.scheduledDate).sort();
    const syncNextDate = sortedDates.length > 0 ? sortedDates[0] : null;

    return {
      summary: getHerdSummary(animals, settings),
      lastTestDayDate: settings.lastTestDayDate ?? null,
      pregCheck: getPregCheckList(animals, breedings, pregChecks, settings),
      fresh: getFreshCowList(animals, settings),
      breedingAttention: getBreedingAttentionList(animals, breedings, settings),
      dryOff: getDryOffList(animals, settings),
      calvings: getUpcomingCalvings(animals),
      treatments: getTreatmentFollowUp(treatments, animals),
      watchHeat: getWatchForHeatList(animals, breedings, heats),
      lowDrugs,
      syncDueCount,
      syncAnimalCount,
      syncNextDate,
      scheduledProtocols: getScheduledProtocolsDue(animals, protocols),
    };
  });

  // undefined = query still running; null = settings row missing (new farm)
  if (data === undefined) {
    return <div className="p-4 text-center text-muted-foreground">Loading herd data…</div>;
  }
  if (data === null) {
    return <div className="p-4 text-center text-muted-foreground">Finishing setup — this only takes a moment…</div>;
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

      {/* Sync Protocol Events */}
      <SyncEventWidget />

      {/* Heat Alarms */}
      <HeatAlerts />

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

      {/* Pharmacy Low Stock Widget */}
      {data.lowDrugs.length > 0 && (
        <div>
          <Link href="/pharmacy">
            <Card className="border-amber-400 bg-amber-50 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-200 rounded-lg">
                      <Pill className="h-4 w-4 text-amber-700" />
                    </div>
                    <p className="font-bold text-amber-900">Pharmacy — Low Stock</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-amber-600" />
                </div>
                <div className="space-y-2">
                  {data.lowDrugs.map(drug => {
                    const pct = drug.bottleSize && drug.bottleSize > 0
                      ? Math.max(0, Math.round((drug.quantityOnHand / drug.bottleSize) * 100))
                      : null;
                    const isEmpty = drug.quantityOnHand <= 0;
                    return (
                      <div key={drug.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${isEmpty ? 'text-destructive' : 'text-amber-600'}`} />
                          <span className="text-sm font-semibold text-amber-900 truncate">{drug.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {pct !== null && (
                            <div className="w-20 h-2 rounded-full bg-amber-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isEmpty ? 'bg-destructive' : 'bg-amber-500'}`}
                                style={{ width: `${Math.max(2, pct)}%` }}
                              />
                            </div>
                          )}
                          <span className={`text-xs font-bold tabular-nums ${isEmpty ? 'text-destructive' : 'text-amber-700'}`}>
                            {drug.quantityOnHand} {drug.unit}
                            {pct !== null ? ` (${pct}%)` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* Scheduled Protocols widget */}
      {data.scheduledProtocols.length > 0 && (
        <Card className="shadow-sm border-teal-200 bg-teal-50/60 dark:bg-teal-950/20 dark:border-teal-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-teal-100 dark:bg-teal-900 rounded-lg">
                <ClipboardList className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              </div>
              <p className="font-bold text-teal-900 dark:text-teal-100">Scheduled Protocols</p>
              <span className="ml-auto text-xs font-bold text-teal-700 dark:text-teal-300">
                {data.scheduledProtocols.length} due
              </span>
            </div>
            <div className="space-y-1">
              {data.scheduledProtocols.slice(0, 6).map((alert, i) => (
                <Link
                  key={`${alert.protocol.id}-${alert.animal.id}-${i}`}
                  href={`/protocol-checklist?protocolId=${alert.protocol.id}&animalId=${alert.animal.id}&returnTo=/`}
                  className="flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight truncate">
                      {alert.animal.barnName || alert.animal.name}
                      <span className="font-normal text-muted-foreground ml-1">#{alert.animal.number}</span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{alert.protocol.name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {alert.daysUntil < 0 ? (
                      <span className="text-xs font-bold text-destructive">{Math.abs(alert.daysUntil)}d overdue</span>
                    ) : alert.daysUntil === 0 ? (
                      <span className="text-xs font-bold text-emerald-600">Today</span>
                    ) : (
                      <span className="text-xs font-bold text-teal-700 dark:text-teal-300">in {alert.daysUntil}d</span>
                    )}
                  </div>
                </Link>
              ))}
              {data.scheduledProtocols.length > 6 && (
                <p className="text-xs text-teal-600 dark:text-teal-400 text-center pt-1 font-medium">
                  +{data.scheduledProtocols.length - 6} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
          <ChecklistCard
            title="Watch for Heat"
            count={data.watchHeat.length}
            subtitle={data.watchHeat.length > 0 ? `${data.watchHeat.filter(w => w.source === 'heat').length ? 'Heat-timed · ' : ''}Days 20–22 post-breeding` : undefined}
            icon={<Thermometer className="h-5 w-5 text-rose-500" />}
            href="/checklist/watch-heat"
            alert={data.watchHeat.length > 0}
          />
          <ChecklistCard
            title="Sync Set Ups"
            count={data.syncDueCount}
            subtitle={`${data.syncAnimalCount} ${data.syncAnimalCount === 1 ? 'animal' : 'animals'} on program`}
            detail={
              data.syncNextDate
                ? isToday(parseISO(data.syncNextDate))
                  ? 'Next shot: today'
                  : isBefore(parseISO(data.syncNextDate), new Date())
                  ? `Overdue since ${format(parseISO(data.syncNextDate), 'MMM d')}`
                  : `Next shot: ${format(parseISO(data.syncNextDate), 'MMM d')}`
                : undefined
            }
            icon={<CalendarDays className="h-5 w-5 text-primary" />}
            href="/sync-protocol"
            alert={data.syncDueCount > 0}
          />
          <ChecklistCard
            title="Test Day"
            count={0}
            subtitle={data.lastTestDayDate
              ? `Last: ${format(parseISO(data.lastTestDayDate), 'MMM d, yyyy')}`
              : 'Tap to set up'}
            icon={<FlaskConical className="h-5 w-5 text-teal-600" />}
            href="/test-day"
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

function ChecklistCard({ title, count, icon, href, subtitle, detail, alert }: {
  title: string; count: number; icon: React.ReactNode; href: string; subtitle?: string; detail?: string; alert?: boolean;
}) {
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
                <p className={`text-sm font-medium ${alert ? 'text-destructive' : 'text-muted-foreground'}`}>{subtitle}</p>
              ) : (
                <p className="text-sm text-muted-foreground">{count} {count === 1 ? 'animal' : 'animals'}</p>
              )}
              {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
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
