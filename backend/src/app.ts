import cors from "cors";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { apiRouter } from "./routes/index.js";
import { operationalRouter } from "./routes/operational.routes.js";

export const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(requestIdMiddleware);
app.use(requestLogger);

// Health & Metrics (mounted high up, no auth required)
app.use(operationalRouter);

app.use("/api", apiRouter);
app.use(errorHandler);
