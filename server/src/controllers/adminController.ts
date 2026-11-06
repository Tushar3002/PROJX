import type { Request, Response } from "express";

import { BUILT_IN_ROLES, models } from "../config/db.js";
import { broadcastAnnouncement, disconnectUser, disconnectUsersByRoleId, getOnlineUserIds } from "../sockets/chatSocket.js";
import { findRoleByName, findUserById, listAllUsers, setUserPermissions, setUserRole, toAuthUser } from "../services/userService.js";

const MAX_ANNOUNCEMENT_LENGTH = 500;
const MAX_ROLE_NAME_LENGTH = 50;
const MAX_ROLE_DESCRIPTION_LENGTH = 255;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_NAME_PATTERN = /^[a-z0-9_-]+$/i;

function idFromParams(req: Request): string | null {
  const { id } = req.params as { id?: string };
  return id && UUID_PATTERN.test(id) ? id : null;
}

export async function getAdminUsers(_req: Request, res: Response): Promise<void> {
  const [users, online] = await Promise.all([listAllUsers(), getOnlineUserIds()]);
  res.status(200).json({
    users: users.map((user) => ({ ...toAuthUser(user), online: online.has(user.get("id") as string) })),
  });
}

export async function patchUserRole(req: Request, res: Response): Promise<void> {
  const userId = idFromParams(req);
  const { role } = req.body as { role?: unknown };

  if (!userId) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  if (typeof role !== "string" || !role.trim()) {
    res.status(400).json({ message: "Role name is required" });
    return;
  }

  const roleRecord = await findRoleByName(role.trim());

  if (!roleRecord) {
    res.status(400).json({ message: `No role named "${role.trim()}" exists` });
    return;
  }

  // Stops the last admin from locking themselves out.
  if (userId === req.user?.id && roleRecord.get("name") !== "admin") {
    res.status(400).json({ message: "You cannot remove your own admin role" });
    return;
  }

  const user = await setUserRole(userId, roleRecord.get("id") as string);

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  // Their open connections still carry the old role, so close them and let the user log in again.
  await disconnectUser(userId, "Your role was changed. Please log in again.");

  res.status(200).json({ user: toAuthUser(user) });
}

export async function patchUserPermissions(req: Request, res: Response): Promise<void> {
  const userId = idFromParams(req);
  const { canCreateGroup, canSendMessage } = req.body as { canCreateGroup?: unknown; canSendMessage?: unknown };

  if (!userId) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  if (typeof canCreateGroup !== "boolean" && typeof canSendMessage !== "boolean") {
    res.status(400).json({ message: "Send canCreateGroup and/or canSendMessage as true or false" });
    return;
  }

  // Changing your own permissions could lock you out of the app.
  if (userId === req.user?.id) {
    res.status(400).json({ message: "You cannot change your own permissions" });
    return;
  }

  const changes: { canCreateGroup?: boolean; canSendMessage?: boolean } = {};
  if (typeof canCreateGroup === "boolean") changes.canCreateGroup = canCreateGroup;
  if (typeof canSendMessage === "boolean") changes.canSendMessage = canSendMessage;

  const user = await setUserPermissions(userId, changes);

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  // Sign the user out so the new permissions apply on their next login.
  await disconnectUser(userId, "Your permissions were updated. Please log in again.");

  res.status(200).json({ user: toAuthUser(user) });
}

export async function getRoles(_req: Request, res: Response): Promise<void> {
  const roles = await models.Role.findAll({ order: [["name", "ASC"]] });

  res.status(200).json({
    roles: roles.map((role) => ({
      id: role.get("id"),
      name: role.get("name"),
      description: role.get("description"),
    })),
  });
}

