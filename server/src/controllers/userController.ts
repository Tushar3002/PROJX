import type { Request, Response } from "express";

export function getProfile(req: Request, res: Response): void {
  res.status(200).json({ user: req.user });
}
