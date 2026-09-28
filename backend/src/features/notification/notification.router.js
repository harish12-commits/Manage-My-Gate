import { Router } from 'express';
import notificationController from './notification.controller.js';
import { validate } from '../../middlewares/validator.middleware.js';
import { getNotificationsRules, markAsReadRules, markAllAsReadRules, deleteNotificationRules } from './notification.validator.js';
import isAuthenticated from '../../middlewares/auth.middleware.js';
import config from '../../config/config.js';

const router = Router();

// Secure all notification routes with JWT authentication
router.use(isAuthenticated);

/**
 * @swagger
 * /notifications/seed-dummy:
 *   post:
 *     summary: Seed dummy notification data for the logged-in user (Development environment only)
 *     responses:
 *       201:
 *         description: Dummy notifications seeded successfully.
 *       403:
 *         description: Development environment only route.
 */
// Development-only route to seed dummy notification data
if (config.nodeEnv === 'development') {
  router.post('/seed-dummy', notificationController.seedDummyNotifications);
}

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Retrieve paginated notifications history for the logged-in user
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of notifications to return
 *     responses:
 *       200:
 *         description: Paginated notifications array and metadata.
 */
router.get('/', validate(getNotificationsRules), notificationController.getUserNotifications);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all unread notifications of the logged-in user as read
 *     responses:
 *       200:
 *         description: Success update metadata.
 */
router.patch('/read-all', validate(markAllAsReadRules), notificationController.markAllAsRead);

// Keep this route above /:id so "all" is never interpreted as a notification id.
router.delete('/all', notificationController.deleteAllNotifications);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a specific notification as read
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Updated notification document.
 */
router.patch('/:id/read', validate(markAsReadRules), notificationController.markAsRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a specific notification
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification deleted successfully.
 *       400:
 *         description: Invalid notification ID format.
 *       403:
 *         description: Access denied. You do not own this notification.
 *       404:
 *         description: Notification not found.
 */
router.delete('/:id', validate(deleteNotificationRules), notificationController.deleteNotification);

export default router;
