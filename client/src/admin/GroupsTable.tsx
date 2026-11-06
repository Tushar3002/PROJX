import type { AdminGroup } from "./adminData";

type Props = {
  groups: AdminGroup[];
};

export function GroupsTable({ groups }: Props) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "10px 8px" }}>Group</th>
              <th style={{ padding: "10px 8px" }}>Description</th>
              <th style={{ padding: "10px 8px" }}>Members</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "10px 8px", fontWeight: 700 }}>{group.name}</td>
                <td style={{ padding: "10px 8px" }}>{group.description}</td>
                <td style={{ padding: "10px 8px" }}>{group.memberCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
