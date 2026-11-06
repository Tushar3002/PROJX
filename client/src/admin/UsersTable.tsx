import { useState } from "react";

import type { UserPermissions } from "../api";
import type { AdminUser } from "./adminData";

type Props = {
  users: AdminUser[];
  currentUserId: string;
  onRoleChange: (user: AdminUser) => void;
  onDisconnect: (user: AdminUser) => void;
  onSavePermissions: (user: AdminUser, permissions: UserPermissions) => void;
};

const buttonStyle = { padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" };

const PERMISSION_LABELS: Record<keyof UserPermissions, string> = {
  canCreateGroup: "Create groups",
  canSendMessage: "Send messages",
};

export function UsersTable({ users, currentUserId, onRoleChange, onDisconnect, onSavePermissions }: Props) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UserPermissions>({ canCreateGroup: true, canSendMessage: true });

  const visibleUsers = users.filter((user) => {
    const text = `${user.name} ${user.email} ${user.role}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const editingUser = users.find((user) => user.id === editingId) ?? null;

  const startEditing = (user: AdminUser) => {
    setEditingId(user.id);
    setDraft({ canCreateGroup: user.canCreateGroup, canSendMessage: user.canSendMessage });
  };

  const saveEditing = (user: AdminUser) => {
    onSavePermissions(user, draft);
    setEditingId(null);
  };

  if (editingUser) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <button type="button" onClick={() => setEditingId(null)} style={{ ...buttonStyle, justifySelf: "start" }}>
          ← Back to users
        </button>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, background: "#fff" }}>
          <h3 style={{ margin: "0 0 12px" }}>Edit permissions for {editingUser.name}</h3>

          <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            {(Object.keys(PERMISSION_LABELS) as Array<keyof UserPermissions>).map((key) => (
              <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                <span>{PERMISSION_LABELS[key]}</span>
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))}
                />
              </label>
            ))}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button type="button" onClick={() => saveEditing(editingUser)} style={buttonStyle}>Save changes</button>
              <button type="button" onClick={() => setEditingId(null)} style={buttonStyle}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search users"
        style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
      />

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "10px 8px" }}>Name</th>
              <th style={{ padding: "10px 8px" }}>Email</th>
              <th style={{ padding: "10px 8px" }}>Status</th>
              <th style={{ padding: "10px 8px" }}>Role</th>
              <th style={{ padding: "10px 8px" }}>Permissions</th>
              <th style={{ padding: "10px 8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user) => {
              const isSelf = user.id === currentUserId;

              return (
                <tr key={user.id} style={{ borderBottom: "1px solid #f3f4f6", verticalAlign: "top" }}>
                  <td style={{ padding: "10px 8px" }}>
                    {user.name} {isSelf ? <span style={{ color: "#6b7280" }}>(you)</span> : null}
                  </td>
                  <td style={{ padding: "10px 8px" }}>{user.email}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <span style={{ color: user.online ? "#166534" : "#6b7280", fontWeight: 700 }}>{user.online ? "Online" : "Offline"}</span>
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <span style={{ padding: "4px 10px", borderRadius: 999, background: user.role === "admin" ? "#fef3c7" : "#e5e7eb", fontWeight: 700 }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ display: "grid", gap: 4, color: "#374151" }}>
                      <span>{user.canCreateGroup ? "✓" : "✗"} Create groups</span>
                      <span>{user.canSendMessage ? "✓" : "✗"} Send messages</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => startEditing(user)} disabled={isSelf} style={{ ...buttonStyle, opacity: isSelf ? 0.5 : 1 }}>
                        Edit permissions
                      </button>
                      <button type="button" onClick={() => onRoleChange(user)} disabled={isSelf && user.role === "admin"} style={{ ...buttonStyle, opacity: isSelf && user.role === "admin" ? 0.5 : 1 }}>
                        {user.role === "admin" ? "Make user" : "Make admin"}
                      </button>
                      {user.online && !isSelf ? (
                        <button type="button" onClick={() => onDisconnect(user)} style={buttonStyle}>
                          Disconnect
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
