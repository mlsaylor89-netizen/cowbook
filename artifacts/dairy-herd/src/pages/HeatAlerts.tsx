/**
 * HeatAlerts — live countdown widget shown on the Home dashboard.
 * Re-registers browser notification timers on every mount so page
 * refreshes don't lose pending alarms.
 */

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'wouter';
import { db } from '@/db';
import type { HeatObservation, Animal } from '@/db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Thermometer, Clock, Check, X, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { scheduleHeatNotifications } from '@/lib/heatNotifications';

interface HeatRow {
  heat: HeatObservation;
  animal: Animal | undefined;
}

function msToLabel(ms: number): string {
  if (ms <= 0) return 'Now';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function urgency(ms: number): 'overdue' | 'imminent' | 'soon' | 'scheduled' {
  if (ms <= 0) return 'overdue';
  if (ms <= 3_600_000) return 'imminent';       // ≤ 1 h
  if (ms <= 10_800_000) return 'soon';          // ≤ 3 h
  return 'scheduled';
}

const URGENCY_STYLES = {
  overdue:   'border-destructive bg-destructive/10 animate-pulse',
  imminent:  'border-orange-400 bg-orange-50 dark:bg-orange-950/30',
  soon:      'border-amber-400 bg-amber-50 dark:bg-amber-950/30',
  scheduled: 'border-primary/30 bg-primary/5',
};

const LABEL_STYLES = {
  overdue:   'text-destructive font-bold',
  imminent:  'text-orange-600 font-bold',
  soon:      'text-amber-700 font-semibold',
  scheduled: 'text-primary',
};

function animalDisplay(a: Animal | undefined) {
  if (!a) return '—';
  return `${a.number} ${a.barnName || a.name}`;
}

export function HeatAlerts() {
  const [now, setNow] = useState(Date.now());

  // Refresh countdown every 30 s
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const rows = useLiveQuery<HeatRow[]>(async () => {
    const heats = await db.heats
      .where('status')
      .equals('pending')
      .toArray();

    heats.sort((a, b) =>
      new Date(a.scheduledBreedAt).getTime() - new Date(b.scheduledBreedAt).getTime(),
    );

    const animalIds = [...new Set(heats.map(h => h.animalId))];
    const animals = await db.animals.where('id').anyOf(animalIds).toArray();
    const animalMap = new Map(animals.map(a => [a.id, a]));

    return heats.map(heat => ({ heat, animal: animalMap.get(heat.animalId) }));
  }, []);

  // Re-register notifications whenever pending heats change
  useEffect(() => {
    if (!rows) return;
    for (const { heat, animal } of rows) {
      scheduleHeatNotifications(
        heat.id,
        heat.scheduledBreedAt,
        heat.alertAt,
        animal ? (animal.barnName || animal.name) : 'Cow',
        heat.breedingType,
      );
    }
  }, [rows]);

  if (!rows || rows.length === 0) return null;

  async function markBred(heatId: string) {
    const now = new Date().toISOString();
    await db.heats.update(heatId, { status: 'bred', updatedAt: now });
  }

  async function dismiss(heatId: string) {
    const now = new Date().toISOString();
    await db.heats.update(heatId, { status: 'missed', updatedAt: now });
  }

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-rose-500" />
          Heat Alarms
          <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {rows.length}
          </span>
        </h2>
        <Link href="/heat">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 pr-2">
            <Plus className="h-3.5 w-3.5" /> Record Heat
          </Button>
        </Link>
      </div>

      {rows.map(({ heat, animal }) => {
        const msLeft = new Date(heat.scheduledBreedAt).getTime() - now;
        const u = urgency(msLeft);

        return (
          <Card key={heat.id} className={`border-2 shadow-sm ${URGENCY_STYLES[u]}`}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                {/* Left: animal + times */}
                <div className="min-w-0">
                  <p className="font-bold text-base leading-tight truncate">
                    {animalDisplay(animal)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Observed {format(parseISO(heat.observedAt), 'EEE h:mm a')}
                    {' · '}
                    <span className="capitalize">{heat.breedingType}</span>
                    {' '}({heat.breedingType === 'sexed' ? '30h' : '12h'})
                  </p>

                  {/* Breed time + countdown */}
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm">
                      Breed by{' '}
                      <span className="font-semibold">
                        {format(parseISO(heat.scheduledBreedAt), 'EEE h:mm a')}
                      </span>
                    </span>
                  </div>

                  {/* Countdown badge */}
                  <p className={`text-sm mt-1 ${LABEL_STYLES[u]}`}>
                    {u === 'overdue'
                      ? `OVERDUE by ${msToLabel(Math.abs(msLeft))}`
                      : `${msToLabel(msLeft)} remaining`}
                  </p>
                </div>

                {/* Right: action buttons */}
                <div className="flex flex-col gap-1 shrink-0">
                  <Link href={`/breeding?animalId=${heat.animalId}`}>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1 w-full"
                      onClick={() => markBred(heat.id)}
                    >
                      <Check className="h-3.5 w-3.5" /> Bred
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => dismiss(heat.id)}
                  >
                    <X className="h-3.5 w-3.5" /> Dismiss
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
