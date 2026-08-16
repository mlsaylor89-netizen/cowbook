import Dexie, { type Table } from 'dexie';

export interface Animal {
  id: string;
  farmId: string;
  name: string;           // registration / official name
  barnName?: string;      // day-to-day name used in the barn
  number: string;
  registrationNumber?: string;
  rfidTag?: string;
  breed: string;
  birthDate?: string;       // date of birth
  sire?: string;            // sire name / registration (free text)
  dam?: string;             // dam name / registration (free text)
  lactationNumber: number;
  // Legacy combined status — kept for Dexie index & backward compat
  status: 'Lactating' | 'Dry' | 'Heifer' | 'BredHeifer' | 'Pregnant' | 'Open' | 'Sold' | 'Dead';
  // New split statuses — preferred by computed functions
  lactationStatus?: 'Milking' | 'Dry' | 'Heifer';
  reproStatus?: 'Open' | 'Bred' | 'Pregnant' | 'Fresh';
  lastCalvingDate?: string;
  expectedCalvingDate?: string;
  expectedDryOffDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Breeding {
  id: string;
  animalId: string;
  date: string;
  bullId?: string;                      // AI: semen inventory bull
  naturalServiceBullName?: string;      // Natural Service: free-text bull name
  embryoId?: string;
  breedingType: 'AI' | 'NaturalService' | 'Embryo';
  technician?: string;
  notes?: string;
  pregnancyCheckScheduledDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface PregnancyCheck {
  id: string;
  animalId: string;
  breedingId?: string;
  checkDate: string;
  result: 'Pregnant' | 'Open' | 'Recheck';
  recheckDate?: string;
  expectedCalvingDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Calving {
  id: string;
  animalId: string;
  calvingDate: string;
  calfSex: 'Heifer' | 'Bull' | 'Twins' | 'Stillborn' | 'Unknown';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Treatment {
  id: string;
  animalId: string;
  date: string;
  condition: string;
  product: string;
  dose?: string;
  route: 'IM' | 'SQ' | 'IV' | 'Oral' | 'Intramammary' | 'Topical' | 'Other';
  administrator?: string;
  milkWithholdDays?: number;
  meatWithholdDays?: number;
  milkWithholdUntil?: string;
  meatWithholdUntil?: string;
  followUpDate?: string;
  notes?: string;
  resolved: boolean;
  // Pharmacy link
  drugProductId?: string;
  quantityUsed?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassificationScore {
  id: string;
  animalId: string;
  date: string;
  classifier?: string;
  finalScore?: 'E' | 'VG' | 'G+' | 'G' | 'F' | 'P';
  finalPoints?: number;
  stature?: number;
  strength?: number;
  bodyDepth?: number;
  dairyForm?: number;
  footAngle?: number;
  rearLegs?: number;
  foreUdderAttachment?: number;
  rearUdderHeight?: number;
  rearUdderWidth?: number;
  udderCleft?: number;
  udderDepth?: number;
  frontTeatPlacement?: number;
  rearTeatPlacement?: number;
  teatLength?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnimalNote {
  id: string;
  animalId: string;
  note: string;
  createdAt: string;
}

export interface SemenBull {
  id: string;
  name: string;
  naabCode?: string;
  registrationNumber?: string;
  breed: string;
  studCompany?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SemenPurchase {
  id: string;
  bullId: string;
  purchaseDate: string;
  unitsCount: number;
  pricePerUnit: number;
  totalCost: number;
  tankNumber?: string;
  canisterNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Embryo {
  id: string;
  donorName: string;
  sireName?: string;
  sireNaabCode?: string;
  breed: string;
  studCompany?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmbryoPurchase {
  id: string;
  embryoId: string;
  purchaseDate: string;
  unitsCount: number;
  pricePerUnit: number;
  totalCost: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type DrugRoute = 'IM' | 'SQ' | 'IV' | 'Oral' | 'Intramammary' | 'Topical' | 'Other';

export interface DrugProduct {
  id: string;
  name: string;
  unit: string;           // "mL", "tablets", "tubes", "g", "oz", etc.
  bottleSize?: number;    // full/original quantity — used to compute % remaining
  quantityOnHand: number;
  milkWithholdDays: number;
  meatWithholdDays: number;
  defaultDose?: string;   // e.g. "10 mL per 100 lb"
  defaultRoute?: DrugRoute;
  lowStockThreshold?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  id: string; // always 'default'
  farmId: string;
  farmName: string;
  pregnancyCheckDays: number;
  freshCowWindowDays: number;
  voluntaryWaitingPeriodDays: number;
  dryPeriodDays: number;
  dryOffWarningDays: number;
  lowSemenThreshold: number;
  gestationDays: number;
  updatedAt: string;
}

export type SyncProtocolType = 'ovsynch' | 'cidr-ovsynch' | '5day-cidr' | 'presynch-ovsynch';
export type SyncEventType = 'gnrh' | 'pgf' | 'cidr-insert' | 'cidr-remove' | 'timed-ai';

export interface SyncProtocolBatch {
  id: string;
  farmId: string;
  protocol: SyncProtocolType;
  startDate: string;       // 'yyyy-MM-dd' — Day 0
  animalIds: string[];
  status: 'active' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncEvent {
  id: string;
  farmId: string;
  batchId: string;
  animalId: string;
  day: number;             // offset from startDate (can be 0)
  eventType: SyncEventType;
  label: string;           // e.g. 'GnRH #1', 'PGF₂α'
  scheduledDate: string;   // 'yyyy-MM-dd' (kept for index/filtering)
  scheduledTime?: string;  // 'HH:mm' — set when first-shot time is captured
  status: 'pending' | 'completed' | 'skipped';
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HeatObservation {
  id: string;
  animalId: string;
  farmId: string;
  observedAt: string;        // ISO — when heat was seen
  breedingType: 'conventional' | 'sexed';
  scheduledBreedAt: string;  // observedAt + 12 h (conventional) or + 30 h (sexed)
  alertAt: string;           // scheduledBreedAt − 1 h
  status: 'pending' | 'bred' | 'missed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export class DairyHerdDB extends Dexie {
  animals!: Table<Animal, string>;
  breedings!: Table<Breeding, string>;
  pregnancyChecks!: Table<PregnancyCheck, string>;
  calvings!: Table<Calving, string>;
  treatments!: Table<Treatment, string>;
  semenBulls!: Table<SemenBull, string>;
  semenPurchases!: Table<SemenPurchase, string>;
  settings!: Table<Settings, string>;
  animalNotes!: Table<AnimalNote, string>;
  classifications!: Table<ClassificationScore, string>;
  embryos!: Table<Embryo, string>;
  embryoPurchases!: Table<EmbryoPurchase, string>;
  drugProducts!: Table<DrugProduct, string>;
  heats!: Table<HeatObservation, string>;
  syncProtocolBatches!: Table<SyncProtocolBatch, string>;
  syncEvents!: Table<SyncEvent, string>;

  constructor() {
    super('DairyHerdDB');
    this.version(1).stores({
      animals: 'id, farmId, status, lastCalvingDate, expectedCalvingDate, expectedDryOffDate',
      breedings: 'id, animalId, date, pregnancyCheckScheduledDate',
      pregnancyChecks: 'id, animalId, breedingId, checkDate',
      calvings: 'id, animalId, calvingDate',
      treatments: 'id, animalId, date, resolved, milkWithholdUntil',
      semenBulls: 'id',
      semenPurchases: 'id, bullId',
      settings: 'id'
    });
    this.version(2).stores({
      breedings: 'id, animalId, date, pregnancyCheckScheduledDate, bullId',
    });
    this.version(3).stores({
      animalNotes: 'id, animalId, createdAt',
    });
    this.version(4).stores({
      classifications: 'id, animalId, date',
    });
    this.version(5).stores({
      embryos: 'id',
      embryoPurchases: 'id, embryoId',
    });
    this.version(6).stores({
      breedings: 'id, animalId, date, pregnancyCheckScheduledDate, bullId, embryoId',
    });
    // v7: pharmacy drug inventory
    this.version(7).stores({
      drugProducts: 'id',
      treatments: 'id, animalId, date, resolved, milkWithholdUntil, drugProductId',
    });
    // v8: heat observations & alarms
    this.version(8).stores({
      heats: 'id, animalId, farmId, status, scheduledBreedAt',
    });
    // v9: reproductive sync protocols
    this.version(9).stores({
      syncProtocolBatches: 'id, farmId, status',
      syncEvents: 'id, batchId, animalId, scheduledDate, status, farmId',
    });
  }
}

export const db = new DairyHerdDB();

// When a newer version of the app opens the DB in another tab, this tab must
// release its connection immediately or every useLiveQuery call blocks forever
// waiting for a DB that can never finish upgrading.
db.on('versionchange', () => {
  db.close();
  window.location.reload();
});
