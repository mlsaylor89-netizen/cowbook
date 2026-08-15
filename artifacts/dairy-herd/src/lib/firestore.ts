import {
  initializeFirestore,
  persistentLocalCache,
} from 'firebase/firestore';
import { firebaseApp } from './firebase';

/**
 * Firestore instance with single-tab offline persistence.
 * Uses IndexedDB as the local cache so herd data is available
 * even when the device has no internet connection.
 *
 * NOTE: persistentMultipleTabManager is intentionally excluded —
 * it triggers an internal assertion failure in Firestore SDK 12.x
 * when combined with writeBatch or concurrent writes.
 */
export const firestore = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache(),
});
