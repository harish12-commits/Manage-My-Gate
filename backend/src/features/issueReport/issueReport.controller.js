import fs from 'fs';
import issueReportService from './issueReport.service.js';

export class IssueReportController {
  /**
   * Handle user report submission (POST /api/v1/support/reports)
   */
  async submitReport(req, res, next) {
    try {
      const clientRequestId =
        req.headers['x-request-id'] ||
        req.headers['x-idempotency-key'] ||
        req.body?.clientRequestId ||
        null;

      const result = await issueReportService.submitReport(
        req.user,
        req.tenant,
        req.body,
        req.file || null,
        clientRequestId
      );

      res.success(result, 'Report submitted successfully', 201);
    } catch (error) {
      // Ensure file cleanup if error happened in controller boundary
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, () => {});
      }
      next(error);
    }
  }

  /**
   * Handle Platform Admin report listing (GET /api/v1/platform/reports)
   */
  async getPlatformReports(req, res, next) {
    try {
      const result = await issueReportService.getPlatformReports(req.query);
      res.success(result, 'Reports retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Platform Admin single report retrieval (GET /api/v1/platform/reports/:id)
   */
  async getReportById(req, res, next) {
    try {
      const report = await issueReportService.getReportById(req.params.id);
      res.success(report, 'Report retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Community Admin report listing (GET /api/v1/support/reports/community)
   */
  async getCommunityReports(req, res, next) {
    try {
      const orgId = req.tenant?.orgId;
      const result = await issueReportService.getCommunityReports(orgId, req.query);
      res.success(result, 'Community reports retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Community Admin single report retrieval (GET /api/v1/support/reports/community/:id)
   */
  async getCommunityReportById(req, res, next) {
    try {
      const orgId = req.tenant?.orgId;
      const report = await issueReportService.getCommunityReportById(req.params.id, orgId);
      res.success(report, 'Community report retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Stream an attachment to an authorized viewer (GET /api/v1/support/reports/attachments/:filename)
   */
  async getAttachment(req, res, next) {
    try {
      const { filePath, mimeType } = await issueReportService.getAttachmentFile(req.params.filename, req.tenant);
      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.sendFile(filePath, (err) => {
        if (err && !res.headersSent) next(err);
      });
    } catch (error) {
      next(error);
    }
  }
}

export const issueReportController = new IssueReportController();
export default issueReportController;
