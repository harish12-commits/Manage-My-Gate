import crypto from 'crypto';
import logger, { loggerStorage } from '../../../utils/logger.utils.js';
import { AMENITY_WORKER_CONFIG } from '../config/amenityWorker.config.js';

/**
 * Drives the time-based reservation lifecycle: expires unreviewed approval requests,
 * flags no-shows / unpaid balances / overdue returns for staff review, and completes
 * bookings that have ended.
 */
export class AmenityReservationLifecycleWorker {
  constructor() {
    this.intervalMs = AMENITY_WORKER_CONFIG.lifecycle.intervalMs;
    this.intervalId = null;
    this.isExecuting = false;
  }

  initWorker(options = {}) {
    if (this.intervalId) {
      logger.warn('[AmenityLifecycleWorker] Worker already running. Skipping duplicate init.');
      return;
    }
    if (options.intervalMs) this.intervalMs = options.intervalMs;
    logger.info(`⚙️ [AmenityLifecycleWorker] Initialized. Polling every ${this.intervalMs}ms`);
    this.intervalId = setInterval(async () => {
      try {
        await this.runOnce();
      } catch (err) {
        logger.error(`[AmenityLifecycleWorker] Polling iteration error: ${err.message}`);
      }
    }, this.intervalMs);
  }

  async runOnce() {
    if (this.isExecuting) return null;
    this.isExecuting = true;
    const jobId = `worker-amenity-lifecycle-${crypto.randomUUID()}`;
    try {
      return await loggerStorage.run(jobId, async () => {
        const { default: lifecycle } = await import('../reservations/amenityReservationLifecycle.service.js');
        const result = await lifecycle.runOnce();
        if (result.expired || result.flagged || result.completed) {
          logger.info('[AmenityLifecycleWorker] Pass complete', result);
        }
        return result;
      });
    } finally {
      this.isExecuting = false;
    }
  }

  stopWorker() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[AmenityLifecycleWorker] Stopped.');
    }
  }
}

export const amenityReservationLifecycleWorker = new AmenityReservationLifecycleWorker();
export default amenityReservationLifecycleWorker;
