import { Router } from "express";

import {
  getAdminGroups,
  getAdminUsers,
  getRoles,
  patchUserPermissions,
  patchRole,
  patchUserRole,
  postAnnouncement,
  postDisconnectUser,
} from "../controllers/adminController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

export const adminRoutes = Router();

// Every admin route needs a logged-in admin.
adminRoutes.use(requireAuth, requireRole("admin"));

adminRoutes.get("/users", getAdminUsers);
adminRoutes.patch("/users/:id/role", patchUserRole);
adminRoutes.patch("/users/:id/permissions", patchUserPermissions);
adminRoutes.post("/users/:id/disconnect", postDisconnectUser);
adminRoutes.get("/roles", getRoles);
adminRoutes.patch("/roles/:id", patchRole);
adminRoutes.get("/groups", getAdminGroups);
adminRoutes.post("/announcements", postAnnouncement);
