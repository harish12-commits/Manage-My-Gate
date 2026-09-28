import notificationService from './notification.service.js';
import config from '../../config/config.js';
import HttpError from '../../utils/httpError.utils.js';

/**
 * Controller class for routing notification feature requests.
 */
export class NotificationController {
  /**
   * Fetch paginated notifications for the logged-in user, scoped by active workspace organization.
   */
  async getUserNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const orgId = req.headers['x-organization-id'] || req.user?.orgId || req.tenant?.orgId || null;
      const { page, limit } = req.query;

      const data = await notificationService.getUserNotifications(userId, page, limit, orgId);
      res.success(data, 'Notifications retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a specific notification as read.
   */
  async markAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const data = await notificationService.markAsRead(id, userId);
      res.success(data, 'Notification marked as read successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all unread notifications of the user as read for the active workspace.
   */
  async markAllAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      const orgId = req.headers['x-organization-id'] || req.user?.orgId || req.tenant?.orgId || null;

      const data = await notificationService.markAllAsRead(userId, orgId);
      res.success(data, 'All notifications marked as read successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Seeds dummy notification data for development/testing purposes.
   * Pushes notifications to the authenticated recipient.
   */
  async seedDummyNotifications(req, res, next) {
    try {
      // Safety guardrail check
      if (config.nodeEnv !== 'development' && process.env.NODE_ENV !== 'development') {
        throw new HttpError(403, 'Seeding is only permitted in development environment.');
      }

      const userId = req.user.id;
      const count = await notificationService.seedDummyData(userId);

      res.success(
        {
          recipientId: userId,
          count,
        },
        'Dummy notifications seeded successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a specific notification.
   */
  async deleteNotification(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const data = await notificationService.deleteNotification(id, userId);
      res.success(data, 'Notification cleared successfully');
    } catch (error) {
      next(error);
    }
  }

  /** Delete all notifications that belong to the current user and workspace. */
  async deleteAllNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const orgId = req.headers['x-organization-id'] || req.user?.orgId || req.tenant?.orgId || null;
      const data = await notificationService.deleteAllNotifications(userId, orgId);
      res.success(data, 'All notifications cleared successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new NotificationController();
