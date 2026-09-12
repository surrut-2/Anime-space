import { useState, useEffect, useRef, Fragment } from "react";
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
  getUserGroups,
  joinGroup,
  leaveGroup,
  setUserGroupData,
} from "./auth";
import { useToast } from "./toast.jsx";
import { sendGroupMessage, listenGroupMessages, loadOlderMessages } from "./messages";

/* ============================================================
   ICONS — small inline SVG components, reused across screens
   ============================================================ */
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-8 9 8"></path>
    <path d="M5 10v10h14V10"></path>
  </svg>
);

const ChatsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.38 8.5 8.5 0 0 1-4-1L3 20l1.12-5.5A8.38 8.38 0 1 1 21 11.5z"></path>
  </svg>
);

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"></circle>
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path>
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

if (messagesRef.current) {
  messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
}

useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    let ticking = false;
    async function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(async () => {
        if (container.scrollTop <= 120 && hasMore && !loadingMore) {
          // preserve scroll position
          const prevScrollHeight = container.scrollHeight;
          const prevScrollTop = container.scrollTop;
          await loadMore();
          // wait for DOM update
          setTimeout(() => {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
          }, 60);
        }
        ticking = false;
      });
    }
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [hasMore, loadingMore, loadMore]);

  function handleInsertLink() {
    const insertion = "|  |";
    const newValue = input + insertion;
    setInput(newValue);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        const caretPos = newValue.length - 3; // right after the first pipe
        el.focus();
        el.setSelectionRange(caretPos, caretPos);
      }
    });
  }

  function handleSend() {
    const val = input.trim();
    if (!val) return;
    onSend(val);
    setInput("");
    inputRef.current && inputRef.current.focus();
  }

  return (
    <section className="screen">
      <div className="chat-header">
        <button className="icon-btn" onClick={onBack}>
          <BackIcon />
        </button>
        <div className="chat-title">
          <div className="name">{group}</div>
          <div className="status">Active now</div>
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
            {messages.map((msg) => (
              <div
                key={msg.id}
                ref={(el) => {
                  if (messageRefs && messageRefs.current) messageRefs.current[msg.id] = el;
                }}
              >
                <MessageBubble
                  msg={msg}
                  isOwn={user && msg.uid === user.uid}
                  onCopy={onCopy}
                  onReply={onReply}
                  onScrollToRef={scrollToMessage}
                />
              </div>
            ))}
          </>
        )}
      </div>

      <div className="chat-toolbar">
        <button className="icon-btn" title="Insert link" onClick={handleInsertLink}>
          <LinkIcon />
        </button>
        <div style={{ flex: 1 }}>
          {replyTo && (
            <div className="reply-preview">
              Replying to: <strong>{replyTo.username || ""}</strong> — {replyTo.text}
              <button className="btn" onClick={() => setReplyTo(null)} style={{ marginLeft: 8 }}>
                ×
              </button>
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter your message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            style={{ width: "100%" }}
          />
        </div>
        <button className="send-btn" onClick={handleSend}>
          <SendIcon />
        </button>
      </div>
    </section>
  );
}

