import { addDays, differenceInDays, differenceInHours, isBefore, isAfter, subDays, isToday, parseISO } from 'date-fns';
import { db, type Animal, type Breeding, type PregnancyCheck, type Calving, type Treatment, type Settings, type HeatObservation, type ETRecipientRecord } from './index';

// ── Status helpers: prefer new split fields, fall back for old records ──────

export function lactStat(a: Animal): 'Milking' | 'Dry' | 'Heifer' {
  if (a.lactationStatus) return a.lactationStatus;
  if (a.status === 'Dry') return 'Dry';
  if (a.status === 'Heifer' || a.status === 'BredHeifer') return 'Heifer';
  return 'Milking'; // Lactating / Open / Pregnant all imply milking in legacy data
}

export function reproStat(a: Animal): 'Open' | 'Bred' | 'Pregnant' | 'Fresh' {
  if (a.reproStatus) return a.reproStatus;
  if (a.status === 'Pregnant') return 'Pregnant';
  if (a.status === 'BredHeifer') return 'Bred';
  if (a.status === 'Dry') return 'Pregnant'; // legacy: dry cows were typically confirmed pregnant
  return 'Open';
}

function isActive(a: Animal): boolean {
  return a.status !== 'Sold' && a.status !== 'Dead';
}

/** Derive the legacy status value from the split fields (for Dexie index compat). */
export function deriveStatus(
  lactation: 'Milking' | 'Dry' | 'Heifer',
  repro: 'Open' | 'Bred' | 'Pregnant' | 'Fresh',
  disposition: 'Active' | 'Sold' | 'Dead'
): Animal['status'] {
  if (disposition === 'Sold') return 'Sold';
  if (disposition === 'Dead') return 'Dead';
  if (lactation === 'Heifer') return repro === 'Bred' || repro === 'Pregnant' ? 'BredHeifer' : 'Heifer';
  if (repro === 'Pregnant') return 'Pregnant';
  if (lactation === 'Dry') return 'Dry';
  if (repro === 'Open') return 'Open';
  return 'Lactating';
}

// ── Core computed functions ──────────────────────────────────────────────────

export function getDIM(animal: Animal): number | null {
  if (!animal.lastCalvingDate) return null;
  if (lactStat(animal) === 'Heifer') return null;
  return differenceInDays(new Date(), parseISO(animal.lastCalvingDate));
}

export function getExpectedCalvingDate(breedingDate: string, gestationDays: number): string {
  return addDays(parseISO(breedingDate), gestationDays).toISOString();
}

export function getExpectedDryOffDate(expectedCalvingDate: string, dryPeriodDays: number): string {
  return subDays(parseISO(expectedCalvingDate), dryPeriodDays).toISOString();
}

export function getHerdSummary(animals: Animal[], settings: Settings | undefined) {
  let milking = 0, dry = 0, heifers = 0, pregnant = 0, open = 0;
  let totalDim = 0, dimCount = 0, due30Days = 0;

  const now = new Date();
  const thirtyDaysFromNow = addDays(now, 30);

  animals.forEach(a => {
    if (!isActive(a)) return;
    const ls = lactStat(a);
    const rs = reproStat(a);
    if (ls === 'Milking') milking++;
    if (ls === 'Dry') dry++;
    if (ls === 'Heifer') heifers++;
    if (rs === 'Pregnant') pregnant++;
    if (rs === 'Open') open++;

    const dim = getDIM(a);
    if (dim !== null) { totalDim += dim; dimCount++; }

    if (a.expectedCalvingDate) {
      const calvDate = parseISO(a.expectedCalvingDate);
      if (isAfter(calvDate, now) && isBefore(calvDate, thirtyDaysFromNow)) due30Days++;
    }
  });

  return {
    total: animals.filter(isActive).length,
    milking, dry, heifers, pregnant, open,
    avgDIM: dimCount > 0 ? Math.round(totalDim / dimCount) : 0,
    due30Days
  };
}

