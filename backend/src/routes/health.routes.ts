import { Router } from "express";

import { getDatabaseHealthStatus, getHealth } from "../controllers/health.controller.js";

export const healthRouter = Router();

healthRouter.get("/health", getHealth);
healthRouter.get("/health/db", getDatabaseHealthStatus);
