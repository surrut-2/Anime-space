import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword as fbSignInWithEmail,
  createUserWithEmailAndPassword as fbCreateUserWithEmail,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db, ts } from "./firebase";

const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function signInWithEmail(email, password) {
  return fbSignInWithEmail(auth, email, password);
}

export function createUserWithEmail(email, password) {
  return fbCreateUserWithEmail(auth, email, password);
}

export function signOutUser() {
  return fbSignOut(auth);
}

export function onAuthStateChanged(cb) {
  return fbOnAuthStateChanged(auth, cb);
}

// Firestore: users collection helpers
export async function createOrUpdateUserDoc(user) {
  if (!user) return { isNew: false };
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const now = ts();
  if (!snap.exists()) {
    // new user: create doc and auto-join General group
    await setDoc(ref, {
      username: user.displayName || "",
      email: user.email || "",
      lastLogin: now,
      createdAt: now,
      groups: [
        { name: "General group", type: "general", joinedAt: now },
      ],
    });
    return { isNew: true };
  } else {
    // ensure lastLogin is updated and General group exists
    const data = snap.data() || {};
    const groups = data.groups || [];
    const hasGeneral = groups.some((g) => g && g.name === "General group");
    if (!hasGeneral) {
      const newGroups = [...groups, { name: "General group", type: "general", joinedAt: now }];
      await updateDoc(ref, { lastLogin: now, groups: newGroups });
    } else {
      await updateDoc(ref, { lastLogin: now });
    }
    return { isNew: false };
  }
}

export async function getUserGroups(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data();
  return data.groups || [];
}

export async function joinGroup(uid, groupName, type = "exclusive") {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User doc not found");
  const data = snap.data();
  const groups = data.groups || [];
  const now = ts();

  // If joining general, ensure it's present
  if (type === "general") {
    if (groups.some((g) => g && g.name === groupName)) return;
    const newGroups = [...groups, { name: groupName, type: "general", joinedAt: now }];
    await updateDoc(ref, { groups: newGroups });
    return;
  }

  // exclusive: remove any other exclusive groups
  const filtered = groups.filter((g) => !(g && g.type === "exclusive"));
  filtered.push({ name: groupName, type: "exclusive", joinedAt: now });
  await updateDoc(ref, { groups: filtered });
}

export async function leaveGroup(uid, groupName) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User doc not found");
  const data = snap.data();
  const groups = data.groups || [];
  const newGroups = groups.filter((g) => !(g && g.name === groupName));
  await updateDoc(ref, { groups: newGroups });
}

export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function updateUsername(uid, username) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { username });
}

export async function setUserGroupData(uid, groupName) {
  const ref = doc(db, "users", uid);
  const now = ts();
  await updateDoc(ref, { groupData: { groupName, joinedAt: now } });
}
