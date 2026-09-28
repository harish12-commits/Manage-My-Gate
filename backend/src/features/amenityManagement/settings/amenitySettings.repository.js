import AmenitySettings from './amenitySettings.model.js';
import { getValidSession } from '../domain/concurrency/transaction.utils.js';

export class AmenitySettingsRepository {
  /**
   * Returns the community's settings, creating the defaults on first read.
   * @param {string|import('mongoose').Types.ObjectId} orgId
   * @param {import('mongoose').ClientSession} [session]
   */
  async getOrCreate(orgId, session) {
    return AmenitySettings.findOneAndUpdate(
      { orgId },
      { $setOnInsert: { orgId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session: getValidSession(session) }
    );
  }

  /**
   * @param {string|import('mongoose').Types.ObjectId} orgId
   * @param {Object} updateData - dotted $set paths
   */
  async update(orgId, updateData) {
    return AmenitySettings.findOneAndUpdate(
      { orgId },
      { $set: updateData, $setOnInsert: { orgId } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    );
  }
}

export const amenitySettingsRepository = new AmenitySettingsRepository();
export default amenitySettingsRepository;
