import type { Request, Response } from "express";

import { models } from "../config/db.js";
import { hashPassword, signToken, verifyPassword } from "../services/authService.js";
import { findRoleByName, findUserByEmail, findUserById, toAuthUser } from "../services/userService.js";

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };

  if (!name || !email || !password) {
    res.status(400).json({ message: "Name, email and password are required" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (await findUserByEmail(normalizedEmail)) {
    res.status(409).json({ message: "Email is already registered" });
    return;
  }

  // New users always start with the built-in "user" role. Admins are promoted afterwards.
  const defaultRole = await findRoleByName("user");

  if (!defaultRole) {
    throw new Error('The built-in "user" role is missing. Restart the server to re-seed roles.');
  }

  const user = await models.User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    roleId: defaultRole.get("id") as string,
  });

  // Reload so the response includes the role name.
  const created = await findUserById(user.get("id") as string);

  res.status(201).json({
    message: "User created successfully",
    user: toAuthUser(created ?? user),
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  const user = await findUserByEmail(email.trim().toLowerCase());
  const passwordMatches = user ? await verifyPassword(password, user.get("passwordHash") as string) : false;

  // Same message for unknown email and wrong password, so the response does not reveal which emails exist.
  if (!user || !passwordMatches) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const authUser = toAuthUser(user);

  res.status(200).json({
    token: signToken(authUser.id, authUser.email),
    user: authUser,
  });
}

// Tokens are stateless JWTs, so the server has nothing to revoke yet.
// The client discards its token. Revocation would need a token table, which is not in the schema.
export function logout(_req: Request, res: Response): void {
  res.status(200).json({ message: "Logged out successfully" });
}