export function getPregCheckList(animals: Animal[], breedings: Breeding[], pregChecks: PregnancyCheck[], settings: Settings) {
  const now = new Date();

  return animals.filter(a => {
    if (!isActive(a)) return false;
    if (reproStat(a) === 'Pregnant') return false;

    const lastBreeding = breedings
      .filter(b => b.animalId === a.id)
      .sort((x, y) => parseISO(y.date).getTime() - parseISO(x.date).getTime())[0];
    if (!lastBreeding) return false;

    const checksForBreeding = pregChecks.filter(pc => pc.breedingId === lastBreeding.id);
    if (checksForBreeding.some(pc => pc.result === 'Pregnant' || pc.result === 'Open')) return false;

    return isBefore(parseISO(lastBreeding.pregnancyCheckScheduledDate), now) || isToday(parseISO(lastBreeding.pregnancyCheckScheduledDate));
  }).map(a => {
    const lastBreeding = breedings
      .filter(b => b.animalId === a.id)
      .sort((x, y) => parseISO(y.date).getTime() - parseISO(x.date).getTime())[0];
    return { animal: a, breeding: lastBreeding, daysSinceBreeding: differenceInDays(now, parseISO(lastBreeding.date)) };
  }).sort((a, b) => (a.animal.barnName || a.animal.name).localeCompare(b.animal.barnName || b.animal.name));
}

export function getFreshCowList(animals: Animal[], settings: Settings) {
  return animals.filter(a => {
    const dim = getDIM(a);
    return dim !== null && dim >= 0 && dim <= settings.freshCowWindowDays;
  }).map(a => ({ animal: a, dim: getDIM(a)! }))
    .sort((a, b) => (a.animal.barnName || a.animal.name).localeCompare(b.animal.barnName || b.animal.name));
}

export function getBreedingAttentionList(animals: Animal[], breedings: Breeding[], settings: Settings) {
  return animals.filter(a => {
    if (!isActive(a)) return false;
    const ls = lactStat(a);
    const rs = reproStat(a);
    if (rs !== 'Open') return false;
    if (ls === 'Heifer') return false; // age-based heifer logic can be added later
    const dim = getDIM(a);
    if (dim === null || dim < settings.voluntaryWaitingPeriodDays) return false;
    return true;
  }).map(a => {
    const animalBreedings = breedings.filter(b =>
      b.animalId === a.id && (!a.lastCalvingDate || isAfter(parseISO(b.date), parseISO(a.lastCalvingDate)))
    );
    const lastBreeding = animalBreedings.sort((x, y) => parseISO(y.date).getTime() - parseISO(x.date).getTime())[0];
    return {
      animal: a,
      dim: getDIM(a),
      lastBreedingDate: lastBreeding?.date,
      servicesThisLactation: animalBreedings.length
    };
  }).sort((a, b) => (a.animal.barnName || a.animal.name).localeCompare(b.animal.barnName || b.animal.name));
}

export function getDryOffList(animals: Animal[], settings: Settings) {
  const now = new Date();
  const warningWindow = addDays(now, settings.dryOffWarningDays);

  return animals.filter(a => {
    if (!isActive(a)) return false;
    if (lactStat(a) === 'Heifer') return false; // pregnant heifers don't go dry
    if (lactStat(a) === 'Dry') return false;    // already dry — don't re-list
    if (reproStat(a) !== 'Pregnant') return false;
    if (!a.expectedDryOffDate) return false;
    return isBefore(parseISO(a.expectedDryOffDate), warningWindow);
  }).map(a => ({
    animal: a,
    daysUntilDryOff: differenceInDays(parseISO(a.expectedDryOffDate!), now)
  })).sort((a, b) => (a.animal.barnName || a.animal.name).localeCompare(b.animal.barnName || b.animal.name));
}

