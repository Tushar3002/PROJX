import type { NextFunction, Request, Response } from "express";

import { verifyToken, type TokenPayload } from "../services/authService.js";
import { findUserById, isAccessChangedSince, toAuthUser } from "../services/userService.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  let payload: TokenPayload;

  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  // Load the user from the database on every request, so roles and deleted users are always current.
  const user = await findUserById(payload.sub);

  if (!user) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  if (isAccessChangedSince(user, payload)) {
    res.status(401).json({ message: "Your access was updated. Please log in again." });
    return;
  }

  req.user = toAuthUser(user);
  next();
}
