/**
 * Bidirectional sync: Dexie (local IndexedDB) ↔ Cloud Firestore.
 *
 * Strategy
 * ────────
 * • Dexie hooks intercept every local write and push it to Firestore.
 * • Firestore onSnapshot listeners push remote changes into Dexie.
 * • A "syncingIds" Set prevents echo loops
 *   (Firestore→Dexie write's hook will find the id in the set and skip
 *   pushing it back to Firestore).
 *
 * All Firestore writes are fire-and-forget; Firestore queues them
 * internally when offline and flushes when the device reconnects.
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { firestore } from './firestore';
import { db } from '../db';

// ─── State ─────────────────────────────────────────────────────────────────

/** IDs currently being written *from* Firestore into Dexie. */
const syncingIds = new Set<string>();

let currentFarmId: string | null = null;
const hookUnsubs: Array<() => void> = [];
const snapUnsubs: Array<() => void> = [];

// ─── Table list ────────────────────────────────────────────────────────────

const COLLECTIONS = [
  'animals',
  'breedings',
  'calvings',
  'treatments',
  'pregnancyChecks',
  'animalNotes',
  'classifications',
  'semenBulls',
  'semenPurchases',
  'embryos',
  'embryoPurchases',
  'drugProducts',
  'settings',
  'heats',
] as const;

type CollName = (typeof COLLECTIONS)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tbl(name: CollName): any {
  return (db as unknown as Record<string, unknown>)[name];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Strip undefined / non-serialisable values before writing to Firestore. */
function clean(obj: unknown): object {
  return JSON.parse(JSON.stringify(obj));
}

function pushToCloud(collName: string, id: string, data: object) {
  if (!currentFarmId) return;
  setDoc(
    doc(firestore, 'farms', currentFarmId, collName, id),
    clean(data),
  ).catch((err: Error) =>
    console.error(`[sync] push ${collName}/${id}:`, err.message),
  );
}

function deleteFromCloud(collName: string, id: string) {
  if (!currentFarmId) return;
  deleteDoc(
    doc(firestore, 'farms', currentFarmId, collName, id),
  ).catch((err: Error) =>
    console.error(`[sync] delete ${collName}/${id}:`, err.message),
  );
}

// ─── Dexie → Firestore (hooks) ─────────────────────────────────────────────

function installHooks() {
  for (const collName of COLLECTIONS) {
    const table = tbl(collName);
    const col = collName; // capture in closure

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function onCreate(primKey: string, obj: Record<string, any>) {
      if (syncingIds.has(primKey)) { syncingIds.delete(primKey); return; }
      pushToCloud(col, primKey, obj);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function onUpdate(
      mods: Record<string, any>,
      primKey: string,
      obj: Record<string, any>,
    ) {
      if (syncingIds.has(primKey)) { syncingIds.delete(primKey); return; }
      pushToCloud(col, primKey, { ...obj, ...mods });
    }

    function onDelete(primKey: string) {
      if (syncingIds.has(primKey)) { syncingIds.delete(primKey); return; }
      deleteFromCloud(col, primKey);
    }

    table.hook('creating', onCreate);
    table.hook('updating', onUpdate);
    table.hook('deleting', onDelete);

    hookUnsubs.push(
      () => table.hook('creating').unsubscribe(onCreate),
      () => table.hook('updating').unsubscribe(onUpdate),
      () => table.hook('deleting').unsubscribe(onDelete),
    );
  }
}

// ─── Firestore → Dexie (listeners) ────────────────────────────────────────

function subscribeFarm(farmId: string) {
  for (const collName of COLLECTIONS) {
    const table = tbl(collName);
    const collRef = collection(firestore, 'farms', farmId, collName);

    const unsub = onSnapshot(
      collRef,
      async (snapshot) => {
        const changes = snapshot.docChanges();
        if (!changes.length) return;

        // Mark all IDs as syncing-from-cloud BEFORE any writes so the
        // Dexie hooks don't echo them back to Firestore.
        for (const change of changes) syncingIds.add(change.doc.id);

        // Batch all puts/deletes in one Dexie transaction so useLiveQuery
        // re-renders exactly once per snapshot event, not once per document.
        try {
          await db.transaction('rw', table, async () => {
            for (const change of changes) {
              const id = change.doc.id;
              if (change.type === 'added' || change.type === 'modified') {
                await table.put({ ...change.doc.data(), id });
              } else if (change.type === 'removed') {
                await table.delete(id);
              }
            }
          });
        } catch (err: unknown) {
          // On failure, clear the IDs so the hooks don't permanently suppress writes.
          for (const change of changes) syncingIds.delete(change.doc.id);
          console.error(`[sync] batch write to ${collName}:`, (err as Error).message);
        }
      },
      (err: Error) =>
        console.error(`[sync] snapshot(${collName}):`, err.message),
    );

    snapUnsubs.push(unsub);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export function startSync(farmId: string) {
  if (currentFarmId === farmId) return; // already running
  stopSync();
  currentFarmId = farmId;
  installHooks();
  subscribeFarm(farmId);
}

export function stopSync() {
  hookUnsubs.splice(0).forEach((fn) => fn());
  snapUnsubs.splice(0).forEach((fn) => fn());
  syncingIds.clear();
  currentFarmId = null;
}

/** Temporarily remove hooks during migration so we don't echo. */
function pauseHooks() {
  hookUnsubs.splice(0).forEach((fn) => fn());
}

function resumeHooks() {
  installHooks();
}

/**
 * One-time migration: batch-write all Dexie records to Firestore.
 * Dexie data is read-only during migration and NOT deleted afterward.
 */
export async function migrateToFirestore(
  farmId: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const CHUNK = 450; // stay under Firestore's 500-op batch limit

  pauseHooks();

  try {
    for (const collName of COLLECTIONS) {
      const table = tbl(collName);
      const records: Record<string, unknown>[] = await table.toArray();

      if (records.length === 0) continue;

      onProgress?.(
        `Uploading ${collName} (${records.length} record${records.length !== 1 ? 's' : ''})…`,
      );

      for (let i = 0; i < records.length; i += CHUNK) {
        const chunk = records.slice(i, i + CHUNK);
        const batch = writeBatch(firestore);

        for (const record of chunk) {
          const id = record.id as string;
          const ref = doc(firestore, 'farms', farmId, collName, id);
          batch.set(ref, clean(record));
        }

        await batch.commit();
      }
    }
  } finally {
    resumeHooks();
  }
}

/** Count local Dexie records (used to detect whether migration is needed). */
export async function countLocalRecords(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const collName of COLLECTIONS) {
    counts[collName] = await tbl(collName).count();
  }
  return counts;
}
