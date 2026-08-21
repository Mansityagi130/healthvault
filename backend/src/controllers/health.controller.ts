import type { RequestHandler } from "express";

import { getDatabaseHealth } from "../services/database-health.service.js";
import { prismaHealthChecker } from "../services/prisma-health-checker.service.js";

export const getHealth: RequestHandler = (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "healthvault-api",
    version: "0.1.0"
  });
};

export const getDatabaseHealthStatus: RequestHandler = async (_request, response) => {
  const database = await getDatabaseHealth(prismaHealthChecker);
  const isDatabaseAvailable = database.status === "ok";

  response.status(isDatabaseAvailable ? 200 : 503).json({
    status: isDatabaseAvailable ? "ok" : "degraded",
    service: "healthvault-api",
    api: { status: "ok" },
    database
  });
};
