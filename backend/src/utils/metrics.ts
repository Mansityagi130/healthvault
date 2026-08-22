// Very basic in-memory metrics store for 26B.8

let totalRequests = 0;
let totalErrors = 0;
const statusCounts: Record<number, number> = {};
const durationSum = { total: 0, count: 0 };

// Background job metrics
let jobsTotal = 0;
let jobsCompleted = 0;
let jobsFailed = 0;
let jobsRetried = 0;
const jobDurationSum = { total: 0, count: 0 };
let getQueueDepthFn: () => Promise<number> = async () => 0;

export const metrics = {
  incrementRequest() {
    totalRequests++;
  },
  incrementStatus(statusCode: number) {
    statusCounts[statusCode] = (statusCounts[statusCode] || 0) + 1;
    if (statusCode >= 500) {
      totalErrors++;
    }
  },
  recordDuration(ms: number) {
    durationSum.total += ms;
    durationSum.count++;
  },
  incrementJobsTotal() {
    jobsTotal++;
  },
  incrementJobsCompleted() {
    jobsCompleted++;
  },
  incrementJobsFailed() {
    jobsFailed++;
  },
  incrementJobsRetried() {
    jobsRetried++;
  },
  recordJobDuration(ms: number) {
    jobDurationSum.total += ms;
    jobDurationSum.count++;
  },
  registerQueueDepthProvider(fn: () => Promise<number>) {
    getQueueDepthFn = fn;
  },
  async getMetrics() {
    const queueDepth = await getQueueDepthFn().catch(() => 0);
    return {
      uptime_seconds: process.uptime(),
      requests_total: totalRequests,
      errors_total: totalErrors,
      status_codes: { ...statusCounts },
      avg_duration_ms: durationSum.count > 0 ? (durationSum.total / durationSum.count) : 0,
      jobs_total: jobsTotal,
      jobs_completed: jobsCompleted,
      jobs_failed: jobsFailed,
      jobs_retried: jobsRetried,
      avg_job_duration_ms: jobDurationSum.count > 0 ? (jobDurationSum.total / jobDurationSum.count) : 0,
      queue_depth: queueDepth,
    };
  }
};
