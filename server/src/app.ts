import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { groupRoutes } from "./routes/groupRoutes.js";
import { userRoutes } from "./routes/userRoutes.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json());

  app.use("/api", authRoutes);
  app.use("/api", userRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api", groupRoutes);

  return app;
}
