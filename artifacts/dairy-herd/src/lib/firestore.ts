import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { firebaseApp } from './firebase';

/**
 * Firestore instance with multi-tab offline persistence.
 * Uses IndexedDB as the local cache so herd data is available
 * even when the device has no internet connection.
 */
export const firestore = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
