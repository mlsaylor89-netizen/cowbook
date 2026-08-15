import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { getUserDoc } from '@/lib/farmService';
import { startSync, stopSync } from '@/lib/syncService';
import { AuthContext } from '@/contexts/authContextInstance';

const auth = getAuth(firebaseApp);

// ─── Provider ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserDoc = useCallback(async (u: User) => {
    const doc = await getUserDoc(u.uid);
    setUserDoc(doc);
    if (doc?.farmId) {
      startSync(doc.farmId);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          // Race against a hard timeout so a hanging Firestore call (slow network,
          // permission error waiting on server, etc.) never freezes the spinner.
          await Promise.race([
            loadUserDoc(u),
            new Promise<void>((_, reject) =>
              setTimeout(
                () => reject(new Error('[auth] loadUserDoc timed out')),
                8000,
              ),
            ),
          ]);
        } catch (err) {
          console.error('[auth] Failed to load user doc:', err);
        }
      } else {
        setUserDoc(null);
        stopSync();
      }
      setLoading(false);
    });
    return unsub;
  }, [loadUserDoc]);

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signup(email: string, password: string, displayName: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
  }

  async function logout() {
    stopSync();
    await signOut(auth);
    setUser(null);
    setUserDoc(null);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  async function refreshUserDoc() {
    if (user) await loadUserDoc(user);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userDoc,
        farmId: userDoc?.farmId ?? null,
        loading,
        login,
        signup,
        logout,
        resetPassword,
        refreshUserDoc,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

