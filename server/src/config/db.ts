import { Sequelize } from "sequelize";

import { defineModels } from "../models/index.js";
import { env } from "./env.js";

export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: "postgres",
  logging: false,
});

export const models = defineModels(sequelize);

export const BUILT_IN_ROLES = ["admin", "user"];

export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate();
  console.log("Database connected with Sequelize");
}

export async function syncDatabase(): Promise<void> {
  // Creates missing tables only. Column changes are made with explicit SQL, not automatically,
  // because `alter: true` piles up duplicate constraints on every start.
  await sequelize.sync();
  await seedRoles();
  await seedGeneralGroup();
  console.log("Database synced with Sequelize");
}

async function seedRoles(): Promise<void> {
  const roleSeed = [
    { name: "admin", description: "System administrators" },
    { name: "user", description: "Regular users" },
  ];

  for (const role of roleSeed) {
    await models.Role.findOrCreate({
      where: { name: role.name },
      defaults: { description: role.description },
    });
  }
}

// Every user can see and join the General group, so it must always exist.
async function seedGeneralGroup(): Promise<void> {
  await models.Group.findOrCreate({
    where: { name: "General" },
    defaults: { name: "General", description: "Everyone starts here", createdById: null },
  });
}
