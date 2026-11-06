import { Router } from "express";

import { getGroups, postGroup } from "../controllers/groupController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const groupRoutes = Router();

groupRoutes.get("/groups", requireAuth, getGroups);
groupRoutes.post("/groups", requireAuth, postGroup);
