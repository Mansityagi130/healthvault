import { Router } from "express";
import { databaseClient } from "../config/database.js";
import { metrics } from "../utils/metrics.js";

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
  } catch (error) {
    res.status(503).json({ status: "not_ready", error: "Database unavailable" });
  }
});

// Metrics endpoint (internal/operational)
operationalRouter.get("/metrics", async (req, res) => {
  res.status(200).json(await metrics.getMetrics());
});