export function getUpcomingCalvings(animals: Animal[], etRecipients: ETRecipientRecord[] = []) {
  const now = new Date();
  const next60 = addDays(now, 60);

  const animalItems = animals.filter(a => {
    if (!isActive(a)) return false;
    if (reproStat(a) !== 'Pregnant') return false;
    if (!a.expectedCalvingDate) return false;
    return isBefore(parseISO(a.expectedCalvingDate), next60);
  }).map(a => ({
    kind: 'animal' as const,
    animal: a,
    daysUntilCalving: differenceInDays(parseISO(a.expectedCalvingDate!), now),
  }));

  // ET recipients with a calculated due date (not pregnant/failed, has expectedCalvingDate)
  const etItems = etRecipients.filter(r =>
    r.expectedCalvingDate &&
    r.status !== 'failed' &&
    isBefore(parseISO(r.expectedCalvingDate), next60)
  ).map(r => ({
    kind: 'et' as const,
    recipient: r,
    daysUntilCalving: differenceInDays(parseISO(r.expectedCalvingDate!), now),
  }));

  const due = [...animalItems, ...etItems].sort((a, b) => a.daysUntilCalving - b.daysUntilCalving);

  return {
    due7Days:  due.filter(d => d.daysUntilCalving <= 7),
    due30Days: due.filter(d => d.daysUntilCalving > 7 && d.daysUntilCalving <= 30),
    due60Days: due.filter(d => d.daysUntilCalving > 30),
  };
}

export function getTreatmentFollowUp(treatments: Treatment[], animals: Animal[]) {
  const now = new Date();
  const activeTreatments = treatments.filter(t => !t.resolved);
  const withholding = treatments.filter(t => t.milkWithholdUntil && isAfter(parseISO(t.milkWithholdUntil), now));

  const byName = (a: Animal | undefined, b: Animal | undefined) =>
    (a?.barnName || a?.name || '').localeCompare(b?.barnName || b?.name || '');
  return {
    active: activeTreatments
      .map(t => ({ treatment: t, animal: animals.find(a => a.id === t.animalId) }))
      .sort((a, b) => byName(a.animal, b.animal)),
    withholding: withholding
      .map(t => ({ treatment: t, animal: animals.find(a => a.id === t.animalId) }))
      .sort((a, b) => byName(a.animal, b.animal)),
  };
}

/**
 * Animals to watch for heat.
 * Two sources:
 *  1. Heat-based: animals with a nextHeatExpectedAt (from a 'pass' or 'et-recipient' heat record)
 *     within a ±3-day window — timed from the recorded heat, not the breeding.
 *  2. Breeding-based: cows still in 'Bred' status 20–22 days post-breeding.
 * Animals already covered by source 1 are not duplicated in source 2.
 */
export function getWatchForHeatList(
  animals: Animal[],
  breedings: Breeding[],
  heats: HeatObservation[] = [],
) {
  const now = new Date();

  type WatchItem = {
    animal: Animal;
    source: 'breeding' | 'heat';
    breeding?: Breeding;
    daysSinceBreeding?: number;
    heat?: HeatObservation;
    nextHeatExpectedAt?: string;
    daysUntilNextHeat?: number;
  };

  const results: WatchItem[] = [];
  const seenIds = new Set<string>();

  // ── 1. Heat-based (pass or ET recipient) ─────────────────────────────────
  for (const heat of heats) {
    if (!heat.nextHeatExpectedAt) continue;
    if (heat.status === 'bred') continue;
    const animal = animals.find(a => a.id === heat.animalId);
    if (!animal || !isActive(animal)) continue;
    const days = differenceInDays(parseISO(heat.nextHeatExpectedAt), now);
    if (days >= -3 && days <= 3) {
      seenIds.add(animal.id);
      results.push({
        animal,
        source: 'heat',
        heat,
        nextHeatExpectedAt: heat.nextHeatExpectedAt,
        daysUntilNextHeat: days,
      });
    }
  }

  // ── 2. Breeding-based: Bred cows 20–22 days post-breeding ────────────────
  for (const a of animals) {
    if (seenIds.has(a.id)) continue;
    if (!isActive(a)) continue;
    if (reproStat(a) !== 'Bred') continue;
    const last = breedings
      .filter(b => b.animalId === a.id)
      .sort((x, y) => parseISO(y.date).getTime() - parseISO(x.date).getTime())[0];
    if (!last) continue;
    const days = differenceInDays(now, parseISO(last.date));
    if (days >= 20 && days <= 22) {
      results.push({
        animal: a,
        source: 'breeding',
        breeding: last,
        daysSinceBreeding: days,
      });
    }
  }

  return results.sort((a, b) =>
    (a.animal.barnName || a.animal.name).localeCompare(b.animal.barnName || b.animal.name),
  );
}

