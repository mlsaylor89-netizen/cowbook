import { subDays, addDays } from 'date-fns';
import { db } from './index';

export async function seedDemoData() {
  const count = await db.settings.count();
  if (count > 0) return; // Already initialized

  const now = new Date();
  const nowIso = now.toISOString();

  // Settings
  await db.settings.add({
    id: 'default',
    farmId: 'demo-farm',
    farmName: 'Sunny Pastures Dairy',
    pregnancyCheckDays: 35,
    freshCowWindowDays: 10,
    voluntaryWaitingPeriodDays: 60,
    dryPeriodDays: 60,
    dryOffWarningDays: 14,
    lowSemenThreshold: 2,
    gestationDays: 283,
    updatedAt: nowIso
  });

  // Bulls
  const bulls = [
    { id: 'bull-1', name: 'Victorious', breed: 'Holstein', studCompany: 'Select Sires' },
    { id: 'bull-2', name: 'Landmark', breed: 'Holstein', studCompany: 'ABS Global' },
    { id: 'bull-3', name: 'Pinnacle', breed: 'Holstein', studCompany: 'Semex' },
    { id: 'bull-4', name: 'Champion', breed: 'Holstein', studCompany: 'STgenetics' }
  ].map(b => ({ ...b, createdAt: nowIso, updatedAt: nowIso }));
  
  await db.semenBulls.bulkAdd(bulls);

  // Semen Inventory
  await db.semenPurchases.bulkAdd([
    { id: crypto.randomUUID(), bullId: 'bull-1', purchaseDate: subDays(now, 60).toISOString(), unitsCount: 10, pricePerUnit: 28, totalCost: 280, createdAt: nowIso, updatedAt: nowIso },
    { id: crypto.randomUUID(), bullId: 'bull-2', purchaseDate: subDays(now, 120).toISOString(), unitsCount: 25, pricePerUnit: 35, totalCost: 875, createdAt: nowIso, updatedAt: nowIso },
    { id: crypto.randomUUID(), bullId: 'bull-3', purchaseDate: subDays(now, 30).toISOString(), unitsCount: 8, pricePerUnit: 42, totalCost: 336, createdAt: nowIso, updatedAt: nowIso },
    { id: crypto.randomUUID(), bullId: 'bull-4', purchaseDate: subDays(now, 90).toISOString(), unitsCount: 15, pricePerUnit: 30, totalCost: 450, createdAt: nowIso, updatedAt: nowIso }
  ]);

  // Animals
  const animals = [
    { id: 'cow-1', name: 'Daisy', number: '101', breed: 'Holstein', status: 'Lactating', lactationNumber: 2, lastCalvingDate: subDays(now, 5).toISOString() }, // Fresh
    { id: 'cow-2', name: 'Bessie', number: '102', breed: 'Holstein', status: 'Open', lactationNumber: 3, lastCalvingDate: subDays(now, 75).toISOString() }, // Breeding Attention
    { id: 'cow-3', name: 'Rosie', number: '103', breed: 'Holstein', status: 'Open', lactationNumber: 1, lastCalvingDate: subDays(now, 90).toISOString() }, // Bred, not ready for preg check
    { id: 'cow-4', name: 'Clover', number: '104', breed: 'Holstein', status: 'Open', lactationNumber: 4, lastCalvingDate: subDays(now, 120).toISOString() }, // Ready for preg check
    { id: 'cow-5', name: 'Maple', number: '105', breed: 'Holstein', status: 'Pregnant', lactationNumber: 2, lastCalvingDate: subDays(now, 300).toISOString(), expectedCalvingDate: addDays(now, 78).toISOString(), expectedDryOffDate: addDays(now, 18).toISOString() }, // Approaching dry off
    { id: 'cow-6', name: 'Buttercup', number: '106', breed: 'Holstein', status: 'Dry', lactationNumber: 3, lastCalvingDate: subDays(now, 380).toISOString(), expectedCalvingDate: addDays(now, 5).toISOString() }, // Due to calve
    { id: 'cow-7', name: 'Hazel', number: '107', breed: 'Holstein', status: 'Lactating', lactationNumber: 1, lastCalvingDate: subDays(now, 45).toISOString() }, // Treatment
    { id: 'cow-8', name: 'Pearl', number: '108', breed: 'Holstein', status: 'Dry', lactationNumber: 5, expectedCalvingDate: addDays(now, 40).toISOString() }, // Just dry
    { id: 'cow-9', name: 'Fern', number: '109', breed: 'Holstein', status: 'Heifer', lactationNumber: 0, birthDate: subDays(now, 400).toISOString() },
    { id: 'cow-10', name: 'Ivy', number: '110', breed: 'Holstein', status: 'BredHeifer', lactationNumber: 0, birthDate: subDays(now, 500).toISOString(), expectedCalvingDate: addDays(now, 150).toISOString() }
  ].map(a => ({ ...a, farmId: 'demo-farm', createdAt: nowIso, updatedAt: nowIso })) as any;

  await db.animals.bulkAdd(animals);

  // Breedings
  await db.breedings.bulkAdd([
    { id: 'br-1', animalId: 'cow-3', date: subDays(now, 20).toISOString(), bullId: 'bull-1', breedingType: 'AI', pregnancyCheckScheduledDate: addDays(subDays(now, 20), 35).toISOString(), createdAt: nowIso, updatedAt: nowIso },
    { id: 'br-2', animalId: 'cow-4', date: subDays(now, 42).toISOString(), bullId: 'bull-2', breedingType: 'AI', pregnancyCheckScheduledDate: addDays(subDays(now, 42), 35).toISOString(), createdAt: nowIso, updatedAt: nowIso },
    { id: 'br-3', animalId: 'cow-5', date: subDays(now, 205).toISOString(), bullId: 'bull-3', breedingType: 'AI', pregnancyCheckScheduledDate: addDays(subDays(now, 205), 35).toISOString(), createdAt: nowIso, updatedAt: nowIso },
    { id: 'br-4', animalId: 'cow-6', date: subDays(now, 278).toISOString(), bullId: 'bull-4', breedingType: 'AI', pregnancyCheckScheduledDate: addDays(subDays(now, 278), 35).toISOString(), createdAt: nowIso, updatedAt: nowIso },
    { id: 'br-5', animalId: 'cow-10', date: subDays(now, 133).toISOString(), bullId: 'bull-1', breedingType: 'AI', pregnancyCheckScheduledDate: addDays(subDays(now, 133), 35).toISOString(), createdAt: nowIso, updatedAt: nowIso },
  ]);

  // Preg Checks
  await db.pregnancyChecks.bulkAdd([
    { id: 'pc-1', animalId: 'cow-5', breedingId: 'br-3', checkDate: subDays(now, 170).toISOString(), result: 'Pregnant', createdAt: nowIso, updatedAt: nowIso },
    { id: 'pc-2', animalId: 'cow-6', breedingId: 'br-4', checkDate: subDays(now, 243).toISOString(), result: 'Pregnant', createdAt: nowIso, updatedAt: nowIso },
    { id: 'pc-3', animalId: 'cow-10', breedingId: 'br-5', checkDate: subDays(now, 98).toISOString(), result: 'Pregnant', createdAt: nowIso, updatedAt: nowIso }
  ]);

  // Treatments
  await db.treatments.add({
    id: 'tr-1',
    animalId: 'cow-7',
    date: subDays(now, 2).toISOString(),
    condition: 'Mastitis',
    product: 'Spectramast LC',
    route: 'Intramammary',
    milkWithholdDays: 3,
    meatWithholdDays: 14,
    milkWithholdUntil: addDays(now, 1).toISOString(),
    meatWithholdUntil: addDays(now, 12).toISOString(),
    resolved: false,
    createdAt: nowIso,
    updatedAt: nowIso
  });
}

export async function clearDemoData() {
  await db.animals.clear();
  await db.breedings.clear();
  await db.pregnancyChecks.clear();
  await db.calvings.clear();
  await db.treatments.clear();
  await db.semenBulls.clear();
  await db.semenPurchases.clear();
  await db.settings.clear();
}
