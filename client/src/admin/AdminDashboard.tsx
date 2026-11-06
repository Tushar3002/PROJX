import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";

import { adminApi, getErrorMessage, type AdminGroup, type AdminUser, type RoleRecord, type UserPermissions } from "../api";
import { useAuth } from "../auth/AuthContext";
import { GroupsTable } from "./GroupsTable";
import { RolesTable } from "./RolesTable";
import { UsersTable } from "./UsersTable";

type Tab = "users" | "groups" | "roles" | "announcements";

const MAX_ANNOUNCEMENT_LENGTH = 500;

const cardStyle: CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 };
const tabButtonStyle = (active: boolean): CSSProperties => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: active ? "1px solid #111827" : "1px solid #d1d5db",
  background: active ? "#111827" : "#fff",
  color: active ? "#fff" : "#111827",
  cursor: "pointer",
});

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [announcementText, setAnnouncementText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = () => {
    Promise.all([adminApi.users(), adminApi.groups(), adminApi.roles()])
      .then(([loadedUsers, loadedGroups, loadedRoles]) => {
        setUsers(loadedUsers);
        setGroups(loadedGroups);
        setRoles(loadedRoles);
      })
      .catch((caught) => setError(getErrorMessage(caught)));
  };

  useEffect(() => {
    loadAll();
    // Refresh online status every 10 seconds.
    const timer = window.setInterval(() => {
      adminApi.users().then(setUsers).catch(() => undefined);
    }, 10000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(
    () => ({
      totalUsers: users.length,
      onlineUsers: users.filter((member) => member.online).length,
      admins: users.filter((member) => member.role === "admin").length,
      totalGroups: groups.length,
      totalRoles: roles.length,
    }),
    [groups.length, roles.length, users],
  );

  const runAction = async (action: () => Promise<void>, successText: string) => {
    setMessage(null);
    setError(null);

    try {
      await action();
      setMessage(successText);
      loadAll();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  };

  const handleRoleChange = (target: AdminUser) => {
    const nextRole = target.role === "admin" ? "user" : "admin";
    runAction(() => adminApi.setRole(target.id, nextRole), `${target.name} is now ${nextRole}.`);
  };

  const handleSavePermissions = (target: AdminUser, permissions: UserPermissions) => {
    runAction(() => adminApi.setPermissions(target.id, permissions), `${target.name}'s permissions were updated. They have been signed out.`);
  };

  const handleDisconnect = (target: AdminUser) => {
    runAction(() => adminApi.disconnect(target.id), `${target.name} was disconnected.`);
  };

  const handleRoleUpdate = (roleId: string, name: string, description: string) => {
    runAction(() => adminApi.updateRole(roleId, name, description), `Role updated successfully.`);
  };

  const handleAnnounce = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = announcementText.trim();

    if (!text) {
      setError("Write an announcement first.");
      return;
    }

    runAction(async () => {
      await adminApi.announce(text);
      setAnnouncementText("");
    }, "Announcement sent to everyone online.");
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f3f4f6", padding: 24, color: "#111827" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#6b7280", textTransform: "uppercase" }}>Admin</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 32 }}>Management dashboard</h1>
          </div>

          <button type="button" onClick={onBack} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>
            Back to chat
          </button>
        </div>

        {message ? <p style={{ margin: "0 0 16px", color: "#166534" }}>{message}</p> : null}
        {error ? <p style={{ margin: "0 0 16px", color: "#b91c1c" }}>{error}</p> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div style={cardStyle}>
            <div style={{ color: "#6b7280" }}>Total users</div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{stats.totalUsers}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ color: "#6b7280" }}>Online now</div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{stats.onlineUsers}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ color: "#6b7280" }}>Admins</div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{stats.admins}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ color: "#6b7280" }}>Groups</div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{stats.totalGroups}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ color: "#6b7280" }}>Roles</div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{stats.totalRoles}</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setActiveTab("users")} style={tabButtonStyle(activeTab === "users")}>
              Users
            </button>
            <button type="button" onClick={() => setActiveTab("groups")} style={tabButtonStyle(activeTab === "groups")}>
              Groups
            </button>
            <button type="button" onClick={() => setActiveTab("roles")} style={tabButtonStyle(activeTab === "roles")}>
              Roles
            </button>
            <button type="button" onClick={() => setActiveTab("announcements")} style={tabButtonStyle(activeTab === "announcements")}>
              Announcements
            </button>
          </div>

          {activeTab === "users" && user ? (
            <UsersTable users={users} currentUserId={user.id} onRoleChange={handleRoleChange} onDisconnect={handleDisconnect} onSavePermissions={handleSavePermissions} />
          ) : null}

          {activeTab === "groups" ? <GroupsTable groups={groups} /> : null}

          {activeTab === "roles" ? <RolesTable roles={roles} onUpdate={handleRoleUpdate} /> : null}

          {activeTab === "announcements" ? (
            <form onSubmit={handleAnnounce} style={{ display: "grid", gap: 12, maxWidth: 640 }}>
              <textarea
                value={announcementText}
                onChange={(event) => setAnnouncementText(event.target.value)}
                maxLength={MAX_ANNOUNCEMENT_LENGTH}
                rows={4}
                placeholder="Write a message for everyone who is online"
                style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontFamily: "inherit" }}
              />
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                {announcementText.length}/{MAX_ANNOUNCEMENT_LENGTH}
              </div>
              <button type="submit" style={{ justifySelf: "start", padding: "10px 14px", borderRadius: 8, border: "none", background: "#111827", color: "#fff", cursor: "pointer" }}>
                Send announcement
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}