export async function patchRole(req: Request, res: Response): Promise<void> {
  const roleId = idFromParams(req);
  const { name, description } = req.body as { name?: unknown; description?: unknown };

  if (!roleId) {
    res.status(404).json({ message: "Role not found" });
    return;
  }

  const role = await models.Role.findByPk(roleId);

  if (!role) {
    res.status(404).json({ message: "Role not found" });
    return;
  }

  const previousName = role.get("name") as string;
  const nextName = typeof name === "string" ? name.trim() : "";

  if (!nextName) {
    res.status(400).json({ message: "Role name is required" });
    return;
  }

  if (nextName.length > MAX_ROLE_NAME_LENGTH) {
    res.status(400).json({ message: `Role name can be at most ${MAX_ROLE_NAME_LENGTH} characters` });
    return;
  }

  if (!ROLE_NAME_PATTERN.test(nextName)) {
    res.status(400).json({ message: "Role name can only use letters, numbers, - and _" });
    return;
  }

  const renamed = nextName !== previousName;

  // The code checks "admin" and "user" by name, so those two cannot be renamed.
  if (renamed && BUILT_IN_ROLES.includes(previousName)) {
    res.status(400).json({ message: `The "${previousName}" role is built in and cannot be renamed` });
    return;
  }

  if (renamed && (await findRoleByName(nextName))) {
    res.status(409).json({ message: `A role named "${nextName}" already exists` });
    return;
  }

  if (typeof description === "string" && description.trim().length > MAX_ROLE_DESCRIPTION_LENGTH) {
    res.status(400).json({ message: `Description can be at most ${MAX_ROLE_DESCRIPTION_LENGTH} characters` });
    return;
  }

  role.set("name", nextName);
  role.set("updatedAt", new Date());

  if (typeof description === "string") {
    role.set("description", description.trim() || null);
  }

  try {
    await role.save();
  } catch (error) {
    // A parallel request may have taken the name between the check above and this save.
    if ((error as { name?: string }).name === "SequelizeUniqueConstraintError") {
      res.status(409).json({ message: `A role named "${nextName}" already exists` });
      return;
    }

    throw error;
  }

  // Every edit logs out the users with this role. Their tokens are also rejected from now on.
  await disconnectUsersByRoleId(roleId, "Your role was updated. Please log in again.");

  res.status(200).json({
    role: {
      id: role.get("id"),
      name: role.get("name"),
      description: role.get("description"),
    },
  });
}

export async function postDisconnectUser(req: Request, res: Response): Promise<void> {
  const userId = idFromParams(req);

  if (!userId || !(await findUserById(userId))) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  if (userId === req.user?.id) {
    res.status(400).json({ message: "You cannot disconnect yourself" });
    return;
  }

  await disconnectUser(userId);
  res.status(200).json({ message: "User disconnected" });
}

export async function getAdminGroups(_req: Request, res: Response): Promise<void> {
  const groups = await models.Group.findAll({ order: [["name", "ASC"]] });
  const memberships = await models.GroupMember.findAll({ attributes: ["groupId"] });

  const memberCounts = new Map<string, number>();
  for (const membership of memberships) {
    const groupId = membership.get("groupId") as string;
    memberCounts.set(groupId, (memberCounts.get(groupId) ?? 0) + 1);
  }

  res.status(200).json({
    groups: groups.map((group) => ({
      id: group.get("id"),
      name: group.get("name"),
      description: group.get("description") ?? "",
      memberCount: memberCounts.get(group.get("id") as string) ?? 0,
    })),
  });
}

export function postAnnouncement(req: Request, res: Response): void {
  const { text } = req.body as { text?: string };
  const cleanText = text?.trim();

  if (!cleanText) {
    res.status(400).json({ message: "Announcement text is required" });
    return;
  }

  if (cleanText.length > MAX_ANNOUNCEMENT_LENGTH) {
    res.status(400).json({ message: `Announcements can be at most ${MAX_ANNOUNCEMENT_LENGTH} characters` });
    return;
  }

  broadcastAnnouncement(cleanText, req.user?.name ?? "Admin");
  res.status(201).json({ message: "Announcement sent" });
}
