import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./AdminApp.css";

// Anyone can land here - the passcode gate doesn't require a real
// Anime-space account, so a visitor with no session yet is signed in
// anonymously purely to get a request.auth.uid the rules can scope the
// adminUnlocks doc to. A user already signed into a real account keeps
// using that uid instead (checked first).
function useAdminUid() {
  const [uid, setUid] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid);
        return;
      }
      try {
        const credential = await signInAnonymously(auth);
        setUid(credential.user.uid);
      } catch (error) {
        console.error("anonymous sign-in failed", error);
      }
    });
    return unsub;
  }, []);

  return uid;
}

function AdminGate({ uid, onUnlocked }) {
  const [checking, setChecking] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "adminUnlocks", uid));
        if (!cancelled && snap.exists()) onUnlocked();
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, onUnlocked]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await setDoc(doc(db, "adminUnlocks", uid), { passcode, unlockedAt: serverTimestamp() });
      onUnlocked();
    } catch (err) {
      console.error("admin unlock failed", err);
      setError("Incorrect passcode.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="admin-shell">
        <div className="admin-loading"><div className="spinner spinner-lg" /></div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <form className="admin-gate-card" onSubmit={handleSubmit}>
        <h1>Admin access</h1>
        <p>Enter the passcode to view feedback.</p>
        <input
          type="password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          placeholder="Passcode"
          autoFocus
          required
        />
        {error && <div className="admin-error">{error}</div>}
        <button type="submit" disabled={submitting}>{submitting ? "Checking…" : "Proceed"}</button>
      </form>
    </div>
  );
}

function AdminDashboard() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "feedback"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFeedback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("feedback listen failed", err);
        setError(true);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return (
    <div className="admin-shell admin-dashboard">
      <header className="admin-header">
        <h1>Feedback</h1>
        <div className="admin-count">{feedback.length} total</div>
      </header>

      {loading ? (
        <div className="admin-loading"><div className="spinner spinner-lg" /></div>
      ) : error ? (
        <div className="admin-empty">Failed to load feedback.</div>
      ) : feedback.length === 0 ? (
        <div className="admin-empty">No feedback yet.</div>
      ) : (
        <div className="feedback-list">
          {feedback.map((item) => (
            <div key={item.id} className="feedback-card">
              <div className="feedback-meta">
                <span className="feedback-user">{item.username || "Anonymous"}</span>
                <span className="feedback-clan">{item.clan || "General"}</span>
              </div>
              <p className="feedback-text">{item.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminApp() {
  const uid = useAdminUid();
  const [unlocked, setUnlocked] = useState(false);
  const handleUnlocked = useCallback(() => setUnlocked(true), []);

  if (!uid) {
    return (
      <div className="admin-shell">
        <div className="admin-loading"><div className="spinner spinner-lg" /></div>
      </div>
    );
  }

  return unlocked ? <AdminDashboard /> : <AdminGate uid={uid} onUnlocked={handleUnlocked} />;
}
