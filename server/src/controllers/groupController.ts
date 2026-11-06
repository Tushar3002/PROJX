import type { Request, Response } from "express";
import type { Model } from "sequelize";

import {
  addMember,
  createGroup,
  listGroups,
  listMemberGroupIds,
  MIN_GROUP_PASSWORD_LENGTH,
} from "../services/groupService.js";

// The password hash is never sent to the client. Only whether a password is needed.
function toGroupDto(group: Model, isMember: boolean) {
  return {
    id: group.get("id"),
    name: group.get("name"),
    description: group.get("description") ?? "",
    requiresPassword: Boolean(group.get("passwordHash")),
    isMember,
  };
}

export async function getGroups(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const groups = await listGroups(req.user.id);
  const memberGroupIds = await listMemberGroupIds(req.user.id);

  res.status(200).json({
    groups: groups.map((group) => toGroupDto(group, memberGroupIds.has(group.get("id") as string))),
  });
}

export async function postGroup(req: Request, res: Response): Promise<void> {
  const { name, description, password } = req.body as { name?: string; description?: string; password?: string };

  if (!name?.trim()) {
    res.status(400).json({ message: "Group name is required" });
    return;
  }

  if (!password || password.length < MIN_GROUP_PASSWORD_LENGTH) {
    res.status(400).json({ message: `Group password must be at least ${MIN_GROUP_PASSWORD_LENGTH} characters` });
    return;
  }

  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (!req.user.canCreateGroup) {
    res.status(403).json({ message: "You are not allowed to create groups" });
    return;
  }

  const group = await createGroup(name, description, req.user.id, password);

  if (!group) {
    res.status(409).json({ message: "A group with this name already exists" });
    return;
  }

  // The creator is a member straight away, so they never need the password for this group.
  await addMember(group.get("id") as string, req.user.id);

  res.status(201).json({ message: "Group created", group: toGroupDto(group, true) });
}
