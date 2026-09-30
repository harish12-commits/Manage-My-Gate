import path from 'path';
import fs from 'fs';
import issueReportEventEmitter, { ISSUE_REPORT_EVENTS } from './issueReport.events.js';
import issueReportRepository from './issueReport.repository.js';
import issueReportConfigService from '../issueReportConfig/issueReportConfig.service.js';
import emailService from '../../utils/email.service.js';
import notificationService from '../notification/notification.service.js';
import Role from '../role/role.model.js';
import User from '../user/user.model.js';
import OrgMembership from '../orgMembership/orgMembership.model.js';
import logger from '../../utils/logger.utils.js';

/**
 * Helper to notify Community Admins within a target organization via in-app notification.
 *
 * @param {string} orgId - Organization ID
 * @param {string} title - Notification title
 * @param {string} body - Notification text body
 * @param {string} actionUrl - Deep link destination URI
 * @param {Object} reportObj - Issue report object for email template
 * @param {Array} mailAttachments - Mail attachments for email
 */
export async function notifyCommunityAdmins(orgId, title, body, actionUrl, reportObj = null, mailAttachments = []) {
  try {
    if (!orgId) return;
    const adminRoleNames = ['Admin', 'Community Admin', 'Facility Manager', 'FacilityManager'];

    // 1. Resolve role ObjectIds for the organization matching admin role names
    const roles = await Role.find({ orgId, name: { $in: adminRoleNames } }).lean();

    let memberUserIds = [];
    if (roles && roles.length > 0) {
      const roleIds = roles.map((r) => r._id);
      const memberships = await OrgMembership.find({
        orgId,
        status: 'Active',
        $or: [
          { roleId: { $in: roleIds } },
          { roleIds: { $in: roleIds } },
        ],
      }).lean();
      memberUserIds = memberships.map((m) => m.userId).filter(Boolean);
    }

    // 2. Fallback: Find memberships where populated role names match admin definitions
    if (memberUserIds.length === 0) {
      const allMemberships = await OrgMembership.find({ orgId, status: 'Active' })
        .populate('roleId')
        .populate('roleIds')
        .lean();

      for (const m of allMemberships) {
        const roleNames = [
          m.roleId?.name,
          ...(Array.isArray(m.roleIds) ? m.roleIds.map((r) => r?.name) : []),
        ].filter(Boolean);

        if (roleNames.some((rn) => adminRoleNames.some((ar) => ar.toLowerCase() === rn.toLowerCase()))) {
          if (m.userId) memberUserIds.push(m.userId);
        }
      }
    }

    const uniqueUserIds = [...new Set(memberUserIds.map((id) => id.toString()))];

    logger.info(`[IssueReportListener] Found ${uniqueUserIds.length} Community Admin(s) in org ${orgId} to notify.`);

    // 3. Create persistent in-app notifications with deduplication check
    const Notification = (await import('../notification/notification.model.js')).default;
    for (const userId of uniqueUserIds) {
      try {
        const existingNotif = await Notification.findOne({
          recipientId: userId,
          actionUrl,
        }).lean();

        if (existingNotif) {
          logger.info(`[IssueReportListener] Duplicate notification suppressed for recipient ${userId} with actionUrl ${actionUrl}`);
          continue;
        }

        await notificationService.createNotification({
          recipientId: userId,
          orgId,
          title,
          body,
          actionUrl,
          type: 'INFO',
        });

        if (reportObj) {
          const User = (await import('../user/user.model.js')).default;
          const { default: emailService } = await import('../../utils/email.service.js');
          const user = await User.findById(userId).select('email').lean();
          if (user && user.email) {
            await emailService.sendReportedIssueEmail({
              to: user.email,
              report: reportObj,
              attachments: mailAttachments,
            });
            logger.info(`[IssueReportListener] Email sent to Community Admin ${user.email}`);
          }
        }
      } catch (err) {
        logger.error(`[IssueReportListener] Failed to create notification for user ${userId}:`, err.message);
      }
    }
  } catch (error) {
    logger.error(`[IssueReportListener] Error notifying Community Admins for org ${orgId}:`, error);
  }
}

/**
 * Helper to notify Platform Super Admins via in-app notification.
 *
 * @param {string} title - Notification title
 * @param {string} body - Notification text body
 * @param {string} actionUrl - Deep link destination URI
 * @param {Object} reportObj - Issue report object for email template
 * @param {Array} mailAttachments - Mail attachments for email
 */
