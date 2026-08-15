/**
 * SyncEventWidget — home dashboard card.
 * Shows sync protocol events that are overdue or due today.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'wouter';
import { db } from '@/db';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Check, SkipForward, ChevronRight } from 'lucide-react';
import { EVENT_META } from '@/lib/syncProtocolDefs';

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function SyncEventWidget() {
  const today = todayStr();

  const data = useLiveQuery(async () => {
    // Only overdue + today
    const allPending = await db.syncEvents
      .where('status').equals('pending')
      .toArray();

    const relevant = allPending
      .filter(e => e.scheduledDate <= today)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

    if (relevant.length === 0) return null;

    const animalIds = [...new Set(relevant.map(e => e.animalId))];
    const animals   = await db.animals.where('id').anyOf(animalIds).toArray();
    const animalMap = new Map(animals.map(a => [a.id, a]));

    return { events: relevant, animalMap };
  });

  if (!data) return null;
  const { events, animalMap } = data;

  const overdue  = events.filter(e => e.scheduledDate < today);
  const dueToday = events.filter(e => e.scheduledDate === today);

  async function markDone(id: string) {
    await db.syncEvents.update(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async function markSkip(id: string) {
    await db.syncEvents.update(id, {
      status: 'skipped',
      updatedAt: new Date().toISOString(),
    });
  }

  function EventRow({ event }: { event: typeof events[0] }) {
    const animal  = animalMap.get(event.animalId);
    const meta    = EVENT_META[event.eventType];
    const isAI    = event.eventType === 'timed-ai';
    const isPast  = event.scheduledDate < today;

    return (
      <div className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${meta.bgColor} ${meta.color}`}>
            {meta.shortLabel}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">
              {animal ? `${animal.number} ${animal.barnName || animal.name}` : '—'}
            </p>
            {isPast && (
              <p className="text-xs text-destructive font-semibold">
                Due {format(parseISO(event.scheduledDate), 'MMM d')}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {isAI ? (
            <Link href={`/breeding?animalId=${event.animalId}`}>
              <Button size="sm" className="h-7 text-xs" onClick={() => markDone(event.id)}>
                <Check className="h-3 w-3 mr-1" /> Breed
              </Button>
            </Link>
          ) : (
            <Button size="sm" className="h-7 text-xs" onClick={() => markDone(event.id)}>
              <Check className="h-3 w-3 mr-1" /> Done
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-muted-foreground"
            onClick={() => markSkip(event.id)}
          >
            <SkipForward className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-bold flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Sync Protocol
          <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
            {events.length}
          </span>
        </h2>
        <Link href="/sync-protocol">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 pr-2">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {overdue.length > 0 && (
        <Card className="border-2 border-destructive/40 shadow-sm">
          <CardContent className="px-3 py-2">
            <p className="text-xs font-bold text-destructive uppercase tracking-wider mb-1">Overdue</p>
            {overdue.map(e => <EventRow key={e.id} event={e} />)}
          </CardContent>
        </Card>
      )}

      {dueToday.length > 0 && (
        <Card className="border-2 border-amber-400 shadow-sm">
          <CardContent className="px-3 py-2">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Today</p>
            {dueToday.map(e => <EventRow key={e.id} event={e} />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
