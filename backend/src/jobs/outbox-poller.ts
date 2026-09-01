import { databaseClient } from '../config/database.js';
import { backgroundQueue } from './queue.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

const prisma = databaseClient.getClient();

// Check if we should skip outbox polling in local development with a remote database
const isLocalDatabase = env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1');
const isLocalDevUnreachableDatabase = env.NODE_ENV === 'development' && !isLocalDatabase;

export const pollOutbox = async () => {
  try {
    const events = await prisma.outboxEvent.findMany({
      where: { status: 'PENDING' },
      take: 100,
      orderBy: { createdAt: 'asc' }
    });

    for (const event of events) {
      try {
        await backgroundQueue.add(event.topic, event.payload, {
          jobId: `outbox-${event.id}`
        });

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'PROCESSED' }
        });
      } catch (err: unknown) {
        logger.error(`Failed to process outbox event ${event.id}`, { error: (err as Error).message });
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'FAILED', error: (err as Error).message }
        });
      }
    }
  } catch (err: unknown) {
    logger.error('Failed to poll outbox', { error: (err as Error).message });
  }
};

let pollerInterval: NodeJS.Timeout;

export const startOutboxPoller = () => {
  if (isLocalDevUnreachableDatabase) {
    logger.info('[Outbox] Detected remote database URL in local development environment. Skipping outbox polling to avoid connection timeouts.');
    return;
  }

  const interval = process.env.NODE_ENV === 'production' ? 10000 : 2000;
  pollerInterval = setInterval(pollOutbox, interval);
};

export const stopOutboxPoller = () => {
  if (pollerInterval) clearInterval(pollerInterval);
};
