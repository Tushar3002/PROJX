import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";

import { getErrorMessage, groupApi, type AuthUser, type GroupInfo } from "./api";
import { AdminDashboard } from "./admin/AdminDashboard";
import { useAuth } from "./auth/AuthContext";
import { AuthForm } from "./components/AuthForm";
import { getRealtimeClient, type Announcement, type ChatMessage, type RealtimeClient } from "./realtime";

const MIN_GROUP_PASSWORD_LENGTH = 4;

const cardStyle: CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, color: "#111827" };
const inputStyle: CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, color: "#111827", boxSizing: "border-box" };
const primaryButtonStyle: CSSProperties = { background: "#111827", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", cursor: "pointer" };
const secondaryButtonStyle: CSSProperties = { padding: "8px 12px", cursor: "pointer", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", color: "#111827" };

function App() {
  const { user, loading, logout } = useAuth();
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  if (loading) {
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f3f4f6", color: "#4b5563" }}>Loading...</main>;
  }

  if (!user) {
    return <AuthForm />;
  }

  if (user.role === "admin" && showAdminPanel) {
    return <AdminDashboard onBack={() => setShowAdminPanel(false)} />;
  }

  return <ChatApp user={user} onLogout={logout} onOpenAdmin={() => setShowAdminPanel(true)} />;
}

interface ChatAppProps {
  user: AuthUser;
  onLogout: () => void;
  onOpenAdmin: () => void;
}

function ChatApp({ user, onLogout, onOpenAdmin }: ChatAppProps) {
  const realtimeRef = useRef<RealtimeClient | null>(null);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [draft, setDraft] = useState("");
  // A locked group the user picked from the list, waiting for its password.
  const [pendingGroup, setPendingGroup] = useState<GroupInfo | null>(null);
  const [pendingPassword, setPendingPassword] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupPassword, setNewGroupPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const loadGroups = () => {
    groupApi
      .list()
      .then(setGroups)
      .catch((caught) => setError(getErrorMessage(caught)));
  };

  useEffect(() => {
    const client = getRealtimeClient();
    realtimeRef.current = client;

    client.onConnect(() => setConnected(true));
    client.onDisconnect(() => setConnected(false));
    client.onSessionRevoked((message) => {
      setError(message);
      onLogout();
    });
    client.onRoomJoined((name) => {
      setActiveGroup(name);
      setPendingGroup(null);
      setPendingPassword("");
      setError(null);
      loadGroups();
    });
    client.onRoomUsers(setOnlineUsers);
    client.onRoomError(setError);
    client.onAnnouncement(setAnnouncement);
    client.onChatMessage((payload) => {
      setMessages((previous) => [...previous, payload]);
    });

    client.connect();
    loadGroups();

    return () => {
      client.disconnect();
      realtimeRef.current = null;
    };
  }, []);

  const joinGroup = (name: string, password?: string) => {
    setError(null);
    setMessages([]);
    setOnlineUsers([]);
    realtimeRef.current?.joinRoom(name, password || undefined);
  };

  // Members and open groups join straight away. Other locked groups ask for the password first.
  const chooseGroup = (group: GroupInfo) => {
    if (group.requiresPassword && !group.isMember) {
      setError(null);
      setPendingGroup(group);
      setPendingPassword("");
      return;
    }

    joinGroup(group.name);
  };

  const leaveGroup = () => {
    realtimeRef.current?.leaveRoom();
    setActiveGroup(null);
    setMessages([]);
    setOnlineUsers([]);
    setError(null);
    loadGroups();
  };

  const sendMessage = () => {
    const text = draft.trim();

    if (!text || !activeGroup) {
      return;
    }

    realtimeRef.current?.sendMessage(text);
    setDraft("");
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pendingGroup) {
      joinGroup(pendingGroup.name, pendingPassword);
    }
  };

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = joinName.trim();

    if (!name) {
      setError("Enter a group name to join.");
      return;
    }

    setJoinName("");
    joinGroup(name, joinPassword);
    setJoinPassword("");
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newGroupName.trim();

    if (!name) {
      setError("Enter a name for the new group.");
      return;
    }

    if (newGroupPassword.length < MIN_GROUP_PASSWORD_LENGTH) {
      setError(`Group password must be at least ${MIN_GROUP_PASSWORD_LENGTH} characters.`);
      return;
    }

    setError(null);

    try {
      const group = await groupApi.create(name, newGroupDescription.trim(), newGroupPassword);
      setNewGroupName("");
      setNewGroupDescription("");
      setNewGroupPassword("");
      // The creator is a member, so no password is needed to join.
      joinGroup(group.name);
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  };

  const accountBar = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, color: "#4b5563", flexWrap: "wrap" }}>
      <span>
        Signed in as <strong style={{ color: "#111827" }}>{user.name}</strong>{" "}
        <span style={{ padding: "4px 8px", borderRadius: 999, background: user.role === "admin" ? "#fef3c7" : "#e5e7eb", color: "#111827", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
          {user.role}
        </span>
      </span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {user.role === "admin" ? (
          <button onClick={onOpenAdmin} style={secondaryButtonStyle}>
            Admin panel
          </button>
        ) : null}
        <button onClick={onLogout} style={secondaryButtonStyle}>
          Log out
        </button>
      </div>
    </div>
  );

  const errorText = (
    <>
      {announcement ? (
        <div style={{ margin: "0 0 16px", padding: "12px 16px", borderRadius: 8, background: "#fef3c7", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span>
            <strong>Announcement from {announcement.fromName}:</strong> {announcement.text}
          </span>
          <button onClick={() => setAnnouncement(null)} style={secondaryButtonStyle}>
            Dismiss
          </button>
        </div>
      ) : null}
      {error ? <p style={{ margin: "0 0 16px", color: "#b91c1c" }}>{error}</p> : null}
    </>
  );

  if (!activeGroup) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f4f6", padding: 24, color: "#111827" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {accountBar}
          {errorText}

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <section style={cardStyle}>
              <h2 style={{ margin: "0 0 12px", fontSize: 22 }}>Group chats</h2>
              {groups.length === 0 ? <p style={{ color: "#6b7280", margin: 0 }}>No groups yet.</p> : null}
              <div style={{ display: "grid", gap: 8 }}>
                {groups.map((group) => (
                  <button key={group.id} onClick={() => chooseGroup(group)} style={{ ...secondaryButtonStyle, textAlign: "left" }}>
                    <strong>{group.name}</strong>
                    {group.requiresPassword && !group.isMember ? <span style={{ marginLeft: 8, color: "#92400e", fontSize: 13 }}>Password required</span> : null}
                    {group.description ? <div style={{ color: "#6b7280", fontSize: 13 }}>{group.description}</div> : null}
                  </button>
                ))}
              </div>

              {/* {pendingGroup ? (
                <form onSubmit={handlePasswordSubmit} style={{ display: "grid", gap: 10, marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
                  <strong>Password for {pendingGroup.name}</strong>
                  <input type="password" value={pendingPassword} onChange={(event) => setPendingPassword(event.target.value)} placeholder="Group password" style={inputStyle} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" style={primaryButtonStyle}>
                      Join
                    </button>
                    <button type="button" onClick={() => setPendingGroup(null)} style={secondaryButtonStyle}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null} */}
            </section>

            <section style={cardStyle}>
              <h2 style={{ margin: "0 0 12px", fontSize: 22 }}>Join by name</h2>
              <form onSubmit={handleJoin} style={{ display: "grid", gap: 12 }}>
                <input value={joinName} onChange={(event) => setJoinName(event.target.value)} placeholder="Group name" style={inputStyle} />
                <input type="password" value={joinPassword} onChange={(event) => setJoinPassword(event.target.value)} placeholder="Password (if the group has one)" style={inputStyle} />
                <button type="submit" style={primaryButtonStyle}>
                  Join
                </button>
              </form>
            </section>

            <section style={cardStyle}>
              <h2 style={{ margin: "0 0 12px", fontSize: 22 }}>Create a group</h2>
              {!user.canCreateGroup ? <p style={{ margin: "0 0 12px", color: "#92400e" }}>An admin has turned off group creation for your account.</p> : null}
              <form onSubmit={handleCreate} style={{ display: "grid", gap: 12 }}>
                <input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Group name" style={inputStyle} />
                <input value={newGroupDescription} onChange={(event) => setNewGroupDescription(event.target.value)} placeholder="Description (optional)" style={inputStyle} />
                <input type="password" value={newGroupPassword} onChange={(event) => setNewGroupPassword(event.target.value)} placeholder={`Password (at least ${MIN_GROUP_PASSWORD_LENGTH} characters)`} style={inputStyle} />
                <button type="submit" disabled={!user.canCreateGroup} style={primaryButtonStyle}>
                  Create and join
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f3f4f6", padding: 24, color: "#111827" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {accountBar}

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, ...cardStyle, padding: "12px 16px", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#6b7280", textTransform: "uppercase" }}>Group</div>
            <h2 style={{ margin: "4px 0 0", fontSize: 28 }}>{activeGroup}</h2>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ padding: "6px 10px", borderRadius: 999, background: connected ? "#dcfce7" : "#fee2e2", color: connected ? "#166534" : "#991b1b", fontWeight: 700 }}>
              {connected ? "Connected" : "Disconnected"}
            </span>
            <button onClick={leaveGroup} style={secondaryButtonStyle}>
              Back to groups
            </button>
          </div>
        </header>

        {errorText}

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr) 220px" }}>
          <section style={cardStyle}>
            <div style={{ height: 420, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fafafa", padding: 12 }}>
              {messages.length === 0 ? (
                <div style={{ color: "#6b7280", display: "grid", placeItems: "center", height: "100%" }}>No messages yet.</div>
              ) : (
                messages.map((entry) => (
                  <div key={entry.id} style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: entry.userName === "System" ? "#e0f2fe" : "#fff", border: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <strong>{entry.userName}</strong>
                      <small style={{ color: "#6b7280" }}>{new Date(entry.sentAt).toLocaleTimeString()}</small>
                    </div>
                    <div>{entry.text}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    sendMessage();
                  }
                }}
                placeholder={user.canSendMessage ? "Type a message..." : "An admin has turned off your messaging"}
                disabled={!user.canSendMessage}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={sendMessage} disabled={!user.canSendMessage} style={primaryButtonStyle}>
                Send
              </button>
            </div>
          </section>

          <aside style={cardStyle}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Online ({onlineUsers.length})</h3>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              {onlineUsers.map((name, index) => (
                <li key={`${name}-${index}`}>{name}</li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default App;
