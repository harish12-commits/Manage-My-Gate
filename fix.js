const fs = require('fs');
let content = fs.readFileSync('backend/src/features/issueReport/issueReport.listeners.js', 'utf8');

// 1. In 
otifyCommunityAdmins, add reportObj and mailAttachments to signature.
content = content.replace(
  /export async function notifyCommunityAdmins\(orgId, title, body, actionUrl\) \{/g,
  'export async function notifyCommunityAdmins(orgId, title, body, actionUrl, reportObj = null, mailAttachments = []) {'
);

// 2. Add email to the notifyCommunityAdmins loop
const notifCommAdmin = \
        await notificationService.createNotification({
          recipientId: userId,
          orgId,
          title,
          body,
          actionUrl,
          type: 'INFO',
        });
      } catch (err) {
\;
const notifCommAdminReplace = \
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
          }
        }
      } catch (err) {
\;
content = content.replace(notifCommAdmin, notifCommAdminReplace);

// 3. In 
otifyPlatformAdmins, add reportObj and mailAttachments to signature.
content = content.replace(
  /export async function notifyPlatformAdmins\\(title, body, actionUrl\\) \\{/g,
  'export async function notifyPlatformAdmins(title, body, actionUrl, reportObj = null, mailAttachments = []) {'
);

// 4. Add email to the notifyPlatformAdmins loop
const notifPlatAdmin = \
        await notificationService.createNotification({
          recipientId: userId,
          title,
          body,
          actionUrl,
          type: 'INFO',
        });
      } catch (err) {
\;
const notifPlatAdminReplace = \
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
          }
        }
      } catch (err) {
\;
content = content.replace(notifPlatAdmin, notifPlatAdminReplace);

// 5. In REPORT_SUBMITTED event handler, move report and attachments fetch UP, and pass them to notify helpers
const eventHandlerRegex = /    \/\/ 1\. Existing Community Admin Notification Flow[\\s\\S]*?await notifyCommunityAdmins\\(organisationId, notifTitle, notifBody, communityActionUrl\\);[\\s\\S]*?\/\/ 2\. Existing Platform Admin Notification Flow[\\s\\S]*?await notifyPlatformAdmins\\(notifTitle, notifBody, platformActionUrl\\);[\\s\\S]*?\/\/ 3\. New Requirement: Configured Platform Admin Email Notification Flow[\\s\\S]*?try \\{[\\s\\S]*?const configuredEmail = await issueReportConfigService\.getPlatformReportEmail\\(\\);[\\s\\S]*?if \\(configuredEmail\\) \\{[\\s\\S]*?logger\.info\\(\\\[IssueReportListener\\] Triggering issue report email to configured Platform Admin email: \\\\\\);[\\s\\S]*?const report = await issueReportRepository\.findById\\(reportId\\);[\\s\\S]*?if \\(report\\) \\{[\\s\\S]*?\/\/ Prepare image attachments if present[\\s\\S]*?const mailAttachments = \\[\\];[\\s\\S]*?if \\(Array\.isArray\\(report\.attachments\\) && report\.attachments\.length > 0\\) \\{[\\s\\S]*?for \\(const att of report\.attachments\\) \\{[\\s\\S]*?if \\(!att\.url\\) continue;[\\s\\S]*?\/\/ Stored URLs look like \/uploads\/issueReports\/<file>; only the basename is trusted and it[\\s\\S]*?\/\/ is always resolved inside the upload directory \\(no path traversal\\)\.[\\s\\S]*?const localPath = path\.join\\(UPLOAD_ROOT, path\.basename\\(att\.url\\)\\);[\\s\\S]*?if \\(fs\.existsSync\\(localPath\\)\\) \\{[\\s\\S]*?mailAttachments\.push\\(\\{[\\s\\S]*?filename: path\.basename\\(localPath\\),[\\s\\S]*?path: localPath,[\\s\\S]*?contentType: att\.mimeType \\|\\| 'image\/jpeg',[\\s\\S]*?\\}\\);[\\s\\S]*?\\} else \\{[\\s\\S]*?logger\.warn\\(\\\[IssueReportListener\\] Image file attachment path not found on disk: \\\\\\);[\\s\\S]*?\\}[\\s\\S]*?\\}[\\s\\S]*?\\}[\\s\\S]*?const emailSent = await emailService\.sendReportedIssueEmail\\(\\{[\\s\\S]*?to: configuredEmail,[\\s\\S]*?report,[\\s\\S]*?attachments: mailAttachments,[\\s\\S]*?\\}\\);/;

const newEventHandlerBody = \
    const report = await issueReportRepository.findById(reportId);
    const mailAttachments = [];
    if (report && Array.isArray(report.attachments) && report.attachments.length > 0) {
      for (const att of report.attachments) {
        if (!att.url) continue;
        const localPath = path.join(UPLOAD_ROOT, path.basename(att.url));
        if (fs.existsSync(localPath)) {
          mailAttachments.push({
            filename: path.basename(localPath),
            path: localPath,
            contentType: att.mimeType || 'image/jpeg',
          });
        } else {
          logger.warn(\[IssueReportListener] Image file attachment path not found on disk: \\);
        }
      }
    }

    // 1. Community Admin Notification Flow (In-App + Email)
    await notifyCommunityAdmins(organisationId, notifTitle, notifBody, communityActionUrl, report, mailAttachments);

    // 2. Platform Admin Notification Flow (In-App + Email)
    await notifyPlatformAdmins(notifTitle, notifBody, platformActionUrl, report, mailAttachments);

    // 3. New Requirement: Configured Platform Admin Email Notification Flow
    try {
      const configuredEmail = await issueReportConfigService.getPlatformReportEmail();
      if (configuredEmail && report) {
        logger.info(\[IssueReportListener] Triggering issue report email to configured Platform Admin email: \\);
        
        const emailSent = await emailService.sendReportedIssueEmail({
          to: configuredEmail,
          report,
          attachments: mailAttachments,
        });
\;

content = content.replace(eventHandlerRegex, newEventHandlerBody);
fs.writeFileSync('backend/src/features/issueReport/issueReport.listeners.js', content, 'utf8');