/**
 * Pending embryo-transfer recipients — heat records with heatAction === 'et-recipient'
 * and status === 'pending', sorted by scheduled transfer time (soonest first).
 */
export function getETRecipientList(animals: Animal[], heats: HeatObservation[]) {
  const now = new Date();
  return heats
    .filter(h => h.heatAction === 'et-recipient' && h.status === 'pending' && h.etScheduledAt)
    .map(h => {
      const animal = animals.find(a => a.id === h.animalId);
      const hoursUntilET = differenceInHours(parseISO(h.etScheduledAt!), now);
      return { animal, heat: h, etScheduledAt: h.etScheduledAt!, hoursUntilET, isOverdue: hoursUntilET < 0 };
    })
    .filter((r): r is { animal: Animal; heat: HeatObservation; etScheduledAt: string; hoursUntilET: number; isOverdue: boolean } => !!r.animal)
    .sort((a, b) => a.etScheduledAt.localeCompare(b.etScheduledAt));
}

export async function processBreeding(data: Omit<Breeding, 'id' | 'createdAt' | 'updatedAt'>) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.breedings.add({ ...data, id, createdAt: now, updatedAt: now });

  // Update reproStatus to Bred if the animal is currently Open
  const animal = await db.animals.get(data.animalId);
  if (animal && reproStat(animal) === 'Open') {
    await db.animals.update(data.animalId, {
      reproStatus: 'Bred',
      status: deriveStatus(lactStat(animal), 'Bred', 'Active'),
      updatedAt: now,
    });
  }
}

export async function processPregCheck(data: Omit<PregnancyCheck, 'id' | 'createdAt' | 'updatedAt'>, animal: Animal, settings: Settings) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.pregnancyChecks.add({ ...data, id, createdAt: now, updatedAt: now });

  if (data.result === 'Pregnant') {
    const breeding = await db.breedings.get(data.breedingId!);
    const expCalving = getExpectedCalvingDate(breeding!.date, settings.gestationDays);
    const expDryOff = getExpectedDryOffDate(expCalving, settings.dryPeriodDays);

    await db.animals.update(data.animalId, {
      reproStatus: 'Pregnant',
      status: deriveStatus(lactStat(animal), 'Pregnant', 'Active'),
      expectedCalvingDate: expCalving,
      expectedDryOffDate: expDryOff,
      updatedAt: now
    });
  } else if (data.result === 'Open') {
    await db.animals.update(data.animalId, {
      reproStatus: 'Open',
      status: deriveStatus(lactStat(animal), 'Open', 'Active'),
      expectedCalvingDate: undefined,
      expectedDryOffDate: undefined,
      updatedAt: now
    });
  }
}

export async function processCalving(
  data: Omit<Calving, 'id' | 'createdAt' | 'updatedAt'>,
  animal: Animal,
): Promise<{ calvingId: string; calfId: string | null }> {
  const calvingId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.calvings.add({ ...data, id: calvingId, createdAt: now, updatedAt: now });

  await db.animals.update(animal.id, {
    lactationStatus: 'Milking',
    reproStatus: 'Fresh',
    status: 'Lactating',
    lastCalvingDate: data.calvingDate,
    expectedCalvingDate: undefined,
    expectedDryOffDate: undefined,
    lactationNumber: animal.lactationNumber + 1,
    updatedAt: now
  });

  // Auto-create a heifer record for female calves and return her ID
  if (data.calfSex === 'Heifer' || data.calfSex === 'Twins') {
    const calfId = crypto.randomUUID();
    await db.animals.add({
      id: calfId,
      farmId: animal.farmId,
      number: '00',
      name: `Calf of ${animal.number}`,
      breed: animal.breed,
      status: 'Heifer',
      lactationStatus: 'Heifer',
      reproStatus: 'Open',
      lactationNumber: 0,
      dam: `${animal.number} ${animal.name}`,
      birthDate: data.calvingDate,
      notes: `Born ${new Date(data.calvingDate).toLocaleDateString()}. Dam: ${animal.number} ${animal.name}.${data.notes ? ' ' + data.notes : ''}`,
      createdAt: now,
      updatedAt: now,
    });
    return { calvingId, calfId };
  }

  return { calvingId, calfId: null };
}
