import { useState, useEffect, useLayoutEffect, useRef, Fragment } from "react";
import "./App.css";
import {
  signInWithGoogle,
  signInWithEmail,
  createUserWithEmail,
  signOutUser,
  onAuthStateChanged,
  createOrUpdateUserDoc,
  getUserDoc,
  updateUsername,
  joinGroup,
  setUserGroupData,
} from "./auth";
import { useToast } from "./toast.jsx";
import { sendGroupMessage, listenGroupMessages, loadOlderMessages } from "./messages";

const GENERAL_GROUP = "General group";

const GROUPS = [
  { id: 1, name: GENERAL_GROUP, type: "general" },
  { id: 2, name: "Bleach", type: "exclusive" },
  { id: 3, name: "Naruto", type: "exclusive" },
  { id: 4, name: "One Piece", type: "exclusive" },
];

const EXCLUSIVE_GROUPS = GROUPS.filter((g) => g.type === "exclusive");

// Splits message text into text/link pieces. A |url| pair is treated as an
// explicit link (inserted via the toolbar's link button); bare http(s)/www
// links outside of pipes are auto-detected too.
function parseMessage(text) {
  if (!text) return [{ type: "text", content: "" }];

  const pipeRegex = /\|([^|]+)\|/g;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = [];
  let lastIndex = 0;
  let match;

  function pushPlainSegment(segment) {
    let segLast = 0;
    let m;
    urlRegex.lastIndex = 0;
    while ((m = urlRegex.exec(segment)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (start > segLast) parts.push({ type: "text", content: segment.slice(segLast, start) });
      const href = /^https?:\/\//i.test(m[0]) ? m[0] : `https://${m[0]}`;
      parts.push({ type: "link", content: m[0], href });
      segLast = end;
    }
    if (segLast < segment.length) parts.push({ type: "text", content: segment.slice(segLast) });
  }

  while ((match = pipeRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > lastIndex) pushPlainSegment(text.slice(lastIndex, start));
    const rawLink = match[1].trim();
    if (rawLink) {
      const href = /^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`;
      parts.push({ type: "link", content: rawLink, href });
    }
    lastIndex = end;
  }
  if (lastIndex < text.length) pushPlainSegment(text.slice(lastIndex));

  return parts.length ? parts : [{ type: "text", content: text }];
}

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </svg>
);

const ChatsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.38 8.5 8.5 0 0 1-4-1L3 20l1.12-5.5A8.38 8.38 0 1 1 21 11.5z" />
  </svg>
);

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4" />
    <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L13 20" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22l-4-9-9-4 20-7z" />
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const ReplyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7" />
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
);

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-2 3.1l3.2 2.5c1.9-1.7 3-4.2 3-7.2 0-.7-.1-1.4-.2-2.1H12z" />
    <path fill="#34A853" d="M12 21c2.7 0 5-.9 6.7-2.5l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.2H.8v2.7A9 9 0 0 0 12 21z" />
    <path fill="#FBBC05" d="M6.2 15.8A5.7 5.7 0 0 1 5.9 12c0-.6.1-1.2.3-1.8V7.5H2.5A9 9 0 0 0 .8 12c0 1.4.3 2.8.8 4l5.6-2.2z" />
    <path fill="#4285F4" d="M12 4.5c1.3 0 2.5.5 3.4 1.3l2.5-2.5A8.9 8.9 0 0 0 12 1.8 9 9 0 0 0 2.5 7.5l5.7 3.7c.8-2.4 3.1-4.1 5.8-4.1z" />
  </svg>
);

function NavBar({ active, onNavigate, orientation = "horizontal" }) {
  const items = [
    { key: "groups", label: "Home", icon: <HomeIcon /> },
    { key: "chats", label: "Chats", icon: <ChatsIcon /> },
    { key: "profile", label: "Profile", icon: <ProfileIcon /> },
  ];

  return (
    <nav className={`app-nav ${orientation}`}>
      {items.map((item) => (
        <button key={item.key} type="button" className={`nav-item ${active === item.key ? "active" : ""}`} onClick={() => onNavigate(item.key)}>
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function GroupsScreen({ userDoc, onOpenChat, onOpenProfile, latestPerGroup, activeGroup }) {
  const clanName = userDoc?.groupData?.groupName;
  const items = [
    { name: GENERAL_GROUP, subtitle: "Open discussion" },
    ...(clanName ? [{ name: clanName, subtitle: "Your clan" }] : []),
  ];

  return (
    <section className="screen">
      <div className="chat-header">
        <div className="chat-title">
          <div className="name">Anime circles</div>
        </div>
        <button className="icon-btn" type="button" onClick={onOpenProfile} title="Profile">
          <ProfileIcon />
        </button>
      </div>

      <div className="group-list">
        {items.map((item) => {
          const latest = latestPerGroup?.[item.name];
          const loading = !(item.name in (latestPerGroup || {}));
          return (
            <button
              key={item.name}
              type="button"
              className={`group-card ${activeGroup === item.name ? "active" : ""}`}
              onClick={() => onOpenChat(item.name)}
            >
              <div className="group-avatar">{item.name.charAt(0)}</div>
              <div className="group-copy">
                <strong>{item.name}</strong>
                {loading ? (
                  <span className="group-preview-skeleton" />
                ) : (
                  <small>{latest ? `${latest.username || "Someone"}: ${latest.text}` : item.subtitle}</small>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function OnboardingScreen({ user, groups, onChoose, submitting }) {
  return (
    <section className="screen">
      <div className="auth-screen">
        <div className="auth-heading">
          <h1>Pick your clan</h1>
          <div className="onboarding-warning">
            <strong>Once you choose a group, it becomes your clan and cannot be changed.</strong>
          </div>
        </div>
        <div className="group-list">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className="group-card group-card--selectable"
              onClick={() => onChoose(group)}
              disabled={submitting}
            >
              <div className="group-avatar">{group.name.charAt(0)}</div>
              <div className="group-copy">
                <strong>{group.name}</strong>
                <small>Exclusive clan</small>
              </div>
            </button>
          ))}
        </div>
        {submitting && <div className="spinner" />}
        <div className="onboarding-footer">Signed in as {user?.email || "user"}</div>
      </div>
    </section>
  );
}

function MessageBubble({ msg, isOwn, showHeader, onCopy, onReply, onScrollToRef }) {
  const [showActions, setShowActions] = useState(false);

  function renderParsedText(text) {
    const pieces = parseMessage(text || "");
    return pieces.map((piece, index) => {
      if (piece.type === "link") {
        return (
          <a key={`link-${index}`} href={piece.href} target="_blank" rel="noreferrer">
            {piece.content}
          </a>
        );
      }
      return <Fragment key={`text-${index}`}>{piece.content}</Fragment>;
    });
  }

  return (
    <div className={`msg-row ${isOwn ? "own" : "other"} ${showHeader ? "" : "grouped"}`}>
      <div className="msg-meta">
        {showHeader && (msg.photoURL ? <img src={msg.photoURL} alt="" className="msg-avatar" /> : <ProfileIcon />)}
      </div>
      <div className="msg-wrap">
        {showHeader && <div className="msg-username">{msg.username || "Anonymous"}</div>}
        {msg.replyTo && (
          <div className="msg-reply" onClick={() => onScrollToRef && onScrollToRef(msg.replyTo.id)}>
            <div className="msg-reply-text"><strong>{msg.replyTo.username || "Anonymous"}:</strong> {msg.replyTo.text}</div>
          </div>
        )}
        <div className={`msg-bubble ${isOwn ? "own-bubble" : "other-bubble"}`} onClick={() => setShowActions((value) => !value)}>
          {renderParsedText(msg.text)}
        </div>
        <div className={`bubble-actions ${showActions ? "visible" : ""}`}>
          <button type="button" className="action" onClick={() => onCopy && onCopy(msg)} title="Copy">
            <CopyIcon />
          </button>
          <button type="button" className="action" onClick={() => onReply && onReply(msg)} title="Reply">
            <ReplyIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatScreen({ group, onBack, showBack = true, onSend, user, username }) {
  const [messages, setMessages] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const [replyTo, setReplyTo] = useState(null);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const messagesRef = useRef(null);
  const messageRefs = useRef({});
  const isNearBottomRef = useRef(true);
  const pendingPrependRef = useRef(null);
  const loadingRef = useRef(false);
  const { showToast } = useToast();

  // This component is remounted (via a `key={group}` on the parent) whenever
  // the open group changes, so a fresh subscription on mount is all that's
  // needed here — no manual state reset required when switching groups.
  useEffect(() => {
    const unsub = listenGroupMessages(group, (msgs, lastDoc) => {
      setMessages(msgs || []);
      setLastVisible(lastDoc || null);
      setHasMore(Boolean(lastDoc));
      setIsMessagesLoading(false);
    });
    return () => unsub && unsub();
  }, [group]);

  // Keep the scroll position stable across message-list changes: stick to
  // the bottom for new/initial messages (only if the user was already near
  // the bottom), and preserve the visual position when older messages are
  // prepended so the view never jumps.
  useLayoutEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    if (pendingPrependRef.current) {
      const { scrollHeight: prevHeight, scrollTop: prevTop } = pendingPrependRef.current;
      container.scrollTop = container.scrollHeight - prevHeight + prevTop;
      pendingPrependRef.current = null;
    } else if (isNearBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  async function loadMore() {
    if (!hasMore || loadingRef.current) return;
    setLoadingMore(true);
    try {
      const response = await loadOlderMessages(group, lastVisible, 30);
      if (response.docs.length) {
        setMessages((items) => [...response.docs, ...items]);
        setLastVisible(response.last || null);
        setHasMore(Boolean(response.last));
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("load older failed", error);
      showToast("Failed to load more messages", "error");
    }
    setLoadingMore(false);
  }

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;

    const onScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      isNearBottomRef.current = distanceFromBottom < 120;

      if (container.scrollTop <= 120 && hasMore && !loadingRef.current) {
        loadingRef.current = true;
        pendingPrependRef.current = { scrollHeight: container.scrollHeight, scrollTop: container.scrollTop };
        loadMore().finally(() => {
          loadingRef.current = false;
        });
      }
    };

    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, lastVisible]);

  function copyMessage(msg) {
    if (navigator.clipboard) navigator.clipboard.writeText(msg.text).then(() => showToast("Copied", "success"));
  }

  function scrollToMessage(id) {
    const el = messageRefs.current[id];
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const handleInsertLink = () => {
    const insertion = "|  |";
    const nextValue = input + insertion;
    setInput(nextValue);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const caretPos = nextValue.length - 3;
      el.focus();
      el.setSelectionRange(caretPos, caretPos);
    });
  };

  const handleSend = () => {
    const value = input.trim();
    if (!value || !user) return;
    const payload = {
      text: value,
      uid: user.uid,
      username: username || user.displayName || "",
      photoURL: user.photoURL || null,
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, username: replyTo.username || "Anonymous" } : null,
    };
    setInput("");
    inputRef.current?.focus();
    onSend(payload)
      .then(() => setReplyTo(null))
      .catch((error) => {
        console.error("send message failed", error);
        showToast(error.message || "Failed to send", "error");
      });
  };

  return (
    <section className="screen">
      <div className="chat-header">
        {showBack && (
          <button type="button" className="icon-btn" onClick={onBack}>
            <BackIcon />
          </button>
        )}
        <div className="chat-title">
          <div className="name">{group}</div>
        </div>
      </div>

      <div className="messages" ref={messagesRef}>
        {loadingMore && (
          <div style={{ textAlign: "center", padding: 8 }}>
            <div className="spinner" />
          </div>
        )}

        {isMessagesLoading && messages.length === 0 ? (
          <>
            <div className="msg-row other"><div className="msg-meta"><div className="msg-avatar" /></div><div className="msg-wrap"><div className="msg-username placeholder" /><div className="msg-bubble placeholder" style={{ width: "40%" }} /></div></div>
            <div className="msg-row own"><div className="msg-meta"><div className="msg-avatar" /></div><div className="msg-wrap"><div className="msg-username placeholder" /><div className="msg-bubble placeholder" style={{ width: "50%" }} /></div></div>
            <div className="msg-row other"><div className="msg-meta"><div className="msg-avatar" /></div><div className="msg-wrap"><div className="msg-username placeholder" /><div className="msg-bubble placeholder" style={{ width: "30%" }} /></div></div>
          </>
        ) : (
          <>
            {messages.length === 0 && <div className="empty-state">No messages yet. Say hello to the group.</div>}
            {messages.map((msg, index) => {
              const prev = messages[index - 1];
              const showHeader = !prev || prev.uid !== msg.uid;
              return (
                <div key={msg.id} ref={(el) => { messageRefs.current[msg.id] = el; }}>
                  <MessageBubble msg={msg} isOwn={user && msg.uid === user.uid} showHeader={showHeader} onCopy={copyMessage} onReply={setReplyTo} onScrollToRef={scrollToMessage} />
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="chat-toolbar">
        <button type="button" className="icon-btn" title="Insert link" onClick={handleInsertLink}><LinkIcon /></button>
        <div style={{ flex: 1 }}>
          {replyTo && (
            <div className="reply-preview">
              Replying to: <strong>{replyTo.username || ""}</strong> — {replyTo.text}
              <button type="button" className="btn" onClick={() => setReplyTo(null)} style={{ marginLeft: 8 }}>×</button>
            </div>
          )}
          <input ref={inputRef} type="text" placeholder="Enter your message" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleSend()} style={{ width: "100%" }} />
        </div>
        <button type="button" className="send-btn" onClick={handleSend}><SendIcon /></button>
      </div>
    </section>
  );
}

function ProfileScreen({ user, userDoc, onLogout, onUpdateUsername }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const clanName = userDoc?.groupData?.groupName;

  return (
    <section className="screen">
      <div className="profile-screen">
        <div className="chat-header">
          <div className="chat-title"><div className="name">Profile</div></div>
        </div>
        <div className="profile-body">
          <div className="avatar-circle">{user.photoURL ? <img src={user.photoURL} alt="" /> : <ProfileIcon />}</div>
          <div className="profile-email">{user.email}</div>
          {clanName && <div className="profile-clan">Clan: {clanName}</div>}
          <div style={{ width: "100%", textAlign: "center" }}>
            {!editing ? (
              <div>
                <div style={{ color: "var(--muted)", marginBottom: 8 }}>{userDoc && userDoc.username ? `@${userDoc.username}` : "No username set"}</div>
                <button type="button" className="logout-btn" onClick={() => { setName((userDoc && userDoc.username) || ""); setEditing(true); }} style={{ marginBottom: 8 }}>Edit username</button>
                <button type="button" className="logout-btn" onClick={onLogout}>Log out</button>
              </div>
            ) : (
              <div>
                <input className="profile-username-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="username" autoFocus />
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button type="button" className="btn primary" onClick={async () => { await onUpdateUsername(name); setEditing(false); }}>Save</button>
                  <button type="button" className="btn" onClick={() => { setEditing(false); setName(userDoc && userDoc.username ? userDoc.username : ""); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AuthScreen({ onLoginEmail, onCreateAccount, onGoogle, defaultIsSignUp = true }) {
  const [isSignUp, setIsSignUp] = useState(defaultIsSignUp);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { showToast } = useToast();

  function handleSubmit(event) {
    event.preventDefault();
    if (isSignUp) {
      onCreateAccount(email.trim(), password).catch((err) => showToast(err.message, "error"));
    } else {
      onLoginEmail(email.trim(), password).catch((err) => showToast(err.message, "error"));
    }
    setEmail("");
    setPassword("");
  }

  function handleGoogle() {
    onGoogle().catch((err) => showToast(err.message, "error"));
  }

  return (
    <section className="screen">
      <div className="auth-screen">
        <div className="auth-heading">
          <h1>{isSignUp ? "Create account" : "Sign in"}</h1>
          <p>{isSignUp ? "Join your anime circles." : "Welcome back to your anime circles."}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" type="email" placeholder="you@animespace.io" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div>
            <label htmlFor="auth-password">Password</label>
            <input id="auth-password" type="password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          <button type="submit" className="auth-submit">{isSignUp ? "Create account" : "Sign in"}</button>
        </form>

        <div className="auth-divider">or</div>
        {!isSignUp && (
          <button type="button" className="google-btn" onClick={handleGoogle}><GoogleLogo /> Continue with Google</button>
        )}

        <div className="auth-switch">
          <span>{isSignUp ? "Already have an account?" : "New here?"}</span>{" "}
          <button type="button" onClick={() => setIsSignUp(!isSignUp)}>{isSignUp ? "Sign in" : "Create an account"}</button>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);

  const [screen, setScreen] = useState("groups");
  const [currentGroup, setCurrentGroup] = useState(GENERAL_GROUP);
  const [lastOpenedGroup, setLastOpenedGroup] = useState(GENERAL_GROUP);

  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 900);
  const [latestPerGroup, setLatestPerGroup] = useState({});
  const { showToast } = useToast();

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        try {
          const { isNew } = await createOrUpdateUserDoc(u);
          const doc = await getUserDoc(u.uid);
          setUserDoc(doc);
          if (isNew) showToast("Welcome — you've been added to the General group.", "info");
        } catch (error) {
          console.error("user doc error", error);
          showToast("Failed to load your profile.", "error");
        }
      } else {
        setUserDoc(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [showToast]);

  const clanName = userDoc?.groupData?.groupName;
  const isOnboarded = Boolean(user && userDoc && clanName);
  const username = userDoc?.username || user?.displayName || "";

  // Watches the two group-list previews (General + the user's clan). Each
  // entry in latestPerGroup is filled in as its first snapshot arrives, so
  // GroupsScreen shows a skeleton for any group name not yet present as a key.
  useEffect(() => {
    if (!isOnboarded) return;
    const groupsToWatch = [GENERAL_GROUP];
    if (clanName) groupsToWatch.push(clanName);

    const subs = groupsToWatch.map((groupName) =>
      listenGroupMessages(groupName, (msgs) => {
        setLatestPerGroup((state) => ({ ...state, [groupName]: msgs && msgs.length ? msgs[msgs.length - 1] : null }));
      }, 1)
    );

    return () => subs.forEach((unsub) => unsub && unsub());
  }, [isOnboarded, clanName]);

  function openChat(group) {
    setCurrentGroup(group);
    setLastOpenedGroup(group);
    setScreen("chat");
  }

  function handleNavigate(dest) {
    if (dest === "chats") {
      openChat(lastOpenedGroup || GENERAL_GROUP);
      return;
    }
    setScreen(dest);
  }

  async function handleChooseClan(group) {
    if (!user || onboardingSubmitting) return;
    setOnboardingSubmitting(true);
    try {
      await joinGroup(user.uid, group.name, "exclusive");
      await setUserGroupData(user.uid, group.name);
      const doc = await getUserDoc(user.uid);
      setUserDoc(doc);
      setScreen("groups");
      showToast(`Welcome to ${group.name}`, "success");
    } catch (error) {
      console.error("choose clan failed", error);
      showToast("Failed to join clan. Please try again.", "error");
    } finally {
      setOnboardingSubmitting(false);
    }
  }

  function sendMessage(payload) {
    return sendGroupMessage(currentGroup, payload);
  }

  async function handleLoginEmail(email, password) {
    await signInWithEmail(email, password);
    showToast("Signed in", "success");
  }

  async function handleCreateAccount(email, password) {
    const credential = await createUserWithEmail(email, password);
    showToast("Account created", "success");
    return credential;
  }

  async function handleGoogleSignIn() {
    await signInWithGoogle();
    showToast("Signed in with Google", "success");
  }

  async function handleLogout() {
    await signOutUser();
    showToast("Signed out", "info");
  }

  async function handleUpdateUsername(name) {
    if (!user) return;
    await updateUsername(user.uid, name);
    const doc = await getUserDoc(user.uid);
    setUserDoc(doc);
  }

  if (authLoading) {
    return (
      <div className={`phone ${isDesktop ? "desktop" : ""}`}>
        <div className="app-loading"><div className="spinner spinner-lg" /></div>
      </div>
    );
  }

  let body;

  if (!user) {
    body = <AuthScreen onLoginEmail={handleLoginEmail} onCreateAccount={handleCreateAccount} onGoogle={handleGoogleSignIn} />;
  } else if (!isOnboarded) {
    body = <OnboardingScreen user={user} groups={EXCLUSIVE_GROUPS} submitting={onboardingSubmitting} onChoose={handleChooseClan} />;
  } else if (isDesktop) {
    const navActive = screen === "chat" ? "chats" : screen;
    body = (
      <div className="desktop-grid">
        <NavBar orientation="vertical" active={navActive} onNavigate={handleNavigate} />
        <div className="groups-pane">
          <GroupsScreen
            userDoc={userDoc}
            onOpenChat={openChat}
            onOpenProfile={() => setScreen("profile")}
            latestPerGroup={latestPerGroup}
            activeGroup={screen === "chat" ? currentGroup : null}
          />
        </div>
        <div className="main-pane">
          {screen === "chat" && (
            <ChatScreen
              key={currentGroup}
              group={currentGroup}
              onBack={() => setScreen("groups")}
              showBack={false}
              onSend={sendMessage}
              user={user}
              username={username}
            />
          )}
          {screen === "profile" && (
            <ProfileScreen user={user} userDoc={userDoc} onLogout={handleLogout} onUpdateUsername={handleUpdateUsername} />
          )}
          {screen !== "chat" && screen !== "profile" && (
            <div className="empty-chat">Select a group to start chatting</div>
          )}
        </div>
      </div>
    );
  } else {
    body = (
      <>
        {screen === "groups" && (
          <>
            <GroupsScreen
              userDoc={userDoc}
              onOpenChat={openChat}
              onOpenProfile={() => setScreen("profile")}
              latestPerGroup={latestPerGroup}
            />
            <NavBar orientation="horizontal" active="groups" onNavigate={handleNavigate} />
          </>
        )}

        {screen === "chat" && (
          <ChatScreen
            key={currentGroup}
            group={currentGroup}
            onBack={() => setScreen("groups")}
            onSend={sendMessage}
            user={user}
            username={username}
          />
        )}

        {screen === "profile" && (
          <>
            <ProfileScreen user={user} userDoc={userDoc} onLogout={handleLogout} onUpdateUsername={handleUpdateUsername} />
            <NavBar orientation="horizontal" active="profile" onNavigate={handleNavigate} />
          </>
        )}
      </>
    );
  }

  return (
    <div className={`phone ${isDesktop ? "desktop" : ""}`}>
      {!isDesktop && <div className="statusbar"><span className="brand-mark">AnimeSpace</span></div>}
      {body}
    </div>
  );
}
