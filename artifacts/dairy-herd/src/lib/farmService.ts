import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './firestore';

// ─── Types ─────────────────────────────────────────────────────────────────

export type MemberRole = 'owner' | 'full_access' | 'viewer';

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
  role: MemberRole | 'member'; // 'member' kept for backward-compat
  joinedAt: unknown;
}

export interface MemberDoc {
  uid: string;
  email: string;
  displayName: string;
  role: MemberRole;
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

/** Normalise legacy 'member' role to 'full_access'. */
export function normaliseRole(role: string): MemberRole {
  return role === 'owner' ? 'owner' : 'full_access';
}

export function roleLabel(role: string): string {
  return role === 'owner' ? 'Owner' : 'Full Access';
}

// ─── Farm creation / joining ───────────────────────────────────────────────

export async function createFarm(
  ownerId: string,
  email: string,
  displayName: string,
  farmName: string,
): Promise<{ farmId: string; joinCode: string }> {
  const farmRef = doc(collection(firestore, 'farms'));
  const farmId = farmRef.id;
  const joinCode = generateJoinCode();

  // 1. Join-code lookup document
  await setDoc(doc(firestore, 'farmCodes', joinCode), { farmId });

  // 2. Farm document
  await setDoc(farmRef, {
    name: farmName,
    ownerId,
    memberIds: [ownerId],
    joinCode,
    createdAt: serverTimestamp(),
  });

  const now = serverTimestamp();

  // 3. Owner's user profile
  await setDoc(doc(firestore, 'users', ownerId), {
    farmId,
    email,
    displayName,
    role: 'owner' as MemberRole,
    joinedAt: now,
  });

  // 4. Farm members subcollection (enables owner to list/manage members)
  await setDoc(doc(firestore, 'farms', farmId, 'members', ownerId), {
    uid: ownerId,
    email,
    displayName,
    role: 'owner' as MemberRole,
    joinedAt: now,
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

  // Verify the farm still exists
  const farmSnap = await getDoc(doc(firestore, 'farms', farmId));
  if (!farmSnap.exists()) throw new Error('Farm not found – the join code may be outdated.');

  const now = serverTimestamp();

  // Add uid to farm's memberIds array
  await updateDoc(doc(firestore, 'farms', farmId), {
    memberIds: arrayUnion(uid),
  });

  // Write user profile
  await setDoc(doc(firestore, 'users', uid), {
    farmId,
    email,
    displayName,
    role: 'full_access' as MemberRole,
    joinedAt: now,
  });

  // Write to farm members subcollection
  await setDoc(doc(firestore, 'farms', farmId, 'members', uid), {
    uid,
    email,
    displayName,
    role: 'full_access' as MemberRole,
    joinedAt: now,
  });

  return farmId;
}

// ─── Member management (owner only) ───────────────────────────────────────

/** List all members of a farm from the members subcollection. */
export async function listFarmMembers(farmId: string): Promise<MemberDoc[]> {
  const snap = await getDocs(collection(firestore, 'farms', farmId, 'members'));
  return snap.docs.map(d => d.data() as MemberDoc);
}

/** Remove a member from the farm. Only the farm owner should call this. */
export async function removeFarmMember(farmId: string, uid: string): Promise<void> {
  // Remove from farm's memberIds array
  await updateDoc(doc(firestore, 'farms', farmId), {
    memberIds: arrayRemove(uid),
  });
  // Delete from members subcollection
  await deleteDoc(doc(firestore, 'farms', farmId, 'members', uid));
}

/** Change a member's role. Only the farm owner should call this. */
export async function updateMemberRole(
  farmId: string,
  uid: string,
  role: MemberRole,
): Promise<void> {
  // Update in members subcollection
  await updateDoc(doc(firestore, 'farms', farmId, 'members', uid), { role });
  // Best-effort update on the user's own profile (may fail if rules tighten later)
  try {
    await updateDoc(doc(firestore, 'users', uid), { role });
  } catch {
    // Non-fatal: member subcollection is the source of truth for display
  }
}

/**
 * Regenerate the farm's join code.
 * Deletes the old farmCodes lookup doc, creates a new one, updates the farm.
 */
export async function regenerateJoinCode(
  farmId: string,
  currentCode: string,
): Promise<string> {
  const newCode = generateJoinCode();

  // Remove old lookup
  await deleteDoc(doc(firestore, 'farmCodes', currentCode));
  // Create new lookup
  await setDoc(doc(firestore, 'farmCodes', newCode), { farmId });
  // Update farm document
  await updateDoc(doc(firestore, 'farms', farmId), { joinCode: newCode });

  return newCode;
}

// ─── Read helpers ──────────────────────────────────────────────────────────

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(firestore, 'users', uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

export async function getFarmDoc(farmId: string): Promise<FarmDoc | null> {
  const snap = await getDoc(doc(firestore, 'farms', farmId));
  return snap.exists() ? ({ id: farmId, ...snap.data() } as FarmDoc) : null;
}
