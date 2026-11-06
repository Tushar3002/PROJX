import type { Model } from "sequelize";

import { models } from "../config/db.js";

export interface UserPermissions {
  canCreateGroup: boolean;
  canSendMessage: boolean;
}

export interface AuthUser extends UserPermissions {
  id: string;
  name: string;
  email: string;
  // The role's name, for example "admin" or "user".
  role: string;
  roleId: string;
}

// Loads the role name with the user. Every user has exactly one role.
const withRole = { model: models.Role, attributes: ["id", "name", "updatedAt"] };

// A token issued before the user's role or permissions last changed is no longer valid.
export function isAccessChangedSince(user: Model, token: { issuedAt?: number; iat?: number }): boolean {
  const role = user.get("Role") as { updatedAt?: Date } | null | undefined;
  const permissionsUpdatedAt = user.get("permissionsUpdatedAt") as Date | undefined;
  const issuedAt = token.issuedAt ?? (token.iat ?? 0) * 1000;

  if (!issuedAt) {
    return false;
  }

  const changedAt = [role?.updatedAt, permissionsUpdatedAt]
    .filter((date): date is Date => date instanceof Date)
    .map((date) => date.getTime());

  return changedAt.some((time) => time > issuedAt);
}

export function findUserByEmail(email: string) {
  return models.User.findOne({ where: { email }, include: [withRole] });
}

export function findUserById(id: string) {
  return models.User.findByPk(id, { include: [withRole] });
}

export function listAllUsers() {
  return models.User.findAll({ include: [withRole], order: [["name", "ASC"]] });
}

export function findRoleByName(name: string) {
  return models.Role.findOne({ where: { name } });
}

// Returns null when the user does not exist.
export async function setUserRole(userId: string, roleId: string) {
  const user = await models.User.findByPk(userId);

  if (!user) {
    return null;
  }

  user.set("roleId", roleId);
  user.set("permissionsUpdatedAt", new Date());
  await user.save();
  return findUserById(userId);
}

// Returns null when the user does not exist.
export async function setUserPermissions(userId: string, permissions: Partial<UserPermissions>) {
  const user = await models.User.findByPk(userId);

  if (!user) {
    return null;
  }

  user.set({ ...permissions, permissionsUpdatedAt: new Date() });
  await user.save();
  return findUserById(userId);
}

export function toAuthUser(user: Model): AuthUser {
  const role = user.get("Role") as { name: string } | null | undefined;

  return {
    id: user.get("id") as string,
    name: user.get("name") as string,
    email: user.get("email") as string,
    role: role?.name ?? "",
    roleId: user.get("roleId") as string,
    canCreateGroup: user.get("canCreateGroup") as boolean,
    canSendMessage: user.get("canSendMessage") as boolean,
  };
}
