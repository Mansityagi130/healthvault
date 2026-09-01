import { Router } from "express";
import { databaseClient } from "../config/database.js";
import { metrics } from "../utils/metrics.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export const operationalRouter = Router();

// Liveness: Process is responding
operationalRouter.get("/health/live", (req, res) => {
  res.status(200).json({ status: "alive", uptime: process.uptime() });
});

// Readiness: App is ready to serve traffic (DB connected)
operationalRouter.get("/health/ready", async (req, res) => {
  try {
    const prisma = databaseClient.getClient();
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Health readiness check failed", { error: errorMessage });
    if (env.NODE_ENV === "development") {
      res.status(503).json({ status: "not_ready", error: "Database unavailable", details: errorMessage });
    } else {
      res.status(503).json({ status: "not_ready" });
    }
  }
});

// Metrics endpoint (internal/operational)
operationalRouter.get("/metrics", async (req, res) => {
  res.status(200).json(await metrics.getMetrics());
});
