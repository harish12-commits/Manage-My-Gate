import HttpError from '../../../utils/httpError.utils.js';
import logger from '../../../utils/logger.utils.js';
import auditLogService from '../../auditLog/auditLog.services.js';
import amenitySettingsRepository from './amenitySettings.repository.js';

const LONG_DURATION_ARCHETYPES = ['ROOM_RESOURCE', 'INVENTORY_TOOLS', 'EVENT_SPACE'];

const EDITABLE_PATHS = [
  'quota.enabled',
  'quota.limitMinutes',
  'quota.longDurationLimitMinutes',
  'approvalTimeoutHours',
  'checkInEarlyMinutes',
  'noShowGraceMinutes',
];

const readPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

export class AmenitySettingsService {
  /**
   * @param {string|import('mongoose').Types.ObjectId} orgId
   * @param {import('mongoose').ClientSession} [session]
   */
  async getSettings(orgId, session) {
    if (!orgId) throw new HttpError(400, 'Organization ID is required');
    return amenitySettingsRepository.getOrCreate(orgId, session);
  }

  /**
   * Applies a partial update (only known fields) and audit-logs every change.
   */
  async updateSettings(orgId, body, user) {
    if (!orgId) throw new HttpError(400, 'Organization ID is required');
    const before = await amenitySettingsRepository.getOrCreate(orgId);

    const update = {};
    for (const path of EDITABLE_PATHS) {
      const value = readPath(body, path);
      if (value !== undefined) update[path] = value;
    }
    if (Object.keys(update).length === 0) return before;
    update.updatedBy = user?.id || user?._id || null;

    const after = await amenitySettingsRepository.update(orgId, update);

    const changes = EDITABLE_PATHS.filter((p) => update[p] !== undefined && readPath(before, p) !== readPath(after, p)).map(
      (p) => ({ field: p, previousValue: readPath(before, p), newValue: readPath(after, p) })
    );
    if (changes.length) {
      try {
        await auditLogService.logEvent({
          actorId: user?.id || user?._id,
          action: 'Amenity Settings Updated',
          targetId: orgId,
          metadata: { changes, tenant: orgId },
        });
      } catch (err) {
        logger.warn('[AmenitySettings] audit log failed', { error: err.message });
      }
    }
    return after;
  }

  /** Monthly household quota (minutes) that applies to bookings on `facility`. */
  quotaLimitFor(settings, facility, requestedUnits = 0) {
    if (settings?.quota?.enabled === false) return Number.MAX_SAFE_INTEGER;
    const limit = LONG_DURATION_ARCHETYPES.includes(facility.archetype)
      ? settings?.quota?.longDurationLimitMinutes ?? 43200
      : settings?.quota?.limitMinutes ?? 2400;
    // A single booking longer than the allowance (e.g. a week-long loan) is still possible once.
    return Math.max(Number(limit), Number(requestedUnits) || 0);
  }
}

export const amenitySettingsService = new AmenitySettingsService();
export default amenitySettingsService;
