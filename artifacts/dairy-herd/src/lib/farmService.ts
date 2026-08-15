import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './firestore';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FarmDoc {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  joinCode: string;
  createdAt: unknown;
}

export interface UserDoc {
  farmId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'member';
  joinedAt: unknown;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function generateJoinCode(): string {
  // Unambiguous characters (no 0/O, 1/I/l)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ─── Farm operations ───────────────────────────────────────────────────────

export async function createFarm(
  ownerId: string,
  email: string,
  displayName: string,
  farmName: string,
): Promise<{ farmId: string; joinCode: string }> {
  const farmRef = doc(collection(firestore, 'farms'));
  const farmId = farmRef.id;
  const joinCode = generateJoinCode();

  // Lookup document: code → farmId (readable by any authenticated user)
  await setDoc(doc(firestore, 'farmCodes', joinCode), { farmId });

  // Farm document
  await setDoc(farmRef, {
    name: farmName,
    ownerId,
    memberIds: [ownerId],
    joinCode,
    createdAt: serverTimestamp(),
  });

  // User's profile in Firestore
  await setDoc(doc(firestore, 'users', ownerId), {
    farmId,
    email,
    displayName,
    role: 'owner',
    joinedAt: serverTimestamp(),
  });

  return { farmId, joinCode };
}

export async function joinFarmByCode(
  uid: string,
  email: string,
  displayName: string,
  code: string,
): Promise<string> {
  const normalised = code.toUpperCase().trim();
  const codeSnap = await getDoc(doc(firestore, 'farmCodes', normalised));
  if (!codeSnap.exists()) throw new Error('Invalid join code – double-check and try again.');

  const { farmId } = codeSnap.data() as { farmId: string };

  // Add this user to the farm's member list
  await updateDoc(doc(firestore, 'farms', farmId), {
    memberIds: arrayUnion(uid),
  });

  // Create/overwrite the user's profile
  await setDoc(doc(firestore, 'users', uid), {
    farmId,
    email,
    displayName,
    role: 'member',
    joinedAt: serverTimestamp(),
  });

  return farmId;
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(firestore, 'users', uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

export async function getFarmDoc(farmId: string): Promise<FarmDoc | null> {
  const snap = await getDoc(doc(firestore, 'farms', farmId));
  return snap.exists() ? ({ id: farmId, ...snap.data() } as FarmDoc) : null;
}
