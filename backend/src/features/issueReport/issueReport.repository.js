import mongoose from 'mongoose';
import IssueReport from './issueReport.model.js';
import IssueReportSequence from './issueReportSequence.model.js';

export class IssueReportRepository {
  /**
   * Atomic, concurrency-safe Report Number Generator.
   * Produces sequential identifiers formatted like NAH-000001, NAH-000123.
   *
   * @param {mongoose.ClientSession|null} [session=null]
   * @returns {Promise<string>}
   */
  async getNextReportNumber(session = null) {
    const options = { new: true, upsert: true, setDefaultsOnInsert: true };
    if (session) options.session = session;

    const sequence = await IssueReportSequence.findOneAndUpdate(
      { key: 'REPORT_SEQUENCE' },
      { $inc: { currentSequence: 1 } },
      options
    );

    const formattedNum = String(sequence.currentSequence).padStart(6, '0');
    return `NAH-${formattedNum}`;
  }

  /**
   * Persist a new Issue Report document.
   *
   * @param {Object} reportData
   * @param {mongoose.ClientSession|null} [session=null]
   * @returns {Promise<Object>} Persisted Mongoose document
   */
  async create(reportData, session = null) {
    const options = session ? { session } : {};
    const [report] = await IssueReport.create([reportData], options);
    return report;
  }

  /**
   * Find report by client request ID (used for idempotency / duplicate check).
   *
   * @param {string} userId - Reporter (keys are scoped per user)
   * @param {string} clientRequestId
   * @param {mongoose.ClientSession|null} [session=null]
   * @returns {Promise<Object|null>}
   */
  async findByClientRequestId(userId, clientRequestId, session = null) {
    if (!clientRequestId || !mongoose.Types.ObjectId.isValid(userId)) return null;
    const query = IssueReport.findOne({ 'reporter.userId': userId, clientRequestId, isDeleted: false });
    if (session) query.session(session);
    return await query.exec();
  }

  /**
   * Find a single report by its MongoDB ObjectId.
   *
   * @param {string} id
   * @param {mongoose.ClientSession|null} [session=null]
   * @returns {Promise<Object|null>}
   */
  async findById(id, session = null) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const query = IssueReport.findOne({ _id: id, isDeleted: false });
    if (session) query.session(session);
    return await query.exec();
  }

  /**
   * Platform Admin Report Listing using single-roundtrip Mongoose $facet aggregation pipeline.
   *
   * @param {Object} queryOptions
   * @returns {Promise<{ reports: Array, total: number, page: number, limit: number, totalPages: number }>}
   */
  async findPlatformReports({
    search,
    reportType,
    feature,
    organisationId,
    platform,
    startDate,
    endDate,
    page = 1,
    limit = 10,
    sort = { createdAt: -1 },
  } = {}) {
    const matchQuery = { isDeleted: false };

    if (reportType) {
      matchQuery.reportType = reportType;
    }

    if (feature) {
      matchQuery.feature = feature;
    }

    if (organisationId && mongoose.Types.ObjectId.isValid(organisationId)) {
      matchQuery['organisation.organisationId'] = new mongoose.Types.ObjectId(organisationId);
    }

    if (platform) {
      matchQuery['technicalContext.platform'] = platform.toLowerCase();
    }

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) {
        matchQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchQuery.createdAt.$lte = new Date(endDate);
      }
    }

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      matchQuery.$or = [
        { reportNumber: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { 'reporter.name': searchRegex },
        { 'reporter.email': searchRegex },
        { 'organisation.name': searchRegex },
      ];
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (safePage - 1) * safeLimit;

    const pipeline = [
      { $match: matchQuery },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $sort: sort },
            { $skip: skip },
            { $limit: safeLimit },
          ],
        },
      },
    ];

    const [facetResult] = await IssueReport.aggregate(pipeline);
    const total = facetResult?.metadata?.[0]?.total || 0;
    const reports = facetResult?.data || [];
    const totalPages = Math.ceil(total / safeLimit) || 1;

    return {
      reports,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  /**
   * Find a single report by MongoDB ObjectId strictly scoped to an organization boundary.
   *
   * @param {string} id
   * @param {string} organisationId
   * @param {mongoose.ClientSession|null} [session=null]
   * @returns {Promise<Object|null>}
   */
  /**
   * Locate the report owning a stored attachment file, optionally scoped to an organization.
   *
   * @param {string} filename - Stored attachment file name (already validated)
   * @param {string|null} organisationId - Restrict to this org, or null for platform-wide access
   * @returns {Promise<{ report: Object, attachment: Object }|null>}
   */
  async findAttachment(filename, organisationId = null) {
    const urls = [`/uploads/issueReports/${filename}`, `/public/uploads/issueReports/${filename}`];
    const filter = { 'attachments.url': { $in: urls }, isDeleted: false };
    if (organisationId) {
      if (!mongoose.Types.ObjectId.isValid(organisationId)) return null;
      filter['organisation.organisationId'] = new mongoose.Types.ObjectId(organisationId);
    }
    const report = await IssueReport.findOne(filter).select('attachments organisation').lean();
    if (!report) return null;
    const attachment = report.attachments.find((a) => urls.includes(a.url));
    return attachment ? { report, attachment } : null;
  }

  async findCommunityReportById(id, organisationId, session = null) {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(organisationId)) return null;
    const query = IssueReport.findOne({
      _id: id,
      'organisation.organisationId': organisationId,
      isDeleted: false,
    });
    if (session) query.session(session);
    return await query.exec();
  }
}

export const issueReportRepository = new IssueReportRepository();
export default issueReportRepository;
