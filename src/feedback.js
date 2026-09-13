import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// Write-only from the app's own perspective - see the `feedback` rule in
// firestore.rules. Nobody, including the author, can read these back
// through the normal app; only an unlocked /admin session can.
export function submitFeedback({ uid, username, clan, text }) {
  return addDoc(collection(db, "feedback"), {
    uid,
    username: username || "",
    clan: clan || null,
    text,
    createdAt: serverTimestamp(),
  });
}
