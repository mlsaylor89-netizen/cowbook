/**
 * Isolated module — only creates the AuthContext instance.
 * Kept separate so Fast Refresh never re-runs createContext(),
 * which would produce a new context reference and break all consumers.
 */
import { createContext } from 'react';
import type { User } from 'firebase/auth';
import type { UserDoc } from '@/lib/farmService';

export interface AuthContextValue {
  user: User | null;
  userDoc: UserDoc | null;
  farmId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserDoc: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
