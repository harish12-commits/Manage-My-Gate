import { v4 as uuidv4 } from 'uuid';
import amenityReservationHoldService from '../holds/amenityReservationHold.service.js';
import logger, { loggerStorage } from '../../../utils/logger.utils.js';
import AMENITY_WORKER_CONFIG from '../config/amenityWorker.config.js';

export class AmenityHoldExpirationWorker {
  constructor() {
    this.intervalId = null;
    this.isExecuting = false;
    this.intervalMs = AMENITY_WORKER_CONFIG.holdExpiration.intervalMs;
    this.batchSize = AMENITY_WORKER_CONFIG.holdExpiration.batchSize;
  }

  /**
   * Initializes periodic polling for stale active reservation holds.
   * Safe against accidental duplicate calls.
   * @param {Object} [options]
   * @param {number} [options.intervalMs]
   * @param {number} [options.batchSize]
   */
  async dropLegacyHoldTtlIndex() {
    try {
      const { AmenityReservationHold } = await import('../holds/amenityReservationHold.model.js');
      const indexes = await AmenityReservationHold.collection.indexes();
      if (indexes.some((i) => i.name === 'idx_reservation_holds_ttl')) {
        await AmenityReservationHold.collection.dropIndex('idx_reservation_holds_ttl');
        await AmenityReservationHold.syncIndexes();
        logger.info('[AmenityHoldWorker] Replaced the hold TTL index with 30-day retention');
      }
    } catch (err) {
      logger.warn(`[AmenityHoldWorker] Hold index migration skipped: ${err.message}`);
    }
  }

  initWorker(options = {}) {
    if (this.intervalId) {
      logger.warn('[AmenityHoldWorker] Worker already running. Skipping duplicate init.');
      return;
    }

    if (options.intervalMs) this.intervalMs = options.intervalMs;
    if (options.batchSize) this.batchSize = options.batchSize;

    logger.info(`⚙️ [AmenityHoldWorker] Initialized. Polling every ${this.intervalMs}ms (batchSize: ${this.batchSize})`);

    // Holds used to be deleted by a TTL index the moment they expired, before this worker
    // could release their quota, and before a late gateway capture could be matched.
    this.dropLegacyHoldTtlIndex();

    this.intervalId = setInterval(async () => {
      try {
        await this.runOnce();
      } catch (err) {
        logger.error(`[AmenityHoldWorker] Polling iteration error: ${err.message}`, { error: err });
      }
    }, this.intervalMs);
  }

  /**
   * Stops background polling interval and cleans up resources.
   */
  stopWorker() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('⚙️ [AmenityHoldWorker] Stopped successfully.');
    }
  }

  /**
   * Executes a single sweep of stale active holds.
   * Concurrency-guarded: prevents overlapping runs if a previous run is still executing.
   * Correlated via loggerStorage with unique execution/job ID.
   * @returns {Promise<{ expiredCount: number, durationMs: number }>}
   */
  async runOnce() {
    if (this.isExecuting) {
      logger.warn('[AmenityHoldWorker] Previous execution still active. Skipping overlapping run.');
      return { expiredCount: 0, durationMs: 0 };
    }

    this.isExecuting = true;
    const jobId = `worker-amenity-hold-${uuidv4()}`;
    const startTime = Date.now();

    return loggerStorage.run(jobId, async () => {
      try {
        const expiredResults = await amenityReservationHoldService.expireStaleActiveHolds(this.batchSize);
        const durationMs = Date.now() - startTime;
        const expiredCount = expiredResults?.length || 0;

        if (expiredCount > 0) {
          logger.info(`[AmenityHoldWorker] Swept and expired ${expiredCount} stale active hold(s) in ${durationMs}ms`, {
            jobId,
            workerName: 'AmenityHoldExpirationWorker',
            expiredCount,
            durationMs,
          });
        }

        return { expiredCount, durationMs };
      } catch (error) {
        const durationMs = Date.now() - startTime;
        logger.error(`[AmenityHoldWorker] Failed during hold expiration sweep in ${durationMs}ms: ${error.message}`, {
          jobId,
          workerName: 'AmenityHoldExpirationWorker',
          error: error.message,
          durationMs,
        });
        return { expiredCount: 0, durationMs, error: error.message };
      } finally {
        this.isExecuting = false;
      }
    });
  }
}

export const amenityHoldExpirationWorker = new AmenityHoldExpirationWorker();
export default amenityHoldExpirationWorker;
