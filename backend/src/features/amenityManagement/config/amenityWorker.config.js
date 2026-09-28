export const AMENITY_WORKER_CONFIG = {
  holdExpiration: {
    intervalMs: parseInt(process.env.AMENITY_HOLD_WORKER_INTERVAL_MS || '30000', 10),
    batchSize: parseInt(process.env.AMENITY_HOLD_WORKER_BATCH_SIZE || '100', 10),
  },
  lifecycle: {
    intervalMs: parseInt(process.env.AMENITY_LIFECYCLE_WORKER_INTERVAL_MS || '60000', 10),
  },
  outbox: {
    intervalMs: parseInt(process.env.AMENITY_OUTBOX_WORKER_INTERVAL_MS || '10000', 10),
    batchSize: parseInt(process.env.AMENITY_OUTBOX_WORKER_BATCH_SIZE || '50', 10),
    staleProcessingTimeoutMs: parseInt(process.env.AMENITY_OUTBOX_PROCESSING_TIMEOUT_MS || '300000', 10), // 5 minutes
    baseRetryDelayMs: parseInt(process.env.AMENITY_OUTBOX_BASE_RETRY_DELAY_MS || '2000', 10),
    maxRetryDelayMs: parseInt(process.env.AMENITY_OUTBOX_MAX_RETRY_DELAY_MS || '300000', 10),
    maxRetries: parseInt(process.env.AMENITY_OUTBOX_MAX_RETRIES || '5', 10),
  },
};

export default AMENITY_WORKER_CONFIG;
