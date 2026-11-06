import { useState } from "react";

import type { RoleRecord } from "../api";

type Props = {
  roles: RoleRecord[];
  onUpdate: (roleId: string, name: string, description: string) => void;
};

const buttonStyle = { padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" };

// The server checks these by name, so they cannot be renamed.
const BUILT_IN_ROLES = ["admin", "user"];

export function RolesTable({ roles, onUpdate }: Props) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const startEditing = (role: RoleRecord) => {
    setEditingId(role.id);
    setName(role.name);
    setDescription(role.description ?? "");
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
  };

  const saveRole = (role: RoleRecord) => {
    const nextName = name.trim();
    if (!nextName) {
      return;
    }

    onUpdate(role.id, nextName, description.trim());
    resetForm();
  };

  const visibleRoles = roles.filter((role) => {
    const text = `${role.name} ${role.description ?? ""}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search roles"
        style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
      />

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "10px 8px" }}>Role</th>
              <th style={{ padding: "10px 8px" }}>Description</th>
              <th style={{ padding: "10px 8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRoles.map((role) => {
              const isEditing = editingId === role.id;

              if (isEditing) {
                return (
                  <tr key={role.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 8px" }}>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={BUILT_IN_ROLES.includes(role.name)}
                        title={BUILT_IN_ROLES.includes(role.name) ? "Built-in roles cannot be renamed" : undefined}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
                      />
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <input value={description} onChange={(event) => setDescription(event.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }} />
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => saveRole(role)} style={buttonStyle}>Save</button>
                        <button type="button" onClick={resetForm} style={buttonStyle}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={role.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 700 }}>{role.name}</td>
                  <td style={{ padding: "10px 8px" }}>{role.description || "—"}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <button type="button" onClick={() => startEditing(role)} style={buttonStyle}>Edit</button>
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
