 import {
  collection,
  query,
  orderBy,
  limit as qLimit,
  onSnapshot,
  addDoc,
  getDocs,
  startAfter as qStartAfter,
} from "firebase/firestore";
import { db, ts } from "./firebase";

function groupSlug(name) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase();
}

export function sendGroupMessage(groupName, payload) {
  const slug = groupSlug(groupName);
  const col = collection(db, `groups`, slug, "messages");
  const doc = {
    text: payload.text,
    uid: payload.uid || null,
    username: payload.username || "",
    photoURL: payload.photoURL || null,
    createdAt: ts(),
    replyTo: payload.replyTo || null,
  };
  return addDoc(col, doc);
}

export function listenGroupMessages(groupName, onUpdate, pageSize = 30) {
  const slug = groupSlug(groupName);
  const col = collection(db, `groups`, slug, "messages");
  const q = query(col, orderBy("createdAt", "desc"), qLimit(pageSize));
  const unsub = onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // client expects chronological order (old -> new)
    onUpdate(msgs.reverse(), snap.docs[snap.docs.length - 1] || null);
  });
  return unsub;
}

export async function loadOlderMessages(groupName, lastVisibleDoc, pageSize = 30) {
  if (!lastVisibleDoc) return { docs: [], last: null };
  const slug = groupSlug(groupName);
  const col = collection(db, `groups`, slug, "messages");
  const q = query(col, orderBy("createdAt", "desc"), qStartAfter(lastVisibleDoc), qLimit(pageSize));
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return { docs: docs.reverse(), last: snap.docs[snap.docs.length - 1] || null };
}
