import type { SyncEventType, SyncProtocolType } from '@/db';

export interface ProtocolEvent {
  day: number;
  eventType: SyncEventType;
  label: string;
}

export interface ProtocolDef {
  label: string;
  description: string;
  totalDays: number;
  events: ProtocolEvent[];
}

export const PROTOCOL_DEFS: Record<SyncProtocolType, ProtocolDef> = {
  ovsynch: {
    label: 'Ovsynch',
    description: 'Classic 10-day protocol: GnRH → 7d → PGF₂α → 48h → GnRH → breed next morning',
    totalDays: 10,
    events: [
      { day: 0,  eventType: 'gnrh',     label: 'GnRH #1' },
      { day: 7,  eventType: 'pgf',      label: 'PGF₂α' },
      { day: 9,  eventType: 'gnrh',     label: 'GnRH #2' },
      { day: 10, eventType: 'timed-ai', label: 'Timed AI' },
    ],
  },

  'cidr-ovsynch': {
    label: 'CIDR + Ovsynch',
    description: 'Ovsynch with CIDR insert at Day 0 and removal at PGF₂α — improves conception in low-P4 cows',
    totalDays: 10,
    events: [
      { day: 0,  eventType: 'gnrh',        label: 'GnRH #1' },
      { day: 0,  eventType: 'cidr-insert', label: 'CIDR Insert' },
      { day: 7,  eventType: 'pgf',         label: 'PGF₂α' },
      { day: 7,  eventType: 'cidr-remove', label: 'CIDR Remove' },
      { day: 9,  eventType: 'gnrh',        label: 'GnRH #2' },
      { day: 10, eventType: 'timed-ai',    label: 'Timed AI' },
    ],
  },

  '5day-cidr': {
    label: '5-Day CIDR',
    description: 'Shorter CIDR window with two PGF₂α doses — popular for heifers and low-cycling cows',
    totalDays: 9,
    events: [
      { day: 0,  eventType: 'gnrh',        label: 'GnRH #1' },
      { day: 0,  eventType: 'cidr-insert', label: 'CIDR Insert' },
      { day: 5,  eventType: 'pgf',         label: 'PGF₂α #1' },
      { day: 5,  eventType: 'cidr-remove', label: 'CIDR Remove' },
      { day: 6,  eventType: 'pgf',         label: 'PGF₂α #2' },
      { day: 8,  eventType: 'gnrh',        label: 'GnRH #2' },
      { day: 9,  eventType: 'timed-ai',    label: 'Timed AI' },
    ],
  },

  'presynch-ovsynch': {
    label: 'Pre-Synch + Ovsynch',
    description: 'Two PGF₂α injections (14 days apart) to synchronise cows before Ovsynch — best conception rates for VWP cows',
    totalDays: 38,
    events: [
      { day: 0,  eventType: 'pgf',      label: 'Pre-Synch PGF₂α #1' },
      { day: 14, eventType: 'pgf',      label: 'Pre-Synch PGF₂α #2' },
      { day: 28, eventType: 'gnrh',     label: 'GnRH #1' },
      { day: 35, eventType: 'pgf',      label: 'PGF₂α' },
      { day: 37, eventType: 'gnrh',     label: 'GnRH #2' },
      { day: 38, eventType: 'timed-ai', label: 'Timed AI' },
    ],
  },
};

export const EVENT_META: Record<SyncEventType, { color: string; bgColor: string; shortLabel: string }> = {
  gnrh:        { color: 'text-blue-700',    bgColor: 'bg-blue-100 dark:bg-blue-950/40',    shortLabel: 'GnRH' },
  pgf:         { color: 'text-orange-700',  bgColor: 'bg-orange-100 dark:bg-orange-950/40',shortLabel: 'PGF₂α' },
  'cidr-insert': { color: 'text-violet-700', bgColor: 'bg-violet-100 dark:bg-violet-950/40', shortLabel: 'CIDR In' },
  'cidr-remove': { color: 'text-violet-700', bgColor: 'bg-violet-100 dark:bg-violet-950/40', shortLabel: 'CIDR Out' },
  'timed-ai':  { color: 'text-rose-700',    bgColor: 'bg-rose-100 dark:bg-rose-950/40',    shortLabel: 'Timed AI' },
};
