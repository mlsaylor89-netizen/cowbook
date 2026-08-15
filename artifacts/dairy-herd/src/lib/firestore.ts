import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { firebaseApp } from './firebase';

/**
 * Firestore singleton with IndexedDB-backed persistent cache.
 *
 * persistentLocalCache means the initial 16-collection snapshot is served
 * from IndexedDB on every session after the first, eliminating the burst of
 * Dexie write transactions that previously blocked useLiveQuery calls and
 * made pages appear to load forever.
 *
 * forceOwnership: true lets this tab claim the IndexedDB lock even if a
 * stale lock from a previous session or crashed tab is present — this is
 * what previously caused "failed-precondition" write hangs when the app
 * used persistentMultipleTabManager. Single-tab mode + forceOwnership avoids
 * that entirely.
 *
 * The stale databases from the old persistentMultipleTabManager config are
 * deleted in main.tsx before this module runs.
 *
 * The try/catch handles HMR: Vite hot-reloads re-run this module, but
 * initializeFirestore throws if the SDK is already initialised for this app.
 */
let _firestore: Firestore;
try {
  _firestore = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({ forceOwnership: true }),
    }),
  });
} catch {
  _firestore = getFirestore(firebaseApp);
}

export const firestore = _firestore;

/**
 * Attempt to delete stale Firestore IndexedDB databases left by the
 * previous app version (which used persistentMultipleTabManager).
 * Called once at startup; runs silently in the background.
 */
export function clearStaleFirestoreCache(projectId: string): void {
  const dbNames = [
    `firestore/${projectId}/(default)/main`,
    `firestore/${projectId}/(default)/metadata`,
  ];
  for (const name of dbNames) {
    try { indexedDB.deleteDatabase(name); } catch { /* ignore */ }
  }
}
