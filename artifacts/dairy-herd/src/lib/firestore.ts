import {
  initializeFirestore,
  getFirestore,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';
import { firebaseApp } from './firebase';

/**
 * Firestore singleton using in-memory cache.
 *
 * We intentionally avoid IndexedDB persistence (persistentLocalCache) here
 * because stale IndexedDB locks left by the previous app version cause
 * failed-precondition errors that make every Firestore write hang
 * indefinitely. Offline storage for herd data is handled by Dexie.js,
 * so Firestore only needs to be a reliable sync channel — memory cache
 * is sufficient for that role.
 *
 * The try/catch handles HMR: Vite hot-reloads re-run this module, but
 * initializeFirestore throws if the SDK is already initialised for this
 * app. getFirestore() returns the existing instance in that case.
 */
let _firestore: Firestore;
try {
  _firestore = initializeFirestore(firebaseApp, {
    localCache: memoryLocalCache(),
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
