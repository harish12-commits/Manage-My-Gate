import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import issueReportRepository from './issueReport.repository.js';
import organizationService from '../organization/organization.services.js';
import issueReportEventEmitter, { ISSUE_REPORT_EVENTS } from './issueReport.events.js';
import HttpError from '../../utils/httpError.utils.js';
import logger from '../../utils/logger.utils.js';
import { REPORT_SOURCES, SORTABLE_FIELDS } from './issueReport.constants.js';
import { UPLOAD_ROOT, ATTACHMENT_FILENAME_PATTERN } from './middlewares/upload.middleware.js';

const buildSort = (sortBy, sortOrder) => ({
  [SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'createdAt']: sortOrder === 'asc' ? 1 : -1,
});

export class IssueReportService {
  /**
   * Submit a new Issue Report from an authenticated user.
   * Derives reporter and organization context exclusively from verified backend state.
   *
   * @param {Object} authenticatedUser - req.user
   * @param {Object} tenantContext - req.tenant
   * @param {Object} reportPayload - req.body
   * @param {Object|null} [file=null] - Multer uploaded file
   * @param {string|null} [clientRequestId=null] - Unique request correlation ID for idempotency
   * @returns {Promise<{ reportNumber: string, createdAt: Date }>}
   */
  async submitReport(authenticatedUser, tenantContext, reportPayload, file = null, clientRequestId = null) {
    if (!authenticatedUser) {
      throw new HttpError(401, 'Authentication required to submit an issue report.');
    }

    const userId = authenticatedUser.id || authenticatedUser._id;

    // 1. Idempotency Check: Prevent double-submits with identical key (scoped to this reporter)
    if (clientRequestId) {
      const existing = await issueReportRepository.findByClientRequestId(userId, clientRequestId);
      if (existing) {
        logger.info(`[IssueReport] Duplicate submission detected for clientRequestId: ${clientRequestId}, returning existing report: ${existing.reportNumber}`);
        // Clean up redundant file uploaded on duplicate request
        if (file && file.path && fs.existsSync(file.path)) {
          fs.unlink(file.path, () => {});
        }
        return {
          reportNumber: existing.reportNumber,
          createdAt: existing.createdAt,
        };
      }
    }

    // 2. Strict Context Extraction (Never trusted from client request body)
    const userEmail = authenticatedUser.email || '';
    const userPhone = authenticatedUser.phone || authenticatedUser.mobile || '';
    const userName = authenticatedUser.name || authenticatedUser.firstName || authenticatedUser.username || (authenticatedUser.email ? authenticatedUser.email.split('@')[0] : (userPhone || 'User'));
    const userRole = tenantContext?.role || authenticatedUser.role || 'Resident';

    const rawOrgId = tenantContext?.orgId || authenticatedUser.orgId;
    if (!rawOrgId) {
      // Clean up uploaded file if organization context is missing
      if (file && file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
      throw new HttpError(400, 'Workspace / Organization context is required to submit a report.');
    }

    const orgIdStr = typeof rawOrgId === 'object' && rawOrgId !== null ? (rawOrgId._id || rawOrgId.id || String(rawOrgId)) : String(rawOrgId);

    // Resolve human-readable Organization Name via Organization Service
    let orgName = authenticatedUser.organizationName || tenantContext?.organizationName || 'Community';
    try {
      if (mongoose.Types.ObjectId.isValid(orgIdStr)) {
        const orgDoc = await organizationService.getOrganizationById(orgIdStr);
        if (orgDoc?.name) {
          orgName = orgDoc.name;
        }
      }
    } catch (orgErr) {
      logger.warn(`[IssueReport] Failed to resolve organization name for ${orgIdStr}: ${orgErr.message}`);
    }

    // 3. Technical Context Sanitization
    let technicalContext = {};
    if (reportPayload.technicalContext) {
      if (typeof reportPayload.technicalContext === 'string') {
        try {
          technicalContext = JSON.parse(reportPayload.technicalContext);
        } catch {
          technicalContext = {};
        }
      } else if (typeof reportPayload.technicalContext === 'object') {
        technicalContext = reportPayload.technicalContext;
      }
    }

    const cleanTechnicalContext = {
      appVersion: String(technicalContext.appVersion || '').slice(0, 50),
      platform: String(technicalContext.platform || '').slice(0, 30).toLowerCase(),
      deviceModel: String(technicalContext.deviceModel || '').slice(0, 100),
      osVersion: String(technicalContext.osVersion || '').slice(0, 50),
    };

    // 4. Attachments Construction
    const attachments = [];
    if (file) {
      attachments.push({
        url: `/uploads/issueReports/${file.filename}`,
        fileName: file.originalname || file.filename,
        mimeType: file.mimetype,
        size: file.size,
      });
    }

    // 5. Atomic Report Number Generation & Persistence
    try {
      const reportNumber = await issueReportRepository.getNextReportNumber();

      const newReportData = {
        reportNumber,
        reporter: {
          userId,
          name: userName,
          email: userEmail,
          phone: userPhone,
          role: userRole,
        },
        organisation: {
          organisationId: orgIdStr,
          name: orgName,
        },
        reportType: reportPayload.reportType,
        feature: reportPayload.feature,
        title: String(reportPayload.title || '').trim(),
        description: String(reportPayload.description || '').trim(),
        attachments,
        technicalContext: cleanTechnicalContext,
        source: REPORT_SOURCES.includes(reportPayload.source) ? reportPayload.source : 'MOBILE_APP',
        clientRequestId: clientRequestId || undefined,
      };

      const savedReport = await issueReportRepository.create(newReportData);

      logger.info(`[IssueReport] Report successfully created: ${savedReport.reportNumber} by user ${userId} in org ${orgIdStr}`);

      // Broadcast internal application event to decouple execution
      try {
        issueReportEventEmitter.emit(ISSUE_REPORT_EVENTS.REPORT_SUBMITTED, {
          reportId: savedReport._id,
          reportNumber: savedReport.reportNumber,
          organisationId: savedReport.organisation?.organisationId || orgIdStr,
          reporterId: savedReport.reporter?.userId || userId,
          title: savedReport.title,
        });
      } catch (emitErr) {
        logger.warn(`[IssueReport] Event emit warning: ${emitErr.message}`);
      }

      return {
        reportNumber: savedReport.reportNumber,
        createdAt: savedReport.createdAt,
      };
    } catch (saveError) {
      // Concurrent duplicate submit (unique reporter + key index): return the report that won the race.
      if (saveError?.code === 11000 && clientRequestId) {
        const existing = await issueReportRepository.findByClientRequestId(userId, clientRequestId);
        if (existing) {
          if (file && file.path && fs.existsSync(file.path)) fs.unlink(file.path, () => {});
          return { reportNumber: existing.reportNumber, createdAt: existing.createdAt };
        }
      }
      // 6. File Cleanup on Database Failure
      if (file && file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) logger.error(`[IssueReport] Error cleaning up file after failure: ${unlinkErr.message}`);
        });
      }
      logger.error(`[IssueReport] Failed to create report: ${saveError.message}`, { stack: saveError.stack });
      throw saveError;
    }
  }

  /**
   * Platform Admin listing of reports with pagination, filtering, and search.
   *
   * @param {Object} queryParams
   * @returns {Promise<{ reports: Array, total: number, page: number, limit: number, totalPages: number }>}
   */
  async getPlatformReports(queryParams = {}) {
    const {
      search,
      reportType,
      feature,
      organisationId,
      platform,
      startDate,
      endDate,
      page,
      limit,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryParams;

    const sort = buildSort(sortBy, sortOrder);

    return await issueReportRepository.findPlatformReports({
      search,
      reportType,
      feature,
      organisationId,
      platform,
      startDate,
      endDate,
      page,
      limit,
      sort,
    });
  }

  /**
   * Platform Admin retrieval of a single report by MongoDB ObjectId.
   *
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getReportById(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid report ID format.');
    }

    const report = await issueReportRepository.findById(id);
    if (!report) {
      throw new HttpError(404, 'Issue report not found.');
    }

    return report;
  }

  /**
   * Community Admin listing of reports strictly scoped to their organization.
   *
   * @param {string} orgId - Authenticated tenant organization ID
   * @param {Object} queryParams
   * @returns {Promise<{ reports: Array, total: number, page: number, limit: number, totalPages: number }>}
   */
  async getCommunityReports(orgId, queryParams = {}) {
    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
      throw new HttpError(400, 'Valid workspace organization context is required.');
    }

    const {
      search,
      reportType,
      feature,
      platform,
      startDate,
      endDate,
      page,
      limit,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryParams;

    const sort = buildSort(sortBy, sortOrder);

    // Always overwrite organisationId with the authenticated tenant orgId boundary
    return await issueReportRepository.findPlatformReports({
      search,
      reportType,
      feature,
      organisationId: orgId,
      platform,
      startDate,
      endDate,
      page,
      limit,
      sort,
    });
  }

  /**
   * Community Admin retrieval of a single report strictly scoped to their organization.
   *
   * @param {string} id - Report ObjectId
   * @param {string} orgId - Authenticated tenant organization ID
   * @returns {Promise<Object>}
   */
  async getCommunityReportById(id, orgId) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid report ID format.');
    }
    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
      throw new HttpError(400, 'Valid workspace organization context is required.');
    }

    const report = await issueReportRepository.findCommunityReportById(id, orgId);
    if (!report) {
      throw new HttpError(404, 'Issue report not found.');
    }

    return report;
  }

  /**
   * Resolve an attachment file for an authorized viewer.
   * Platform users may read any report's attachment; everyone else only their own organization's.
   *
   * @param {string} filename - Stored attachment file name
   * @param {{ orgId?: string, isPlatform?: boolean }} tenant - req.tenant
   * @returns {Promise<{ filePath: string, mimeType: string }>}
   */
  async getAttachmentFile(filename, tenant = {}) {
    if (!filename || !ATTACHMENT_FILENAME_PATTERN.test(filename)) {
      throw new HttpError(400, 'Invalid attachment file name.');
    }

    const orgScope = tenant.isPlatform === true ? null : tenant.orgId;
    if (!orgScope && tenant.isPlatform !== true) {
      throw new HttpError(400, 'Valid workspace organization context is required.');
    }

    const match = await issueReportRepository.findAttachment(filename, orgScope);
    if (!match) {
      throw new HttpError(404, 'Attachment not found.');
    }

    const filePath = path.join(UPLOAD_ROOT, path.basename(filename));
    if (!fs.existsSync(filePath)) {
      throw new HttpError(404, 'Attachment not found.');
    }

    return { filePath, mimeType: match.attachment.mimeType };
  }
}

export const issueReportService = new IssueReportService();
export default issueReportService;
