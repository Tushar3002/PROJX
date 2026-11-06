import { col, fn, Op, where, type Model } from "sequelize";

import { models } from "../config/db.js";
import { hashPassword, verifyPassword } from "./authService.js";

export const MIN_GROUP_PASSWORD_LENGTH = 4;

// Group names are unique regardless of case, so "General" and "general" are the same group.
export function findGroupByName(name: string) {
  return models.Group.findOne({
    where: where(fn("lower", col("name")), name.trim().toLowerCase()),
  });
}

// General is always listed. Other groups only appear once the user has joined them.
export async function listGroups(userId: string) {
  const joinedGroupIds = [...(await listMemberGroupIds(userId))];

  return models.Group.findAll({
    where: { [Op.or]: [{ name: "General" }, { id: joinedGroupIds }] },
    order: [["name", "ASC"]],
  });
}

// Returns null when a group with that name already exists.
export async function createGroup(name: string, description: string | undefined, creatorId: string, password: string) {
  const trimmedName = name.trim();

  if (await findGroupByName(trimmedName)) {
    return null;
  }

  return models.Group.create({
    name: trimmedName,
    description: description?.trim() || null,
    createdById: creatorId,
    passwordHash: await hashPassword(password),
  });
}

export async function listMemberGroupIds(userId: string): Promise<Set<string>> {
  const memberships = await models.GroupMember.findAll({ where: { userId }, attributes: ["groupId"] });
  return new Set(memberships.map((membership) => membership.get("groupId") as string));
}

export async function addMember(groupId: string, userId: string): Promise<void> {
  await models.GroupMember.findOrCreate({ where: { groupId, userId } });
}

// Members who joined before keep access without the password. Everyone else needs the group password,
// unless the group has none.
export async function canJoinGroup(group: Model, userId: string, password: string | undefined): Promise<boolean> {
  const groupId = group.get("id") as string;
  const isMember = await models.GroupMember.findOne({ where: { groupId, userId } });

  if (isMember) {
    return true;
  }

  const passwordHash = group.get("passwordHash") as string | null;

  if (!passwordHash) {
    return true;
  }

  return password ? verifyPassword(password, passwordHash) : false;
}

// Returns the newest messages in chronological order.
export async function listRecentMessages(groupId: string, limit = 50): Promise<Model[]> {
  const messages = await models.Message.findAll({
    where: { groupId },
    include: [{ model: models.User, attributes: ["name"] }],
    order: [["createdAt", "DESC"]],
    limit,
  });

  return messages.reverse();
}

export function saveMessage(groupId: string, senderId: string, content: string) {
  return models.Message.create({ groupId, senderId, content });
}
