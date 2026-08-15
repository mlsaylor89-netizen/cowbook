import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  type Firestore,
} from 'firebase/firestore';
import { firebaseApp } from './firebase';

/**
 * Firestore singleton with single-tab offline persistence.
 *
 * The try/catch handles HMR in development: when Vite hot-reloads this
 * module, initializeFirestore throws "failed-precondition" because the
 * SDK was already initialized. getFirestore() returns the existing instance.
 *
 * NOTE: persistentMultipleTabManager is intentionally excluded —
 * it triggers an internal assertion failure in Firestore SDK 12.x.
 */
let _firestore: Firestore;
try {
  _firestore = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache(),
  });
} catch {
  _firestore = getFirestore(firebaseApp);
}

export const firestore = _firestore;
