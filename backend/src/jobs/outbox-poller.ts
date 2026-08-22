import { databaseClient } from '../config/database.js';
import { backgroundQueue } from './queue.js';
import { logger } from '../utils/logger.js';

const prisma = databaseClient.getClient();

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
  pollerInterval = setInterval(pollOutbox, 2000);
};

export const stopOutboxPoller = () => {
  if (pollerInterval) clearInterval(pollerInterval);
};
