import { databaseClient } from "../config/database.js";
import type { DatabaseHealthChecker } from "./database-health.service.js";

export const prismaHealthChecker: DatabaseHealthChecker = {
  async ping(): Promise<void> {
    const prisma = databaseClient.getClient();
    await prisma.$queryRaw`SELECT 1`;
  }
};
