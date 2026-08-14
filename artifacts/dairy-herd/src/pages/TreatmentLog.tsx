import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';

export function TreatmentLog() {
  const data = useLiveQuery(async () => {
    const treatments = await db.treatments.orderBy('date').reverse().toArray();
    const animals = await db.animals.toArray();
    const animalMap = Object.fromEntries(animals.map(a => [a.id, a]));
    return treatments.map(t => ({ treatment: t, animal: animalMap[t.animalId] }));
  });

  const now = new Date();

  const withholding = data?.filter(
    ({ treatment: t }) => t.milkWithholdUntil && isAfter(parseISO(t.milkWithholdUntil), now),
  ) ?? [];

  const active = data?.filter(
    ({ treatment: t }) => !t.resolved,
  ) ?? [];

  const resolved = data?.filter(
    ({ treatment: t }) => t.resolved,
  ) ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Link href="/more">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h2 className="text-xl font-bold">Treatment Log</h2>
        </div>
        <Link href="/treatment">
          <Button size="sm">+ Record</Button>
        </Link>
      </div>

      {/* Milk withhold banner */}
      {withholding.length > 0 && (
        <div className="space-y-2">
          {withholding.map(({ treatment: t, animal }) => (
            <div
              key={t.id}
              className="flex items-center gap-3 bg-destructive text-destructive-foreground px-4 py-3 rounded-lg font-bold"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <span className="uppercase tracking-wide">Milk Withhold — Do Not Ship</span>
                <span className="font-normal ml-2">
                  {animal?.number} {animal?.name} — until{' '}
                  {format(parseISO(t.milkWithholdUntil!), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active treatments */}
      <Section title="Active Treatments" count={active.length}>
        {active.length === 0 ? (
          <Empty text="No active treatments." />
        ) : (
          active.map(({ treatment: t, animal }) => (
            <TreatmentRow key={t.id} treatment={t} animal={animal} now={now} />
          ))
        )}
      </Section>

      {/* Resolved treatments */}
      {resolved.length > 0 && (
        <Section title="Resolved" count={resolved.length} muted>
          {resolved.map(({ treatment: t, animal }) => (
            <TreatmentRow key={t.id} treatment={t} animal={animal} now={now} resolved />
          ))}
        </Section>
      )}

      {data?.length === 0 && (
        <Empty text="No treatments recorded yet." />
      )}
    </div>
  );
}

function Section({
  title,
  count,
  muted,
  children,
}: {
  title: string;
  count: number;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3
        className={`text-sm font-bold uppercase tracking-wider px-1 ${
          muted ? 'text-muted-foreground' : 'text-foreground'
        }`}
      >
        {title}{' '}
        <span className="font-normal normal-case tracking-normal text-muted-foreground">
          ({count})
        </span>
      </h3>
      {children}
    </div>
  );
}

function TreatmentRow({
  treatment: t,
  animal,
  now,
  resolved,
}: {
  treatment: any;
  animal: any;
  now: Date;
  resolved?: boolean;
}) {
  const isWithholding = t.milkWithholdUntil && isAfter(parseISO(t.milkWithholdUntil), now);

  return (
    <Card className={isWithholding ? 'border-destructive' : ''}>
      {isWithholding && (
        <div className="bg-destructive text-destructive-foreground text-xs font-bold uppercase tracking-wider text-center py-1 rounded-t-lg">
          Milk Withhold — Do Not Ship
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/herd/${animal?.id}`}
                className="font-bold text-base text-primary hover:underline"
              >
                {animal?.number} {animal?.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(t.date), 'MMM d, yyyy')}
              </span>
            </div>
            <p className="font-medium text-sm mt-0.5">
              {t.condition} — {t.product}
              {t.dose ? ` (${t.dose})` : ''}
              {t.route ? ` · ${t.route}` : ''}
            </p>
            {isWithholding && (
              <p className="text-xs text-destructive font-semibold mt-1">
                Withhold until {format(parseISO(t.milkWithholdUntil), 'MMM d, yyyy')}
              </p>
            )}
            {t.followUpDate && !resolved && (
              <p className="text-xs text-muted-foreground mt-1">
                Follow-up: {format(parseISO(t.followUpDate), 'MMM d, yyyy')}
              </p>
            )}
            {t.notes && (
              <p className="text-xs text-muted-foreground mt-1 italic">{t.notes}</p>
            )}
          </div>
          {!resolved && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() =>
                db.treatments.update(t.id, {
                  resolved: true,
                  updatedAt: new Date().toISOString(),
                })
              }
            >
              Resolve
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-center text-sm text-muted-foreground py-6">{text}</p>
  );
}
