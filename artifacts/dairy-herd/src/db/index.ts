import Dexie, { type Table } from 'dexie';

export interface Animal {
  id: string;
  farmId: string;
  name: string;
  number: string;
  registrationNumber?: string;
  rfidTag?: string;
  breed: string;
  birthDate?: string;
  lactationNumber: number;
  status: 'Lactating' | 'Dry' | 'Heifer' | 'BredHeifer' | 'Pregnant' | 'Open' | 'Sold' | 'Dead';
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
  bullId?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface ClassificationScore {
  id: string;
  animalId: string;
  date: string;
  classifier?: string;
  // Overall
  finalScore?: 'E' | 'VG' | 'G+' | 'G' | 'F' | 'P';
  finalPoints?: number;
  // Frame (1–9 linear)
  stature?: number;
  strength?: number;
  bodyDepth?: number;
  dairyForm?: number;
  // Feet & Legs (1–9)
  footAngle?: number;
  rearLegs?: number;
  // Udder (1–9)
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
    // v2: add bullId index to breedings so SemenDetail can query usage by bull
    this.version(2).stores({
      breedings: 'id, animalId, date, pregnancyCheckScheduledDate, bullId',
    });
    // v3: add animalNotes table
    this.version(3).stores({
      animalNotes: 'id, animalId, createdAt',
    });
    // v4: add classifications table
    this.version(4).stores({
      classifications: 'id, animalId, date',
    });
  }
}

export const db = new DairyHerdDB();
