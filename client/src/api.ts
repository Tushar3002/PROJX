import axios from "axios";

const TOKEN_KEY = "chat-token";

export interface UserPermissions {
  canCreateGroup: boolean;
  canSendMessage: boolean;
}

export interface AuthUser extends UserPermissions {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage is unavailable (for example private mode). The session just will not survive a reload.
  }
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) {
      return message;
    }
  }

  return "Something went wrong. Please try again.";
}

export const authApi = {
  async register(name: string, email: string, password: string): Promise<void> {
    await api.post("/api/register", { name, email, password });
  },

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const { data } = await api.post<{ token: string; user: AuthUser }>("/api/login", { email, password });
    return data;
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<{ user: AuthUser }>("/api/me");
    return data.user;
  },
};

export interface GroupInfo {
  id: string;
  name: string;
  description: string;
  requiresPassword: boolean;
  isMember: boolean;
}

export const groupApi = {
  async list(): Promise<GroupInfo[]> {
    const { data } = await api.get<{ groups: GroupInfo[] }>("/api/groups");
    return data.groups;
  },

  async create(name: string, description: string, password: string): Promise<GroupInfo> {
    const { data } = await api.post<{ group: GroupInfo }>("/api/groups", { name, description, password });
    return data.group;
  },
};

export interface AdminUser extends AuthUser {
  online: boolean;
}

export interface AdminGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
}

export interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
}

export const adminApi = {
  async users(): Promise<AdminUser[]> {
    const { data } = await api.get<{ users: AdminUser[] }>("/api/admin/users");
    return data.users;
  },

  async roles(): Promise<RoleRecord[]> {
    const { data } = await api.get<{ roles: RoleRecord[] }>("/api/admin/roles");
    return data.roles;
  },

  async updateRole(roleId: string, name: string, description: string): Promise<void> {
    await api.patch(`/api/admin/roles/${roleId}`, { name, description });
  },

  async setRole(userId: string, role: AuthUser["role"]): Promise<void> {
    await api.patch(`/api/admin/users/${userId}/role`, { role });
  },

  async setPermissions(userId: string, permissions: Partial<UserPermissions>): Promise<void> {
    await api.patch(`/api/admin/users/${userId}/permissions`, permissions);
  },

  async disconnect(userId: string): Promise<void> {
    await api.post(`/api/admin/users/${userId}/disconnect`);
  },

  async groups(): Promise<AdminGroup[]> {
    const { data } = await api.get<{ groups: AdminGroup[] }>("/api/admin/groups");
    return data.groups;
  },

  async announce(text: string): Promise<void> {
    await api.post("/api/admin/announcements", { text });
  },
};
