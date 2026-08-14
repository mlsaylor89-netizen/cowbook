import { addDays, differenceInDays, isBefore, isAfter, subDays, isToday, parseISO, startOfDay, endOfDay } from 'date-fns';
import { db, type Animal, type Breeding, type PregnancyCheck, type Calving, type Treatment, type Settings } from './index';

export function getDIM(animal: Animal): number | null {
  if (!animal.lastCalvingDate || (animal.status !== 'Lactating' && animal.status !== 'Pregnant' && animal.status !== 'Open')) return null;
  return differenceInDays(new Date(), parseISO(animal.lastCalvingDate));
}

export function getExpectedCalvingDate(breedingDate: string, gestationDays: number): string {
  return addDays(parseISO(breedingDate), gestationDays).toISOString();
}

export function getExpectedDryOffDate(expectedCalvingDate: string, dryPeriodDays: number): string {
  return subDays(parseISO(expectedCalvingDate), dryPeriodDays).toISOString();
}

export function getHerdSummary(animals: Animal[], settings: Settings | undefined) {
  let milking = 0;
  let dry = 0;
  let heifers = 0;
  let pregnant = 0;
  let open = 0;
  let totalDim = 0;
  let dimCount = 0;
  let due30Days = 0;

  const now = new Date();
  const thirtyDaysFromNow = addDays(now, 30);

  animals.forEach(a => {
    if (a.status !== 'Sold' && a.status !== 'Dead') {
      if (a.status === 'Lactating' || (a.status === 'Pregnant' && a.lactationNumber > 0 && (!a.expectedDryOffDate || isAfter(parseISO(a.expectedDryOffDate), now)))) {
        milking++;
      }
      if (a.status === 'Dry') dry++;
      if (a.status === 'Heifer' || a.status === 'BredHeifer') heifers++;
      if (a.status === 'Pregnant') pregnant++;
      if (a.status === 'Open') open++;

      const dim = getDIM(a);
      if (dim !== null) {
        totalDim += dim;
        dimCount++;
      }

      if (a.expectedCalvingDate) {
        const calvDate = parseISO(a.expectedCalvingDate);
        if (isAfter(calvDate, now) && isBefore(calvDate, thirtyDaysFromNow)) {
          due30Days++;
        }
      }
    }
  });

  return {
    total: animals.filter(a => a.status !== 'Sold' && a.status !== 'Dead').length,
    milking,
    dry,
    heifers,
    pregnant,
    open,
    avgDIM: dimCount > 0 ? Math.round(totalDim / dimCount) : 0,
    due30Days
  };
}

export function getPregCheckList(animals: Animal[], breedings: Breeding[], pregChecks: PregnancyCheck[], settings: Settings) {
  const now = new Date();
  
  return animals.filter(a => {
    if (a.status === 'Pregnant' || a.status === 'Sold' || a.status === 'Dead') return false;
    
    const lastBreeding = breedings.filter(b => b.animalId === a.id).sort((x, y) => parseISO(y.date).getTime() - parseISO(x.date).getTime())[0];
    if (!lastBreeding) return false;
    
    const checksForBreeding = pregChecks.filter(pc => pc.breedingId === lastBreeding.id);
    const hasFinalResult = checksForBreeding.some(pc => pc.result === 'Pregnant' || pc.result === 'Open');
    if (hasFinalResult) return false;
    
    return isBefore(parseISO(lastBreeding.pregnancyCheckScheduledDate), now) || isToday(parseISO(lastBreeding.pregnancyCheckScheduledDate));
  }).map(a => {
    const lastBreeding = breedings.filter(b => b.animalId === a.id).sort((x, y) => parseISO(y.date).getTime() - parseISO(x.date).getTime())[0];
    return { animal: a, breeding: lastBreeding, daysSinceBreeding: differenceInDays(now, parseISO(lastBreeding.date)) };
  });
}

export function getFreshCowList(animals: Animal[], settings: Settings) {
  return animals.filter(a => {
    const dim = getDIM(a);
    return dim !== null && dim >= 0 && dim <= settings.freshCowWindowDays;
  }).map(a => ({ animal: a, dim: getDIM(a)! }));
}

export function getBreedingAttentionList(animals: Animal[], breedings: Breeding[], settings: Settings) {
  return animals.filter(a => {
    if (a.status !== 'Open' && a.status !== 'Heifer') return false;
    
    if (a.status === 'Open') {
      const dim = getDIM(a);
      if (dim === null || dim < settings.voluntaryWaitingPeriodDays) return false;
      return true;
    }
    
    if (a.status === 'Heifer') {
      // Logic for heifer breeding age could be added here, for now simplify
      return false;
    }
    return false;
  }).map(a => {
    const animalBreedings = breedings.filter(b => b.animalId === a.id && (!a.lastCalvingDate || isAfter(parseISO(b.date), parseISO(a.lastCalvingDate))));
    const lastBreeding = animalBreedings.sort((x, y) => parseISO(y.date).getTime() - parseISO(x.date).getTime())[0];
    return { 
      animal: a, 
      dim: getDIM(a),
      lastBreedingDate: lastBreeding?.date,
      servicesThisLactation: animalBreedings.length
    };
  });
}

