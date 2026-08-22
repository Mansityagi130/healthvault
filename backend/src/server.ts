import { app } from "./app.js";
import { env } from "./config/env.js";
import { databaseClient } from "./config/database.js";
import { logger } from "./utils/logger.js";
import { startOutboxPoller, stopOutboxPoller } from "./jobs/outbox-poller.js";
import { backgroundQueue, backgroundWorker } from "./jobs/queue.js";

const server = app.listen(env.PORT, () => {
  logger.info(`HealthVault API listening on http://localhost:${env.PORT}`);
  startOutboxPoller();
});

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}, initiating graceful shutdown...`);

  // Bounded shutdown timeout
  const forceExit = setTimeout(() => {
    logger.error("Shutdown timeout exceeded, forcing exit.");
    process.exit(1);
  }, 10000);
  forceExit.unref();

  // 1. Stop outbox poller and close BullMQ queue & worker
  stopOutboxPoller();
  try {
    await backgroundWorker.close();
    await backgroundQueue.close();
    logger.info("BullMQ queue and worker closed successfully.");
  } catch (queueErr) {
    logger.error("Error closing BullMQ resources", { error: queueErr });
  }

  // 2. Stop accepting new traffic
  server.close(async (err) => {
    if (err) {
      logger.error("Error closing HTTP server", { error: err });
    } else {
      logger.info("HTTP server closed.");
    }

    try {
      // 3. Disconnect Prisma safely
      await databaseClient.disconnect();
      logger.info("Database connections closed safely.");
    } catch (dbErr) {
      logger.error("Error disconnecting database", { error: dbErr });
    }

    // 4. Flush/finish logging and exit cleanly
    logger.info("Graceful shutdown complete.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
