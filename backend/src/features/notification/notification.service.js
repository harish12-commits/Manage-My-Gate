import mongoose from 'mongoose';
import notificationRepository from './notification.repository.js';
import notificationEvents from './notification.events.js';
import HttpError from '../../utils/httpError.utils.js';

/**
 * Service class orchestrating business logic for the Notification feature.
 */
export class NotificationService {
  /**
   * Create a new notification record.
   * @param {object} notificationData - Data payload for creating notification
   * @returns {Promise<object>} The created notification document
   */
  async createNotification(notificationData) {
    const session = await mongoose.startSession();
    let transactionStarted = false;
    try {
      session.startTransaction();
      transactionStarted = true;
      const newNotification = await notificationRepository.create(notificationData, session);
      await session.commitTransaction();

      // Emit event after transaction commit to notify real-time listeners
      notificationEvents.emit('notification_created', newNotification);

      return newNotification;
    } catch (error) {
      if (transactionStarted) {
        try {
          await session.abortTransaction();
        } catch {
          // Preserve the original notification error below.
        }
      }

      // Some local/managed standalone MongoDB deployments reject writes made
      // through a transaction session with "retryable writes" errors. An
      // amenity notification must not be lost because that deployment cannot
      // offer multi-document transactions; a single notification insert is
      // atomic on its own and is safe to retry without the session.
      const canUseSingleWriteFallback =
        /retryable writes|Transaction numbers are only allowed|does not support transactions/i.test(
          error?.message || ''
        );
      if (canUseSingleWriteFallback) {
        const newNotification = await notificationRepository.create(notificationData);
        notificationEvents.emit('notification_created', newNotification);
        return newNotification;
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get paginated notifications list and count metadata for a specific user, scoped by organization.
   * @param {string} userId - Recipient's user ID
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @param {string} [orgId=null] - Optional organization ID for multi-tenant isolation
   * @returns {Promise<object>} Paginated notifications response object
   */
  async getUserNotifications(userId, page = 1, limit = 10, orgId = null) {
    const cleanPage = Math.max(1, parseInt(page, 10) || 1);
    const cleanLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (cleanPage - 1) * cleanLimit;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { notifications, totalCount, unreadCount } = 
        await notificationRepository.findNotificationsWithMetadata(userId, skip, cleanLimit, session, orgId);

      await session.commitTransaction();

      const totalPages = Math.ceil(totalCount / cleanLimit);

      return {
        notifications,
        pagination: {
          totalRecords: totalCount,
          unreadRecords: unreadCount,
          currentPage: cleanPage,
          totalPages: totalPages || 1,
          limit: cleanLimit,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Mark a specific user notification as read.
   * @param {string} id - Notification ID
   * @param {string} userId - Requesting user's ID
   * @returns {Promise<object>} The updated notification
   */
  async markAsRead(id, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const notification = await notificationRepository.findById(id, session);
      if (!notification) {
        throw new HttpError(404, `Notification with ID ${id} not found.`);
      }

      // Enforce recipient ownership check
      if (notification.recipientId.toString() !== userId) {
        throw new HttpError(403, 'Access denied. You do not own this notification.');
      }

      if (notification.isRead) {
        // Already read, skip database write
        await session.commitTransaction();
        return notification;
      }

      const updated = await notificationRepository.update(
        id,
        { isRead: true, readAt: new Date() },
        session
      );

      await session.commitTransaction();
      return updated;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Mark all unread notifications for a user as read, scoped by orgId.
   * @param {string} userId - Recipient user's ID
   * @param {string} [orgId=null] - Optional organization ID for multi-tenant isolation
   * @returns {Promise<object>} Update result summary
   */
  async markAllAsRead(userId, orgId = null) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await notificationRepository.markAllAsRead(userId, new Date(), session, orgId);
      await session.commitTransaction();
      return {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Seeds dummy notification data for development/testing purposes.
   * Generates 28 notifications with staggered variables.
   * @param {string} recipientId - Recipient user's ID
   * @returns {Promise<number>} Count of successfully seeded notifications
   */
  async seedDummyData(recipientId) {
    const dummySenderId = new mongoose.Types.ObjectId();
    const types = ['INFO', 'WARNING', 'SUCCESS', 'ERROR'];
    const dummyNotifications = [];

    for (let i = 1; i <= 28; i++) {
      const type = types[i % types.length];
      const isRead = i % 3 === 0;
      const hasActionUrl = i % 2 === 0;
      const isSystem = i % 5 === 0;

      dummyNotifications.push({
        recipientId: new mongoose.Types.ObjectId(recipientId),
        senderId: isSystem ? null : dummySenderId,
        title: `Dev Seed - Notification #${i}`,
        body: `This is test notification #${i} with type ${type}. Used to verify pagination scrolling and live sockets.`,
        actionUrl: hasActionUrl ? `/dashboard` : null,
        type,
        isRead,
        readAt: isRead ? new Date() : null,
      });
    }

    let seededCount = 0;
    for (const payload of dummyNotifications) {
      await this.createNotification(payload);
      seededCount++;
    }

    return seededCount;
  }

  /**
   * Delete a specific user notification.
   * @param {string} id - Notification ID
   * @param {string} userId - Requesting user's ID
   * @returns {Promise<object>} The deleted notification document
   */
  async deleteNotification(id, userId) {
    const session = await mongoose.startSession();
    let transactionStarted = false;
    try {
      session.startTransaction();
      transactionStarted = true;
      const notification = await notificationRepository.findById(id, session);
      if (!notification) {
        throw new HttpError(404, `Notification with ID ${id} not found.`);
      }

      // Enforce recipient ownership check
      if (notification.recipientId.toString() !== userId) {
        throw new HttpError(403, 'Access denied. You do not own this notification.');
      }

      const deleted = await notificationRepository.delete(id, session);
      await session.commitTransaction();

      // Emit event after transaction commit to notify real-time listeners
      notificationEvents.emit('notification_deleted', deleted);

      return deleted;
    } catch (error) {
      if (transactionStarted) {
        try {
          await session.abortTransaction();
        } catch {
          // ignore
        }
      }

      const canUseSingleWriteFallback =
        /retryable writes|Transaction numbers are only allowed|does not support transactions/i.test(
          error?.message || ''
        );
      if (canUseSingleWriteFallback) {
        const notification = await notificationRepository.findById(id);
        if (!notification) {
          throw new HttpError(404, `Notification with ID ${id} not found.`);
        }
        if (notification.recipientId.toString() !== userId) {
          throw new HttpError(403, 'Access denied. You do not own this notification.');
        }
        const deleted = await notificationRepository.delete(id);
        notificationEvents.emit('notification_deleted', deleted);
        return deleted;
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }
}

export default new NotificationService();