export async function notifyPlatformAdmins(title, body, actionUrl, reportObj = null, mailAttachments = []) {
  try {
    const platformUsers = await User.find({
      status: 'Active',
      $or: [
        { isPlatform: true },
        { isPlatformUser: true },
        { role: { $in: ['Platform Super Admin', 'Platform Admin', 'Super Admin'] } },
      ],
    }).lean();

    const uniqueUserIds = [...new Set(platformUsers.map((u) => u._id.toString()))];
    logger.info(`[IssueReportListener] Found ${uniqueUserIds.length} Platform Admin(s) for in-app notification.`);

    const Notification = (await import('../notification/notification.model.js')).default;
    for (const userId of uniqueUserIds) {
      try {
        const existingNotif = await Notification.findOne({
          recipientId: userId,
          actionUrl,
        }).lean();

        if (existingNotif) {
          continue;
        }

        await notificationService.createNotification({
          recipientId: userId,
          title,
          body,
          actionUrl,
          type: 'INFO',
        });

        if (reportObj) {
          const User = (await import('../user/user.model.js')).default;
          const { default: emailService } = await import('../../utils/email.service.js');
          const issueReportConfigService = (await import('../issueReportConfig/issueReportConfig.service.js')).default;
          let configuredEmail = null;
          try {
            configuredEmail = await issueReportConfigService.getPlatformReportEmail();
          } catch(e) {}

          const user = await User.findById(userId).select('email').lean();
          if (user && user.email && user.email !== configuredEmail) {
            await emailService.sendReportedIssueEmail({
              to: user.email,
              report: reportObj,
              attachments: mailAttachments,
            });
            logger.info(`[IssueReportListener] Email sent to Platform Admin user ${user.email}`);
          }
        }
      } catch (err) {
        logger.error(`[IssueReportListener] Failed to create in-app notification for Platform Admin ${userId}:`, err.message);
      }
    }
  } catch (error) {
    logger.error('[IssueReportListener] Error notifying Platform Admins in-app:', error);
  }
}

/**
 * Register Event Subscriber for REPORT_SUBMITTED lifecycle event.
 */
issueReportEventEmitter.on(ISSUE_REPORT_EVENTS.REPORT_SUBMITTED, async (payload) => {
  try {
    const { reportId, reportNumber, organisationId, title } = payload || {};
    if (!organisationId || !reportId) {
      logger.warn('[IssueReportListener] Received REPORT_SUBMITTED event missing required attributes:', payload);
      return;
    }

    logger.info(`[IssueReportListener] Processing REPORT_SUBMITTED event for report ${reportNumber || reportId} in org ${organisationId}`);

    const notifTitle = 'New Resident Issue Report';
    const notifBody = title
      ? `A resident has reported an issue: "${title}"`
      : `A new issue report (${reportNumber || 'Report'}) has been submitted.`;
    const communityActionUrl = `/admin/complaints/issue-reports?reportId=${reportId}`;
    const platformActionUrl = `/platform/reports/${reportId}`;

    // PREPARE REPORT OBJECT AND ATTACHMENTS FOR EMAIL
    const report = await issueReportRepository.findById(reportId);
    const mailAttachments = [];
    if (report && Array.isArray(report.attachments) && report.attachments.length > 0) {
      const projectRoot = process.cwd();
      for (const att of report.attachments) {
        if (!att.url) continue;
        let localPath = att.url;
        if (localPath.startsWith('/')) {
          localPath = path.join(projectRoot, localPath);
        }
        if (fs.existsSync(localPath)) {
          mailAttachments.push({
            filename: att.fileName || path.basename(localPath),
            path: localPath,
            contentType: att.mimeType || 'image/jpeg',
          });
        } else {
          logger.warn(`[IssueReportListener] Image file attachment path not found on disk: ${localPath}`);
        }
      }
    }

    // 1. Existing Community Admin Notification Flow
    await notifyCommunityAdmins(organisationId, notifTitle, notifBody, communityActionUrl, report, mailAttachments);

    // 2. Existing Platform Admin Notification Flow
    await notifyPlatformAdmins(notifTitle, notifBody, platformActionUrl, report, mailAttachments);

    // 3. New Requirement: Configured Platform Admin Email Notification Flow
    try {
      const configuredEmail = await issueReportConfigService.getPlatformReportEmail();
      if (configuredEmail) {
        logger.info(`[IssueReportListener] Triggering issue report email to configured Platform Admin email: ${configuredEmail}`);
        
        if (report) {
          const emailSent = await emailService.sendReportedIssueEmail({
            to: configuredEmail,
            report,
            attachments: mailAttachments,
          });

          if (emailSent) {
            logger.info(`[IssueReportListener] Configured Platform Admin email successfully sent to ${configuredEmail}`);
          } else {
            logger.error(`[IssueReportListener] Email service returned failure status for recipient ${configuredEmail}`);
          }
        } else {
          logger.warn(`[IssueReportListener] Could not locate report document for ID ${reportId} when sending email.`);
        }
      } else {
        logger.info('[IssueReportListener] No Platform Admin email configured; skipping email dispatch.');
      }
    } catch (emailErr) {
      // Non-blocking error handling: Log failure appropriately so issue remains successfully reported
      logger.error('[IssueReportListener] Non-fatal error while attempting to send Platform Admin email notification:', emailErr);
    }
  } catch (err) {
    logger.error('[IssueReportListener] Error handling REPORT_SUBMITTED event:', err);
  }
});