function MessageBubble({ msg, isOwn, onCopy, onReply, onScrollToRef }) {
  const [showActions, setShowActions] = useState(false);

  function renderParsedText(text) {
    const pieces = parseMessage(text || "");
    return pieces.map((p, i) => {
      if (p.type === "link") {
        return (
          <a key={`link-${i}`} href={p.href} target="_blank" rel="noreferrer">
            {p.content}
          </a>
        );
      }
      return <Fragment key={`text-${i}`}>{p.content}</Fragment>;
    });
  }

  return (
    <div className={`msg-row ${isOwn ? "own" : "other"}`}>
      <div className="msg-meta">{msg.photoURL ? <img src={msg.photoURL} alt="" className="msg-avatar" /> : <ProfileIcon />}</div>
      <div className="msg-wrap">
        <div className="msg-username">{msg.username || "Anonymous"}</div>
        {msg.replyTo && (
          <div className="msg-reply" onClick={() => onScrollToRef && onScrollToRef(msg.replyTo.id)}>
            <div className="msg-reply-text">{msg.replyTo.text}</div>
          </div>
        )}
        <div className={`msg-bubble ${isOwn ? "own-bubble" : "other-bubble"}`} onClick={() => setShowActions((s) => !s)}>
          {renderParsedText(msg.text)}
        </div>

        {showActions && (
          <div className="bubble-actions">
            <button className="action" onClick={() => onCopy && onCopy(msg)} title="Copy">
              <CopyIcon />
            </button>
            <button className="action" onClick={() => onReply && onReply(msg)} title="Reply">
              <ReplyIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SCREEN 3 — PROFILE
   ============================================================ */
function ProfileScreen({ user, userDoc, onLogout, onNavigate, onUpdateUsername }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState((userDoc && userDoc.username) || "");

  useEffect(() => {
    setName((userDoc && userDoc.username) || "");
  }, [userDoc]);

  if (!user) {
    return (
      <section className="screen">
        <div className="profile-screen">
          <div className="chat-header">
            <button className="icon-btn" onClick={() => onNavigate("groups")}>
              <BackIcon />
            </button>
            <div className="chat-title">
              <div className="name">Profile</div>
            </div>
            <span style={{ width: 28 }}></span>
          </div>
          <div className="profile-body">
            <div className="avatar-circle">
              <ProfileIcon />
            </div>
            <div className="profile-email">You are not signed in.</div>
            <button
              className="logout-btn"
              onClick={() => {
                onNavigate("auth");
              }}
            >
              Sign in
            </button>
          </div>
          <BottomNav active="profile" onNavigate={onNavigate} />
        </div>
      </section>
    );
  }

  return (
    <section className="screen">
      <div className="profile-screen">
        <div className="chat-header">
          <button className="icon-btn" onClick={() => onNavigate("groups")}>
            <BackIcon />
          </button>
          <div className="chat-title">
            <div className="name">Profile</div>
          </div>
          <span style={{ width: 28 }}></span>
        </div>
        <div className="profile-body">
          <div className="avatar-circle">
            {user.photoURL ? <img src={user.photoURL} alt="" style={{ width: 46, height: 46, borderRadius: 8 }} /> : <ProfileIcon />}
          </div>
          <div className="profile-email">{user.email}</div>
          <div style={{ width: "100%", textAlign: "center" }}>
            {!editing ? (
              <div>
                <div style={{ color: "var(--muted)", marginBottom: 8 }}>{userDoc && userDoc.username ? `@${userDoc.username}` : "No username set"}</div>
                <button
                  className="logout-btn"
                  onClick={() => {
                    setEditing(true);
                  }}
                  style={{ marginBottom: 8 }}
                >
                  Edit username
                </button>
                <button className="logout-btn" onClick={onLogout}>
                  Log out
                </button>
              </div>
            ) : (
              <div>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="username" style={{ padding: 8, borderRadius: 8, width: "100%", marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button
                    className="btn primary"
                    onClick={async () => {
                      await onUpdateUsername(name);
                      setEditing(false);
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setEditing(false);
                      setName(userDoc && userDoc.username ? userDoc.username : "");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <BottomNav active="profile" onNavigate={onNavigate} />
      </div>
    </section>
  );
}

/* ============================================================
   SCREEN 4 — AUTHENTICATION
   ============================================================ */
function AuthScreen({ onLoginEmail, onCreateAccount, onGoogle, defaultIsSignUp = true }) {
  const [isSignUp, setIsSignUp] = useState(defaultIsSignUp);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { showToast } = useToast();


  function handleSubmit(e) {
    e.preventDefault();
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
            <input
              id="auth-email"
              type="email"
              placeholder="you@animespace.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="auth-submit">
            {isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="auth-divider">or</div>

        {!isSignUp && (
          <button className="google-btn" onClick={handleGoogle}>
            <GoogleLogo />
            Continue with Google
          </button>
        )}

        <div className="auth-switch">
          <span>{isSignUp ? "Already have an account?" : "New here?"}</span>{" "}
          <button type="button" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Sign in" : "Create an account"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   APP — top-level state and screen router
   ============================================================ */
export default function App() {
  const [screen, setScreen] = useState("groups"); // groups | chat | profile | auth
  const [currentGroup, setCurrentGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const messageRefs = useRef({});
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 900);
  const [lastOpenedGroup, setLastOpenedGroup] = useState(null);
  const [latestPerGroup, setLatestPerGroup] = useState({});

  const [user, setUser] = useState(null); // Firebase user
  const [userDoc, setUserDoc] = useState(null); // Firestore users/{uid}
  const [joinModal, setJoinModal] = useState({ open: false, target: null });
  const [profileEmail, setProfileEmail] = useState("you@animespace.io");
  const [clock, setClock] = useState(formatClock(new Date()));
  const { showToast } = useToast();

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onResize() {
      setIsDesktop(window.innerWidth >= 900);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    // subscribe to Firebase auth state
    const unsub = onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        setProfileEmail(u.email || "");
        try {
          const { isNew } = await createOrUpdateUserDoc(u);
          const doc = await getUserDoc(u.uid);
          setUserDoc(doc);
          // On first sign-in show onboarding toast
          if (isNew) {
            showToast(
              "Welcome — you've been added to General group. General group is for discussion. You can join one exclusive group at a time and change groups after 7 days.",
              "info",
            );
          }
          // If user has no chosen clan (groupData), force onboarding
          if (!doc || !doc.groupData) {
            setScreen("onboarding");
          } else {
            setScreen((s) => (s === "auth" || s === "onboarding" ? "groups" : s));
          }
        } catch (err) {
          console.error("user doc error", err);
        }
      } else {
        setProfileEmail("you@animespace.io");
        setUserDoc(null);
        // If there's no authenticated user, show the auth screen
        setScreen("auth");
      }
    });
    return () => unsub();
  }, []);

  function openChat(group) {
    setCurrentGroup(group);
    setLastOpenedGroup(group);
    setScreen("chat");
  }

  function handleNavigate(dest) {
    if (dest === "chats") {
      if (lastOpenedGroup) {
        openChat(lastOpenedGroup);
      } else {
        // fallback: open General
        openChat("General group");
      }
      return;
    }
    setScreen(dest);
  }

  async function handleChooseClan(group) {
    if (!user) {
      setScreen("auth");
      return;
    }
    try {
      await joinGroup(user.uid, group.name, "exclusive");
      await setUserGroupData(user.uid, group.name);
      const doc = await getUserDoc(user.uid);
      setUserDoc(doc);
      showToast(`Joined ${group.name} — welcome to your clan`, "success");
      setScreen("groups");
    } catch (err) {
      console.error("onboarding join failed", err);
      showToast(err.message || "Failed to join clan", "error");
    }
  }

  useEffect(() => {
    if (!currentGroup) return;
    setMessages([]);
    setLastVisible(null);
    setHasMore(false);
    setIsMessagesLoading(true);
    const unsub = listenGroupMessages(currentGroup, (msgs, lastDoc) => {
      setMessages(msgs || []);
      setLastVisible(lastDoc || null);
      setHasMore(Boolean(lastDoc));
      setIsMessagesLoading(false);
    });
    return () => unsub && unsub();
  }, [currentGroup]);

  function isInGroup(name) {
    if (!userDoc || !userDoc.groups) return false;
    return userDoc.groups.some((g) => g && g.name === name);
  }

  function getExclusiveMembership() {
    if (!userDoc || !userDoc.groups) return null;
    return userDoc.groups.find((g) => g && g.type === "exclusive") || null;
  }

  function daysSince(tsVal) {
    if (!tsVal) return Infinity;
    const ms = tsVal.toMillis ? tsVal.toMillis() : tsVal;
    return (Date.now() - ms) / (1000 * 60 * 60 * 24);
  }

  async function requestJoinGroup(group) {
    if (!user) {
      setScreen("auth");
      return;
    }
    const type = group.type || "exclusive";
    if (type === "general") {
      await joinGroup(user.uid, group.name, "general");
      const doc = await getUserDoc(user.uid);
      setUserDoc(doc);
      showToast(`Joined ${group.name}`, "success");
      return;
    }

    const currentExclusive = getExclusiveMembership();
    if (!currentExclusive) {
      // no exclusive yet — join directly
      await joinGroup(user.uid, group.name, "exclusive");
      const doc = await getUserDoc(user.uid);
      setUserDoc(doc);
      showToast(`Joined ${group.name}`, "success");
      return;
    }

    // if already in this exclusive group, nothing to do
    if (currentExclusive.name === group.name) {
      showToast(`You are already in ${group.name}`, "info");
      return;
    }

    // enforce 7-day lock
    const joinedAt = currentExclusive.joinedAt;
    const days = daysSince(joinedAt);
    if (days < 7) {
      showToast(
        `You joined ${currentExclusive.name} ${Math.floor(days)} days ago. You can change groups after 7 days.`,
        "warning",
      );
      return;
    }

    // show confirm modal before removing previous exclusive
    setJoinModal({ open: true, target: group });
  }

  async function confirmJoin() {
    const group = joinModal.target;
    if (!group || !user) return;
    await joinGroup(user.uid, group.name, "exclusive");
    const doc = await getUserDoc(user.uid);
    setUserDoc(doc);
    showToast(`Joined ${group.name} — previous exclusive groups removed`, "success");
    setJoinModal({ open: false, target: null });
  }

  function cancelJoin() {
    setJoinModal({ open: false, target: null });
  }

  async function sendMessage(text) {
    if (!currentGroup || !user) return;
    const payload = {
      text,
      uid: user.uid,
      username: (userDoc && userDoc.username) || user.displayName || "",
      photoURL: user.photoURL || null,
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text } : null,
    };
    try {
      await sendGroupMessage(currentGroup, payload);
      setReplyTo(null);
    } catch (err) {
      console.error("send message failed", err);
      showToast(err.message || "Failed to send", "error");
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore || !currentGroup) return;
    setLoadingMore(true);
    try {
      const res = await loadOlderMessages(currentGroup, lastVisible, 30);
      if (res.docs.length) {
        setMessages((m) => [...res.docs, ...m]);
        setLastVisible(res.last || null);
        setHasMore(Boolean(res.last));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("load older failed", err);
      showToast("Failed to load more messages", "error");
    }
    setLoadingMore(false);
  }

  function copyMessage(msg) {
    if (navigator.clipboard) navigator.clipboard.writeText(msg.text).then(() => showToast("Copied", "success"));
  }

  function doReply(msg) {
    setReplyTo(msg);
  }

  function scrollToMessage(id) {
    const el = messageRefs.current[id];
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // subscribe to latest message for General and user's clan for display in group list
  useEffect(() => {
    const subs = [];
    const groupsToWatch = [];
    groupsToWatch.push("General group");
    if (userDoc && userDoc.groupData && userDoc.groupData.groupName) groupsToWatch.push(userDoc.groupData.groupName);
    groupsToWatch.forEach((g) => {
      const unsub = listenGroupMessages(g, (msgs) => {
        if (!msgs || msgs.length === 0) return;
        const latest = msgs[msgs.length - 1];
        setLatestPerGroup((s) => ({ ...s, [g]: latest }));
      }, 1);
      subs.push(unsub);
    });
    return () => subs.forEach((u) => u && u());
  }, [userDoc]);

  // Auth actions passed to AuthScreen
  async function handleLoginEmail(email, password) {
    await signInWithEmail(email, password);
    // onAuthStateChanged will handle state update
    setScreen("groups");
    showToast("Signed in", "success");
  }

  async function handleCreateAccount(email, password) {
    const cred = await createUserWithEmail(email, password);
    // createOrUpdateUserDoc will be called by onAuthStateChanged
    setScreen("groups");
    showToast("Account created", "success");
    return cred;
  }

  async function handleGoogleSignIn() {
    await signInWithGoogle();
    setScreen("groups");
    showToast("Signed in with Google", "success");
  }

  async function handleLogout() {
    await signOutUser();
    setScreen("auth");
    showToast("Signed out", "info");
  }

  async function handleUpdateUsername(name) {
    if (!user) return;
    await updateUsername(user.uid, name);
    const doc = await getUserDoc(user.uid);
    setUserDoc(doc);
  }

  return (
    <div className={`phone ${isDesktop ? "desktop" : ""}`}>
      {/* STATUS BAR (time only — no battery indicator) */}
      <div className="statusbar">{/* <span>{clock}</span> */}</div>

      {screen === "groups" && (
        <GroupsScreen
          onOpenChat={openChat}
          onNavigate={handleNavigate}
          onRequestJoin={requestJoinGroup}
          isInGroup={isInGroup}
          latestPerGroup={latestPerGroup}
        />
      )}

      {screen === "onboarding" && user && (
        <OnboardingScreen user={user} groups={GROUPS.filter((g) => g.type === "exclusive")} onChoose={handleChooseClan} />
      )}

      {screen === "chat" && (
        <ChatScreen
          group={currentGroup}
          messages={messages}
          onBack={() => setScreen("groups")}
          onSend={sendMessage}
          onCopy={copyMessage}
          onReply={doReply}
          loadMore={loadMore}
          hasMore={hasMore}
          messageRefs={messageRefs}
          loadingMore={loadingMore}
          isMessagesLoading={isMessagesLoading}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
          scrollToMessage={scrollToMessage}
          user={user}
        />
      )}

      {screen === "profile" && (
        <ProfileScreen user={user} userDoc={userDoc} onLogout={handleLogout} onNavigate={handleNavigate} onUpdateUsername={handleUpdateUsername} />
      )}

      {screen === "auth" && (
        <AuthScreen onLoginEmail={handleLoginEmail} onCreateAccount={handleCreateAccount} onGoogle={handleGoogleSignIn} />
      )}

      {joinModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            {isDesktop ? (
              <div className="desktop-grid">
                <div className="left-col">
                  <GroupsScreen
                    onOpenChat={openChat}
                    onNavigate={handleNavigate}
                    onRequestJoin={requestJoinGroup}
                    isInGroup={isInGroup}
                    latestPerGroup={latestPerGroup}
                  />
                  <BottomNav active={screen === "profile" ? "profile" : "groups"} onNavigate={handleNavigate} />
                </div>
                <div className="right-col">
                  {screen === "chat" ? (
                    <ChatScreen
                      group={currentGroup}
                      messages={messages}
                      onBack={() => setScreen("groups")}
                      onSend={sendMessage}
                      onCopy={copyMessage}
                      onReply={doReply}
                      loadMore={loadMore}
                      hasMore={hasMore}
                      messageRefs={messageRefs}
                      loadingMore={loadingMore}
                      isMessagesLoading={isMessagesLoading}
                      replyTo={replyTo}
                      setReplyTo={setReplyTo}
                      scrollToMessage={scrollToMessage}
                      user={user}
                    />
                  ) : screen === "profile" ? (
                    <ProfileScreen user={user} userDoc={userDoc} onLogout={handleLogout} onNavigate={handleNavigate} onUpdateUsername={handleUpdateUsername} />
                  ) : screen === "auth" ? (
                    <AuthScreen onLoginEmail={handleLoginEmail} onCreateAccount={handleCreateAccount} onGoogle={handleGoogleSignIn} />
                  ) : screen === "onboarding" ? (
                    <OnboardingScreen user={user} groups={GROUPS.filter((g) => g.type === "exclusive")} onChoose={handleChooseClan} />
                  ) : (
                    <div className="screen" />
                  )}
                </div>
              </div>
            ) : (
              <>
                {screen === "groups" && (
                  <GroupsScreen
                    onOpenChat={openChat}
                    onNavigate={handleNavigate}
                    onRequestJoin={requestJoinGroup}
                    isInGroup={isInGroup}
                    latestPerGroup={latestPerGroup}
                  />
                )}

                {screen === "chat" && (
                  <ChatScreen
                    group={currentGroup}
                    messages={messages}
                    onBack={() => setScreen("groups")}
                    onSend={sendMessage}
                    onCopy={copyMessage}
                    onReply={doReply}
                    loadMore={loadMore}
                    hasMore={hasMore}
                    messageRefs={messageRefs}
                    loadingMore={loadingMore}
                    isMessagesLoading={isMessagesLoading}
                    replyTo={replyTo}
                    setReplyTo={setReplyTo}
                    scrollToMessage={scrollToMessage}
                    user={user}
                  />
                )}

                {screen === "profile" && (
                  <ProfileScreen user={user} userDoc={userDoc} onLogout={handleLogout} onNavigate={handleNavigate} onUpdateUsername={handleUpdateUsername} />
                )}

                {screen === "auth" && (
                  <AuthScreen onLoginEmail={handleLoginEmail} onCreateAccount={handleCreateAccount} onGoogle={handleGoogleSignIn} />
                )}

                {screen === "onboarding" && user && (
                  <OnboardingScreen user={user} groups={GROUPS.filter((g) => g.type === "exclusive")} onChoose={handleChooseClan} />
                )}
              </>
            )}

            {joinModal.open && (
              <div className="modal-overlay">
                <div className="modal">
                  <h3>Change group?</h3>
                  <p>
                    Joining <strong>{joinModal.target?.name}</strong> will remove your previous exclusive group membership. You can only be
                    in one exclusive group at a time. Proceed?
                  </p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                    <button className="btn" onClick={cancelJoin}>
                      Cancel
                    </button>
                    <button className="btn primary" onClick={confirmJoin}>
                      Proceed
                    </button>
                  </div>
                </div>
              </div>
            )}