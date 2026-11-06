import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

const SALT_ROUNDS = 12;

export interface TokenPayload {
  sub: string;
  email: string;
  // Exact issue time in milliseconds. Used to tell whether the token predates a role or permission change.
  issuedAt?: number;
  // Issue time in seconds, added by jsonwebtoken. Only used for tokens made before issuedAt existed.
  iat?: number;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(userId: string, email: string): string {
  const payload: TokenPayload = { sub: userId, email, issuedAt: Date.now() };
  const options = { expiresIn: env.jwtExpiresIn } as jwt.SignOptions;
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}
