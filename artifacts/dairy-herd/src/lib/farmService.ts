import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  deleteField,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './firestore';

// ─── Types ─────────────────────────────────────────────────────────────────

export type MemberRole = 'owner' | 'full_access' | 'viewer';

export interface MemberDetail {
  uid: string;
  email: string;
  displayName: string;
  role: MemberRole;
  joinedAt: string; // ISO string – serverTimestamp not storable in a map value, so we use Date.now()
}

export interface FarmDoc {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  joinCode: string;
  memberDetails: Record<string, MemberDetail>; // keyed by uid
  createdAt: unknown;
}

export interface UserDoc {
  farmId: string;
  email: string;
  displayName: string;
  role: MemberRole | 'member'; // 'member' kept for backward-compat
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

export function normaliseRole(role: string): MemberRole {
  if (role === 'owner') return 'owner';
  if (role === 'viewer') return 'viewer';
  return 'full_access'; // 'member' + anything else → full_access
}

export function roleLabel(role: string): string {
  if (role === 'owner') return 'Owner';
  if (role === 'viewer') return 'Viewer';
  return 'Full Access';
}

// ─── Farm creation ─────────────────────────────────────────────────────────

/**
 * Create a new farm.
 * Uses a batch write so all three documents (farmCode, farm, user profile)
 * land atomically in one server round-trip. No subcollection is written,
 * so there are no security-rule timing issues.
 */
export async function createFarm(
  ownerId: string,
  email: string,
  displayName: string,
  farmName: string,
): Promise<{ farmId: string; joinCode: string }> {
  const farmRef = doc(collection(firestore, 'farms'));
  const farmId = farmRef.id;
  const joinCode = generateJoinCode();
  const now = new Date().toISOString();

  const ownerDetail: MemberDetail = {
    uid: ownerId,
    email,
    displayName: displayName || email,
    role: 'owner',
    joinedAt: now,
  };

  // Three independent docs — no cross-dependencies so sequential writes are safe.
  // (writeBatch + persistentMultipleTabManager triggers an internal assertion in
  //  Firestore SDK 12.x, so we avoid batches here.)

  // 1. Join-code lookup doc
  await setDoc(doc(firestore, 'farmCodes', joinCode), { farmId });

  // 2. Farm document (member details embedded — no subcollection needed)
  await setDoc(farmRef, {
    name: farmName,
    ownerId,
    memberIds: [ownerId],
    joinCode,
    memberDetails: { [ownerId]: ownerDetail },
    createdAt: serverTimestamp(),
  });

  // 3. User profile
  await setDoc(doc(firestore, 'users', ownerId), {
    farmId,
    email,
    displayName: displayName || email,
    role: 'owner' as MemberRole,
    joinedAt: serverTimestamp(),
  });

  return { farmId, joinCode };
}

// ─── Joining ───────────────────────────────────────────────────────────────

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

  const farmSnap = await getDoc(doc(firestore, 'farms', farmId));
  if (!farmSnap.exists()) throw new Error('Farm not found – the join code may be outdated.');

  const now = new Date().toISOString();
  const memberDetail: MemberDetail = {
    uid,
    email,
    displayName: displayName || email,
    role: 'full_access',
    joinedAt: now,
  };

  // Add uid to memberIds array and write detail into the memberDetails map
  await updateDoc(doc(firestore, 'farms', farmId), {
    memberIds: arrayUnion(uid),
    [`memberDetails.${uid}`]: memberDetail,
  });

  // Write user profile
  await setDoc(doc(firestore, 'users', uid), {
    farmId,
    email,
    displayName: displayName || email,
    role: 'full_access' as MemberRole,
    joinedAt: serverTimestamp(),
  });

  return farmId;
}

// ─── Member management (owner only) ───────────────────────────────────────

/** Read member list from the farm's memberDetails map. */
export async function listFarmMembers(farmId: string): Promise<MemberDetail[]> {
  const snap = await getDoc(doc(firestore, 'farms', farmId));
  if (!snap.exists()) return [];
  const data = snap.data() as FarmDoc;
  const details = data.memberDetails ?? {};
  return Object.values(details).sort((a, b) => {
    if (a.role === 'owner') return -1;
    if (b.role === 'owner') return 1;
    return (a.displayName || a.email).localeCompare(b.displayName || b.email);
  });
}

/** Remove a member. Owner-only. */
export async function removeFarmMember(farmId: string, uid: string): Promise<void> {
  await updateDoc(doc(firestore, 'farms', farmId), {
    memberIds: arrayRemove(uid),
    [`memberDetails.${uid}`]: deleteField(),
  });
}

/** Change a member's role. Owner-only. */
export async function updateMemberRole(
  farmId: string,
  uid: string,
  role: MemberRole,
): Promise<void> {
  await updateDoc(doc(firestore, 'farms', farmId), {
    [`memberDetails.${uid}.role`]: role,
  });
  // Best-effort update on user's own profile
  try {
    await updateDoc(doc(firestore, 'users', uid), { role });
  } catch {
    // Non-fatal
  }
}

/**
 * Regenerate the farm's join code.
 * Deletes the old farmCodes lookup, creates a new one, updates the farm.
 */
export async function regenerateJoinCode(
  farmId: string,
  currentCode: string,
): Promise<string> {
  const newCode = generateJoinCode();
  await deleteDoc(doc(firestore, 'farmCodes', currentCode));
  await setDoc(doc(firestore, 'farmCodes', newCode), { farmId });
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
