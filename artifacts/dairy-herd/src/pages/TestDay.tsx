import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { format, parseISO } from 'date-fns';
import { Link } from 'wouter';
import { ArrowLeft, FlaskConical, CalendarCheck, Printer, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

type Mode = 'menu' | 'set' | 'report';

// ─── Main page ───────────────────────────────────────────────────────────────

export function TestDay() {
  const [mode, setMode] = useState<Mode>('menu');
  const { toast } = useToast();

  const raw = useLiveQuery(async () => {
    const [settings, animals, breedings, calvings, pregChecks, semenBulls] = await Promise.all([
      db.settings.get('default'),
      db.animals.toArray(),
      db.breedings.toArray(),
      db.calvings.toArray(),
      db.pregnancyChecks.toArray(),
      db.semenBulls.toArray(),
    ]);
    return { settings, animals, breedings, calvings, pregChecks, semenBulls };
  });

  const lastTestDay = raw?.settings?.lastTestDayDate ?? null;

  // ── Report data ─────────────────────────────────────────────────────────
  const reportData = useMemo(() => {
    if (!raw || !lastTestDay) return null;

    const since = parseISO(lastTestDay);
    const animalMap = new Map(raw.animals.map(a => [a.id, a]));
    const bullMap = new Map(raw.semenBulls.map(b => [b.id, b]));

    // Calvings
    const calvings = raw.calvings
      .filter(c => parseISO(c.calvingDate) >= since)
      .sort((a, b) => a.calvingDate.localeCompare(b.calvingDate))
      .map(c => ({ calving: c, animal: animalMap.get(c.animalId) }))
      .filter((r): r is { calving: typeof r.calving; animal: NonNullable<typeof r.animal> } => !!r.animal);

    // Breedings — with service number in current lactation
    const breedings = raw.breedings
      .filter(b => parseISO(b.date) >= since)
      .sort((a, b) => a.date.localeCompare(b.date))
      .flatMap(b => {
        const animal = animalMap.get(b.animalId);
        if (!animal) return [];

        const lactStart = animal.lastCalvingDate ?? '1900-01-01';
        const serviceNum = raw.breedings.filter(
          ob => ob.animalId === b.animalId && ob.date <= b.date && ob.date >= lactStart,
        ).length;

        let sireName = 'Unknown';
        if (b.bullId) {
          const bull = bullMap.get(b.bullId);
          sireName = bull
            ? bull.naabCode
              ? `${bull.name} (${bull.naabCode})`
              : bull.name
            : 'Unknown AI Bull';
        } else if (b.naturalServiceBullName) {
          sireName = `${b.naturalServiceBullName} (NS)`;
        } else if (b.embryoId) {
          sireName = 'Embryo Transfer';
        }

        return [{ breeding: b, animal, serviceNum, sireName }];
      });

    // Dried off
    const driedOff = raw.animals
      .filter(a => a.dryOffDate && parseISO(a.dryOffDate) >= since)
      .sort((a, b) => (a.dryOffDate! > b.dryOffDate! ? 1 : -1));

    // Confirmed pregnant
    const confirmed = raw.pregChecks
      .filter(p => p.result === 'Pregnant' && parseISO(p.checkDate) >= since)
      .sort((a, b) => a.checkDate.localeCompare(b.checkDate))
      .flatMap(p => {
        const animal = animalMap.get(p.animalId);
        if (!animal) return [];
        const breeding = p.breedingId ? raw.breedings.find(b => b.id === p.breedingId) : undefined;
        return [{ check: p, animal, breeding }];
      });

    return { calvings, breedings, driedOff, confirmed };
  }, [raw, lastTestDay]);

  const farmName = raw?.settings?.farmName ?? 'Farm';

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        {mode === 'menu' ? (
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        ) : (
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setMode('menu')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h2 className="text-xl font-bold">Test Day</h2>
          {lastTestDay && mode === 'menu' && (
            <p className="text-sm text-muted-foreground">
              Last set: {format(parseISO(lastTestDay), 'MMM d, yyyy')}
            </p>
          )}
        </div>
      </div>

      {/* ── Menu ── */}
      {mode === 'menu' && (
        <div className="grid grid-cols-1 gap-4">
          <button
            className="text-left w-full"
            onClick={() => setMode('set')}
          >
            <Card className="hover:border-primary/60 transition-colors hover-elevate active-elevate cursor-pointer">
              <CardContent className="p-5 flex items-center gap-5">
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/40 shrink-0">
                  <CalendarCheck className="h-6 w-6 text-amber-700 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-lg">Set Test Day</p>
                  <p className="text-sm text-muted-foreground">
                    {lastTestDay
                      ? `Current: ${format(parseISO(lastTestDay), 'MMM d, yyyy')} — tap to update`
                      : 'Designate the initial test day date'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </button>

          <button
            className="text-left w-full"
            onClick={() => setMode('report')}
            disabled={!lastTestDay}
          >
            <Card className={`transition-colors ${lastTestDay ? 'hover:border-primary/60 hover-elevate active-elevate cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
              <CardContent className="p-5 flex items-center gap-5">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/40 shrink-0">
                  <ClipboardList className="h-6 w-6 text-blue-700 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-bold text-lg">Test Day Report</p>
                  <p className="text-sm text-muted-foreground">
                    {lastTestDay
                      ? `Calvings, breedings, dry-offs & pregnancies since ${format(parseISO(lastTestDay), 'MMM d, yyyy')}`
                      : 'Set a test day first to generate the report'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </button>
        </div>
      )}

      {/* ── Set Test Day ── */}
      {mode === 'set' && (
        <SetTestDayPanel
          current={lastTestDay}
          onSaved={(date) => {
            toast({ title: 'Test day saved', description: `Test day set to ${format(parseISO(date), 'MMM d, yyyy')}.` });
            setMode('menu');
          }}
        />
      )}

      {/* ── Report ── */}
      {mode === 'report' && lastTestDay && reportData && (
        <TestDayReport
          farmName={farmName}
          lastTestDay={lastTestDay}
          data={reportData}
        />
      )}
    </div>
  );
}

// ─── Set Test Day Panel ───────────────────────────────────────────────────────

function SetTestDayPanel({ current, onSaved }: { current: string | null; onSaved: (date: string) => void }) {
  const [dateVal, setDateVal] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!dateVal) return;
    setSaving(true);
    try {
      const isoDate = new Date(dateVal).toISOString();
      const updated = await db.settings.update('default', { lastTestDayDate: isoDate });
      if (!updated) {
        // settings row doesn't exist yet — create minimal row
        await db.settings.put({
          id: 'default',
          farmId: '',
          farmName: 'My Farm',
          pregnancyCheckDays: 35,
          freshCowWindowDays: 10,
          voluntaryWaitingPeriodDays: 60,
          dryPeriodDays: 60,
          dryOffWarningDays: 14,
          lowSemenThreshold: 2,
          gestationDays: 283,
          conventionalBreedingHours: 12,
          sexedBreedingHours: 30,
          embryoTransferHours: 168,
          sexedSemenMaxService: 2,
          lastTestDayDate: isoDate,
          updatedAt: new Date().toISOString(),
        });
      }
      onSaved(isoDate);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {current && (
          <p className="text-sm text-muted-foreground">
            Current test day: <span className="font-semibold">{format(parseISO(current), 'MMMM d, yyyy')}</span>
          </p>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium">Test Day Date</label>
          <Input
            type="date"
            className="h-12 text-base"
            value={dateVal}
            onChange={e => setDateVal(e.target.value)}
          />
        </div>
        <Button className="w-full h-12 text-base font-bold" onClick={save} disabled={saving || !dateVal}>
          <CalendarCheck className="h-5 w-5 mr-2" />
          {saving ? 'Saving…' : 'Set as Test Day'}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          The Test Day Report will cover all events from this date forward to the next time you run it.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Report ───────────────────────────────────────────────────────────────────

function TestDayReport({
  farmName,
  lastTestDay,
  data,
}: {
  farmName: string;
  lastTestDay: string;
  data: NonNullable<ReturnType<typeof buildReportData>>;
}) {
  return (
    <div>
      {/* Print button — hidden when printing */}
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
      </div>

      {/* ── Printable area ── */}
      <div className="space-y-6 print:space-y-8">

        {/* Report header */}
        <div className="text-center border-b pb-4 print:pb-6">
          <div className="flex items-center justify-center gap-2 mb-1 print:hidden">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold print:text-3xl">{farmName}</h1>
          <h2 className="text-lg font-semibold text-muted-foreground print:text-xl">DHIA Test Day Report</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Period: {format(parseISO(lastTestDay), 'MMM d, yyyy')} — {format(new Date(), 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Generated {format(new Date(), 'MMM d, yyyy h:mm a')}</p>
        </div>

        {/* 1 — Calvings */}
        <ReportSection title="Calvings" count={data.calvings.length}>
          {data.calvings.length === 0 ? (
            <NoData text="No calvings recorded since last test day." />
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground/20">
                  <Th>Cow</Th>
                  <Th>Date</Th>
                  <Th>Calf Sex</Th>
                  <Th>Calf Tag(s)</Th>
                </tr>
              </thead>
              <tbody>
                {data.calvings.map(({ calving, animal }) => {
                  const tags = [calving.calfTag, calving.twinCalfTag].filter(Boolean).join(', ');
                  return (
                    <tr key={calving.id} className="border-b border-foreground/10 hover:bg-muted/30 print:hover:bg-transparent">
                      <Td className="font-medium">{animal.number} {animal.barnName || animal.name}</Td>
                      <Td>{format(parseISO(calving.calvingDate), 'MMM d, yyyy')}</Td>
                      <Td>{calving.calfSex}</Td>
                      <Td>{tags || <span className="text-muted-foreground text-xs">—</span>}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ReportSection>

        {/* 2 — Breedings */}
        <ReportSection title="Breedings" count={data.breedings.length}>
          {data.breedings.length === 0 ? (
            <NoData text="No breedings recorded since last test day." />
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground/20">
                  <Th>Cow</Th>
                  <Th>Date</Th>
                  <Th>Service Sire</Th>
                  <Th className="text-center">Svc #</Th>
                </tr>
              </thead>
              <tbody>
                {data.breedings.map(({ breeding, animal, serviceNum, sireName }) => (
                  <tr key={breeding.id} className="border-b border-foreground/10 hover:bg-muted/30 print:hover:bg-transparent">
                    <Td className="font-medium">{animal.number} {animal.barnName || animal.name}</Td>
                    <Td>{format(parseISO(breeding.date), 'MMM d, yyyy')}</Td>
                    <Td>{sireName}</Td>
                    <Td className="text-center font-semibold">{serviceNum}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ReportSection>

        {/* 3 — Dried Off */}
        <ReportSection title="Cows Dried Off" count={data.driedOff.length}>
          {data.driedOff.length === 0 ? (
            <NoData text="No cows dried off since last test day." />
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground/20">
                  <Th>Cow</Th>
                  <Th>Dry-Off Date</Th>
                  <Th>Expected Calving</Th>
                </tr>
              </thead>
              <tbody>
                {data.driedOff.map(animal => (
                  <tr key={animal.id} className="border-b border-foreground/10 hover:bg-muted/30 print:hover:bg-transparent">
                    <Td className="font-medium">{animal.number} {animal.barnName || animal.name}</Td>
                    <Td>{animal.dryOffDate ? format(parseISO(animal.dryOffDate), 'MMM d, yyyy') : '—'}</Td>
                    <Td>
                      {animal.expectedCalvingDate
                        ? format(parseISO(animal.expectedCalvingDate), 'MMM d, yyyy')
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ReportSection>

        {/* 4 — Confirmed Pregnant */}
        <ReportSection title="Confirmed Pregnant" count={data.confirmed.length}>
          {data.confirmed.length === 0 ? (
            <NoData text="No pregnancy confirmations since last test day." />
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground/20">
                  <Th>Cow</Th>
                  <Th>Check Date</Th>
                  <Th>Breeding Date</Th>
                  <Th>Expected Calving</Th>
                </tr>
              </thead>
              <tbody>
                {data.confirmed.map(({ check, animal, breeding }) => (
                  <tr key={check.id} className="border-b border-foreground/10 hover:bg-muted/30 print:hover:bg-transparent">
                    <Td className="font-medium">{animal.number} {animal.barnName || animal.name}</Td>
                    <Td>{format(parseISO(check.checkDate), 'MMM d, yyyy')}</Td>
                    <Td>{breeding ? format(parseISO(breeding.date), 'MMM d, yyyy') : <span className="text-muted-foreground text-xs">—</span>}</Td>
                    <Td>
                      {check.expectedCalvingDate
                        ? format(parseISO(check.expectedCalvingDate), 'MMM d, yyyy')
                        : animal.expectedCalvingDate
                        ? format(parseISO(animal.expectedCalvingDate), 'MMM d, yyyy')
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ReportSection>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t print:pt-6">
          HerdTrack · {farmName} · Test Day {format(parseISO(lastTestDay), 'MMM d, yyyy')}
        </div>
      </div>
    </div>
  );
}

// Trick TypeScript into accepting the return type reference before the function is defined
type buildReportData = {
  calvings: { calving: any; animal: any }[];
  breedings: { breeding: any; animal: any; serviceNum: number; sireName: string }[];
  driedOff: any[];
  confirmed: { check: any; animal: any; breeding: any }[];
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function ReportSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-base font-bold uppercase tracking-wide">{title}</h3>
        <span className="text-sm font-semibold text-muted-foreground">({count})</span>
        <div className="flex-1 border-t border-foreground/20" />
      </div>
      {children}
    </section>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left py-2 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`py-2 px-2 align-top ${className}`}>{children}</td>;
}

function NoData({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground italic px-2 py-1">{text}</p>;
}
