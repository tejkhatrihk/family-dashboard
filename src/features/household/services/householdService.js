import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "../../../shared/api/firebaseClient";

const MEMBER_COLORS = ["#2a9d8f", "#ed4b36", "#3f63df", "#8a7132"];

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function createInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

function memberColor(identity, role) {
  if (role === "owner") return MEMBER_COLORS[0];
  const colorIndex =
    1 +
    [...identity].reduce(
      (total, character) => total + character.charCodeAt(0),
      0,
    ) %
      (MEMBER_COLORS.length - 1);
  return MEMBER_COLORS[colorIndex];
}

function memberFromUser(user, role, inviteCode = null) {
  return {
    uid: user.uid,
    email: normalizeEmail(user.email || ""),
    displayName: user.displayName || user.email || "Family member",
    photoURL: user.photoURL || "",
    calendarId: normalizeEmail(user.email || "") || "primary",
    color: memberColor(user.uid, role),
    role,
    memberType: "account",
    canSignIn: true,
    joinedAt: serverTimestamp(),
    ...(inviteCode && { inviteCode }),
  };
}

export async function createManagedHouseholdMember(
  householdId,
  displayName,
  user,
) {
  const memberRef = doc(
    collection(firestore, "households", householdId, "members"),
  );
  const memberId = memberRef.id;
  await setDoc(memberRef, {
    uid: memberId,
    email: "",
    displayName: displayName.trim(),
    photoURL: "",
    calendarId: normalizeEmail(user.email || "") || "primary",
    color: memberColor(memberId, "member"),
    role: "member",
    memberType: "managed",
    canSignIn: false,
    createdBy: user.uid,
    joinedAt: serverTimestamp(),
  });
  return memberId;
}

export async function createHousehold(name, user) {
  const householdRef = doc(collection(firestore, "households"));
  const memberRef = doc(householdRef, "members", user.uid);
  const userRef = doc(firestore, "users", user.uid);
  const batch = writeBatch(firestore);

  batch.set(householdRef, {
    name: name.trim(),
    ownerId: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(memberRef, memberFromUser(user, "owner"));
  batch.set(
    userRef,
    {
      currentHouseholdId: householdRef.id,
      householdIds: arrayUnion(householdRef.id),
    },
    { merge: true },
  );
  await batch.commit();
  return householdRef.id;
}

export async function createHouseholdInvite(householdId, email, user) {
  const code = createInviteCode();
  await setDoc(doc(firestore, "householdInvites", code), {
    code,
    householdId,
    email: normalizeEmail(email),
    invitedBy: user.uid,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return code;
}

export async function joinHousehold(inviteCode, user) {
  const code = inviteCode.trim().toUpperCase();
  const inviteRef = doc(firestore, "householdInvites", code);
  const inviteSnapshot = await getDoc(inviteRef);
  if (!inviteSnapshot.exists()) throw new Error("This invitation code is not valid.");

  const invite = inviteSnapshot.data();
  if (invite.status !== "pending") throw new Error("This invitation has already been used.");
  if (invite.email !== normalizeEmail(user.email || "")) {
    throw new Error("This invitation was created for a different email address.");
  }

  const memberRef = doc(
    firestore,
    "households",
    invite.householdId,
    "members",
    user.uid,
  );
  const userRef = doc(firestore, "users", user.uid);
  const batch = writeBatch(firestore);
  batch.set(memberRef, memberFromUser(user, "member", code));
  batch.set(
    userRef,
    {
      currentHouseholdId: invite.householdId,
      householdIds: arrayUnion(invite.householdId),
    },
    { merge: true },
  );
  batch.update(inviteRef, {
    status: "accepted",
    acceptedBy: user.uid,
    acceptedAt: serverTimestamp(),
  });
  await batch.commit();
  return invite.householdId;
}

export function subscribeToUserProfile(uid, onValue, onError) {
  return onSnapshot(doc(firestore, "users", uid), onValue, onError);
}

export function subscribeToHousehold(householdId, onValue, onError) {
  return onSnapshot(doc(firestore, "households", householdId), onValue, onError);
}

export function subscribeToHouseholdMembers(householdId, onValue, onError) {
  return onSnapshot(
    collection(firestore, "households", householdId, "members"),
    onValue,
    onError,
  );
}

export function subscribeToHouseholdInvites(householdId, onValue, onError) {
  const invitesQuery = query(
    collection(firestore, "householdInvites"),
    where("householdId", "==", householdId),
    where("status", "==", "pending"),
  );
  return onSnapshot(invitesQuery, onValue, onError);
}

export async function updateMemberProfile(householdId, uid, changes) {
  await updateDoc(
    doc(firestore, "households", householdId, "members", uid),
    changes,
  );
}
