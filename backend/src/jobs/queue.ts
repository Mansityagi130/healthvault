import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';
import { processDocumentScan } from './document-scan/index.js';
import { processNotification } from './notification/index.js';
import { processAbdmExchange } from './abdm/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let backgroundQueue: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let backgroundWorker: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let backgroundQueueEvents: any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockJobs: { id: string; name: string; data: any; attemptsMade: number }[] = [];

export const getMockJobs = () => mockJobs;

export const processAllMockJobs = async () => {
  while (mockJobs.length > 0) {
    const job = mockJobs.shift()!;
    logger.info(`[Test Mock Queue] Processing job ${job.id} of type ${job.name}`);
    const start = Date.now();
    try {
      metrics.incrementJobsTotal();
      if (job.attemptsMade > 0) {
        metrics.incrementJobsRetried();
      }
      switch (job.name) {
        case 'DOCUMENT_SCAN':
          await processDocumentScan(job.data);
          break;
        case 'NOTIFICATION':
          await processNotification(job.data);
          break;
        case 'ABDM_EXCHANGE':
          await processAbdmExchange(job.data);
          break;
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
      metrics.recordJobDuration(Date.now() - start);
      metrics.incrementJobsCompleted();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      metrics.recordJobDuration(Date.now() - start);
      metrics.incrementJobsFailed();
      logger.error(`[Test Mock Queue] Failed job ${job.id}`, { error: error.message });
      throw error;
    }
  }
};

if (env.NODE_ENV === 'test') {
  backgroundQueue = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    add: async (name: string, data: any, opts?: any) => {
      const id = opts?.jobId || `mock-${Date.now()}-${Math.random()}`;
      if (mockJobs.some(j => j.id === id)) {
        return { id };
      }
      mockJobs.push({ id, name, data, attemptsMade: 0 });
      return { id };
    },
    getJobCounts: async () => {
      return { wait: mockJobs.length, active: 0, delayed: 0 };
    },
    close: async () => {}
  };
  backgroundWorker = {
    close: async () => {}
  };
  backgroundQueueEvents = {
    close: async () => {}
  };
} else {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  connection.on('error', (err: unknown) => {
    if (env.NODE_ENV === 'production') {
      logger.error('Redis connection error in production', { error: (err as Error).message });
    }
  });

  backgroundQueue = new Queue('healthvault-background-jobs', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false, // Keep dead letters
    }
  });

  backgroundQueueEvents = new QueueEvents('healthvault-background-jobs', { connection });

  // Initialize the worker
  backgroundWorker = new Worker('healthvault-background-jobs', async (job: Job) => {
    metrics.incrementJobsTotal();
    if (job.attemptsMade > 0) {
      metrics.incrementJobsRetried();
    }
    
    logger.info(`Processing job ${job.id} of type ${job.name}, attempt ${job.attemptsMade + 1}`);
    const start = Date.now();
    try {
      switch (job.name) {
        case 'DOCUMENT_SCAN':
          await processDocumentScan(job.data);
          break;
        case 'NOTIFICATION':
          await processNotification(job.data);
          break;
        case 'ABDM_EXCHANGE':
          await processAbdmExchange(job.data);
          break;
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
      const duration = Date.now() - start;
      metrics.recordJobDuration(duration);
      metrics.incrementJobsCompleted();
      logger.info(`Completed job ${job.id}`, { duration, jobName: job.name });
    } catch (error: unknown) {
      const duration = Date.now() - start;
      metrics.recordJobDuration(duration);
      metrics.incrementJobsFailed();
      logger.error(`Failed job ${job.id}`, { duration, jobName: job.name, error: (error as Error).message });
      throw error;
    }
  }, {
    connection,
    concurrency: 5, // Limit document scanning concurrency
    drainDelay: process.env.NODE_ENV === 'production' ? 15 : 5,
  });
}

metrics.registerQueueDepthProvider(async () => {
  const counts = await backgroundQueue.getJobCounts('wait', 'active', 'delayed');
  return (counts.wait ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
});