export function getDryOffList(animals: Animal[], settings: Settings) {
  const now = new Date();
  const warningWindow = addDays(now, settings.dryOffWarningDays);
  
  return animals.filter(a => {
    if (a.status !== 'Pregnant' && a.status !== 'Lactating') return false;
    if (!a.expectedDryOffDate) return false;
    
    const dryDate = parseISO(a.expectedDryOffDate);
    // Include cows past dry off date that haven't been dried off yet
    return isBefore(dryDate, warningWindow);
  }).map(a => ({
    animal: a,
    daysUntilDryOff: differenceInDays(parseISO(a.expectedDryOffDate!), now)
  }));
}

export function getUpcomingCalvings(animals: Animal[]) {
  const now = new Date();
  const next60 = addDays(now, 60);
  
  const due = animals.filter(a => {
    if (a.status !== 'Pregnant') return false;
    if (!a.expectedCalvingDate) return false;
    return isBefore(parseISO(a.expectedCalvingDate), next60);
  }).map(a => ({
    animal: a,
    daysUntilCalving: differenceInDays(parseISO(a.expectedCalvingDate!), now)
  })).sort((a, b) => a.daysUntilCalving - b.daysUntilCalving);

  return {
    due7Days: due.filter(d => d.daysUntilCalving <= 7),
    due30Days: due.filter(d => d.daysUntilCalving > 7 && d.daysUntilCalving <= 30),
    due60Days: due.filter(d => d.daysUntilCalving > 30)
  };
}

export function getTreatmentFollowUp(treatments: Treatment[], animals: Animal[]) {
  const now = new Date();
  const activeTreatments = treatments.filter(t => !t.resolved);
  const withholding = treatments.filter(t => t.milkWithholdUntil && isAfter(parseISO(t.milkWithholdUntil), now));

  return {
    active: activeTreatments.map(t => ({ treatment: t, animal: animals.find(a => a.id === t.animalId) })),
    withholding: withholding.map(t => ({ treatment: t, animal: animals.find(a => a.id === t.animalId) }))
  };
}

export async function processBreeding(data: Omit<Breeding, 'id' | 'createdAt' | 'updatedAt'>) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  // If AI and semen used, deduct
  if (data.breedingType === 'AI' && data.bullId) {
    const purchases = await db.semenPurchases.where('bullId').equals(data.bullId).toArray();
    const usedBreedings = await db.breedings.where('bullId').equals(data.bullId).toArray();
    
    const inventory = purchases.reduce((sum, p) => sum + p.unitsCount, 0) - usedBreedings.length;
    // We don't strictly prevent it, but we note it. The UI handles warnings.
  }

  await db.breedings.add({
    ...data,
    id,
    createdAt: now,
    updatedAt: now
  });
}

export async function processPregCheck(data: Omit<PregnancyCheck, 'id' | 'createdAt' | 'updatedAt'>, animal: Animal, settings: Settings) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  await db.pregnancyChecks.add({
    ...data,
    id,
    createdAt: now,
    updatedAt: now
  });

  if (data.result === 'Pregnant') {
    const breeding = await db.breedings.get(data.breedingId!);
    const expCalving = getExpectedCalvingDate(breeding!.date, settings.gestationDays);
    const expDryOff = getExpectedDryOffDate(expCalving, settings.dryPeriodDays);
    
    await db.animals.update(data.animalId, {
      status: 'Pregnant',
      expectedCalvingDate: expCalving,
      expectedDryOffDate: expDryOff,
      updatedAt: now
    });
  } else if (data.result === 'Open') {
    await db.animals.update(data.animalId, {
      status: 'Open',
      expectedCalvingDate: undefined,
      expectedDryOffDate: undefined,
      updatedAt: now
    });
  }
}

export async function processCalving(data: Omit<Calving, 'id' | 'createdAt' | 'updatedAt'>, animal: Animal) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  await db.calvings.add({
    ...data,
    id,
    createdAt: now,
    updatedAt: now
  });

  await db.animals.update(animal.id, {
    status: 'Lactating',
    lastCalvingDate: data.calvingDate,
    expectedCalvingDate: undefined,
    expectedDryOffDate: undefined,
    lactationNumber: animal.lactationNumber + 1,
    updatedAt: now
  });

  // Auto-create a heifer record for female calves
  if (data.calfSex === 'Heifer' || data.calfSex === 'Twins') {
    await db.animals.add({
      id: crypto.randomUUID(),
      farmId: animal.farmId,
      number: '00',
      name: `Calf of ${animal.number}`,
      breed: animal.breed,
      status: 'Heifer',
      lactationNumber: 0,
      birthDate: data.calvingDate,
      notes: `Born ${new Date(data.calvingDate).toLocaleDateString()}. Dam: ${animal.number} ${animal.name}.${data.notes ? ' ' + data.notes : ''}`,
      createdAt: now,
      updatedAt: now,
    });
  }
}
