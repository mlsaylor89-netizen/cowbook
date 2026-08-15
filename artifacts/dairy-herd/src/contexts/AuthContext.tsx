import React, {
  createContext,
  useCallback,
  useContext,
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
  type User,
} from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { type UserDoc, getUserDoc } from '@/lib/farmService';
import { startSync, stopSync } from '@/lib/syncService';

const auth = getAuth(firebaseApp);

// ─── Context type ─────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  userDoc: UserDoc | null;
  farmId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Creates the Firebase Auth account only – farm setup follows separately. */
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Call after creating / joining a farm to refresh userData. */
  refreshUserDoc: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
        await loadUserDoc(u);
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

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
