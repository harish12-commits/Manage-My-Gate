import mongoose from 'mongoose';
import Invoice from './invoice.model.js';
import HttpError from '../../utils/httpError.utils.js';

export class InvoiceRepository {
  /**
   * Batch insert invoices within a transaction session.
   * Gracefully catches duplicate key errors (11000).
   * @param {Array<Object>} invoicesArray - Array of invoice objects.
   * @param {import('mongoose').ClientSession} [session] - Mongoose transaction session.
   * @returns {Promise<Array<import('mongoose').Document>>}
   */
  async createBatch(invoicesArray, session) {
    try {
      const options = session ? { session } : {};
      return await Invoice.insertMany(invoicesArray, options);
    } catch (error) {
      if (error.code === 11000) {
        throw new HttpError(
          409,
          'Duplicate billing spam prevented. One or more invoices in this batch already exist for the same assessment, user, and billing period.',
          error.writeErrors || error.message
        );
      }
      throw error;
    }
  }

  /**
   * Calculate dashboard KPIs for a community in a single round-trip.
   * @param {string} communityId - Community ID.
   * @returns {Promise<{ grossDemand: number, totalCollected: number, inTransitGateway: number, totalUnpaidArrears: number }>}
   */
  async getDashboardKPIs(communityId) {
    const communityMatchCandidates = [];
    if (mongoose.Types.ObjectId.isValid(communityId)) {
      communityMatchCandidates.push(new mongoose.Types.ObjectId(communityId));
    }
    if (communityId) {
      communityMatchCandidates.push(String(communityId));
    }

    const result = await Invoice.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          $or: [
            { communityId: { $in: communityMatchCandidates } },
            { orgId: { $in: communityMatchCandidates } },
          ],
        },
      },
      {
        $lookup: {
          from: 'assessments',
          localField: 'assessmentId',
          foreignField: '_id',
          as: 'assessment',
        },
      },
      {
        $unwind: {
          path: '$assessment',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          totalDueFallback: {
            $ifNull: ['$totalAmount', { $ifNull: ['$totalDue', { $ifNull: ['$currentCharge', 0] }] }],
          },
          paidFallback: {
            $ifNull: ['$paidAmount', 0],
          },
          outstandingFallback: {
            $ifNull: ['$outstandingAmount', { $ifNull: ['$totalDue', { $ifNull: ['$totalAmount', 0] }] }],
          },
        },
      },
      {
        $facet: {
          grossDemand: [
            { $match: { status: { $ne: 'CANCELLED' } } },
            { $group: { _id: null, total: { $sum: '$totalDueFallback' }, count: { $sum: 1 } } },
          ],
          totalCollected: [
            { $match: { status: { $in: ['PAID', 'PARTIALLY_PAID'] } } },
            { $group: { _id: null, total: { $sum: '$paidFallback' } } },
          ],
          inTransitGateway: [
            { $match: { status: 'PAID', settled_at: null, paymentMethod: { $nin: ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'DEMAND_DRAFT', 'NEFT', 'UPI'] } } },
            { $group: { _id: null, total: { $sum: '$paidFallback' } } },
          ],
          pendingOffline: [
            { $match: { status: 'VERIFICATION_PENDING' } },
            {
              $group: {
                _id: null,
                total: { $sum: { $ifNull: ['$offlineAmount', '$outstandingFallback'] } },
                count: { $sum: 1 },
              },
            },
          ],
          totalUnpaidArrears: [
            { $match: { status: { $in: ['UNPAID', 'OVERDUE', 'PARTIALLY_PAID'] } } },
            { $group: { _id: null, total: { $sum: '$outstandingFallback' } } },
          ],
        },
      },
    ]);

    const kpis = result[0];

    const grossDemand = kpis?.grossDemand[0]?.total || 0;
    const grossDemandCount = kpis?.grossDemand[0]?.count || 0;
    const totalCollected = kpis?.totalCollected[0]?.total || 0;
    const inTransitGateway = kpis?.inTransitGateway[0]?.total || 0;
    const pendingOfflineAmount = kpis?.pendingOffline[0]?.total || 0;
    const pendingOfflineCount = kpis?.pendingOffline[0]?.count || 0;
    const totalUnpaidArrears = kpis?.totalUnpaidArrears[0]?.total || 0;

    return {
      grossDemand,
      grossDemandCount,
      totalCollected,
      inTransitGateway,
      totalUnpaidArrears,
      pendingOffline: pendingOfflineAmount,
      pendingOfflineAmount,
      pendingOfflineCount,
    };
  }

  /**
   * Get outstanding dues grouped by targetUserId for portfolio summary.
   * @param {string} userId - User ID.
   * @param {string} [communityId] - Optional Community/Organization ID.
   * @returns {Promise<{ _id: string, totalPortfolioDue: number, unitBreakdown: Array } | null>}
   */
  async getUserPortfolioDues(userId, communityId = null) {
    const matchStage = {
      targetUserId: new mongoose.Types.ObjectId(userId),
      status: { $ne: 'PAID' },
    };
    if (communityId) {
      matchStage.communityId = new mongoose.Types.ObjectId(communityId);
    }

    const result = await Invoice.aggregate([
      {
        $match: matchStage,
      },
      {
        $lookup: {
          from: 'villas',
          localField: 'unitId',
          foreignField: '_id',
          as: 'unitInfo',
        },
      },
      {
        $unwind: {
          path: '$unitInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'assessments',
          localField: 'assessmentId',
          foreignField: '_id',
          as: 'assessment',
        },
      },
      {
        $unwind: {
          path: '$assessment',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '$targetUserId',
          totalPortfolioDue: { $sum: '$outstandingAmount' },
          unitBreakdown: {
            $push: {
              invoiceId: '$_id',
              invoiceNumber: '$invoiceNumber',
              unitId: '$unitId',
              unitNumber: {
                $ifNull: [
                  '$unitInfo.unitNumber',
                  { $ifNull: ['$snapshot.unitDetails.unitNumber', { $ifNull: ['$unitInfo.villaNumber', ''] }] }
                ]
              },
              floor: '$unitInfo.floor',
              type: '$unitInfo.type',
              assessmentName: {
                $ifNull: [
                  '$snapshot.assessmentName',
                  { $ifNull: ['$assessment.name', 'Community Maintenance Assessment'] }
                ]
              },
              residentName: '$snapshot.residentDetails.name',
              residentType: '$snapshot.residentDetails.residencyType',
              currentCharge: '$currentCharge',
              previousOutstanding: '$previousOutstanding',
              lateFeeAmount: '$lateFeeAmount',
              totalDue: '$totalDue',
              outstandingAmount: '$outstandingAmount',
              paidAmount: '$paidAmount',
              billingPeriodString: '$billingPeriodString',
              status: '$status',
              dueDate: '$dueDate',
              createdAt: '$createdAt',
              paid_at: '$paid_at',
              paymentMethod: '$paymentMethod',
              offlineReference: '$offlineReference',
              offlineAmount: '$offlineAmount',
              paymentDate: '$paymentDate',
              paymentScreenshot: '$paymentScreenshot',
              payerNotes: '$payerNotes',
            },
          },
        },
      },
    ]);

    return result[0] || null;
  }

  /**
   * Get recent invoice history for a user.
   * @param {string} userId - User ID.
   * @param {string} [communityId] - Optional Community/Organization ID.
   * @returns {Promise<Array>}
   */
  async getUserRecentInvoices(userId, communityId = null) {
    const matchStage = {
      targetUserId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    };
    if (communityId) {
      matchStage.communityId = new mongoose.Types.ObjectId(communityId);
    }

    return await Invoice.aggregate([
      {
        $match: matchStage,
      },
      {
        $lookup: {
          from: 'villas',
          localField: 'unitId',
          foreignField: '_id',
          as: 'unitInfo',
        },
      },
      {
        $unwind: {
          path: '$unitInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'assessments',
          localField: 'assessmentId',
          foreignField: '_id',
          as: 'assessment',
        },
      },
      {
        $unwind: {
          path: '$assessment',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          invoiceId: '$_id',
          invoiceNumber: 1,
          unitId: 1,
          unitNumber: {
            $ifNull: [
              '$unitInfo.unitNumber',
              { $ifNull: ['$snapshot.unitDetails.unitNumber', { $ifNull: ['$unitInfo.villaNumber', ''] }] }
            ]
          },
          type: '$unitInfo.type',
          assessmentName: {
            $ifNull: [
              '$snapshot.assessmentName',
              { $ifNull: ['$assessment.name', 'Community Maintenance Assessment'] }
            ]
          },
          residentName: '$snapshot.residentDetails.name',
          residentType: '$snapshot.residentDetails.residencyType',
          currentCharge: 1,
          previousOutstanding: 1,
          lateFeeAmount: 1,
          totalDue: 1,
          outstandingAmount: 1,
          paidAmount: 1,
          billingPeriodString: 1,
          status: 1,
          dueDate: 1,
          createdAt: 1,
          paid_at: 1,
          paymentMethod: 1,
          offlineReference: 1,
          offlineAmount: 1,
          paymentDate: 1,
          paymentScreenshot: 1,
          payerNotes: 1
        }
      }
    ]);
  }

  /**
   * Transactional check-and-update to prevent race conditions.
   * @param {string} invoiceId - Invoice ID.
   * @param {string} newStatus - New invoice status.
   * @param {Object} paymentData - Payment details (paymentMethod, paid_at, settled_at, offlineReference).
   * @param {import('mongoose').ClientSession} [session] - Mongoose transaction session.
   * @returns {Promise<import('mongoose').Document>}
   */
  async updateStatusWithLock(invoiceId, newStatus, paymentData = {}, session) {
    const isObjId = mongoose.Types.ObjectId.isValid(invoiceId);
    const filter = isObjId
      ? { $or: [{ _id: invoiceId }, { invoiceNumber: invoiceId }] }
      : { invoiceNumber: invoiceId };

    const activeSession = session && typeof session.inTransaction === 'function' && session.inTransaction() ? session : null;
    const query = Invoice.findOne(filter);
    if (activeSession) {
      query.session(activeSession);
    }
    const invoice = await query;

    if (!invoice) {
      throw new HttpError(404, 'Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new HttpError(409, 'Invoice is already paid and cannot be updated');
    }

    if (newStatus === 'PAID' || newStatus === 'PARTIALLY_PAID') {
      invoice.paid_at = paymentData.paid_at || new Date();
      invoice.settled_at = paymentData.settled_at || null;
      invoice.paymentMethod = paymentData.paymentMethod || invoice.paymentMethod || null;
      invoice.offlineReference = paymentData.offlineReference || invoice.offlineReference || null;
      if (paymentData.paymentScreenshot !== undefined) {
        invoice.paymentScreenshot = paymentData.paymentScreenshot;
      }
      if (paymentData.payerNotes !== undefined) {
        invoice.payerNotes = paymentData.payerNotes;
      }
      
      const totalInvoiceLiability =
        Number(invoice.totalAmount) ||
        Number(invoice.totalDue) ||
        Number(invoice.currentCharge) ||
        (Number(invoice.outstandingAmount || 0) + Number(invoice.paidAmount || 0)) ||
        0;

      const previousPaid = Number(invoice.paidAmount || 0);
      const remainingBeforePayment = Math.max(0, totalInvoiceLiability - previousPaid);

      let applyAmount = 0;
      if (paymentData.amount !== undefined && paymentData.amount !== null && Number(paymentData.amount) > 0) {
        applyAmount = Number(paymentData.amount);
      } else if (paymentData.paymentMethod !== 'WALLET') {
        applyAmount = remainingBeforePayment;
      }

      applyAmount = Math.min(applyAmount, remainingBeforePayment > 0 ? remainingBeforePayment : applyAmount);

      invoice.paidAmount = previousPaid + applyAmount;
      invoice.totalAmount = totalInvoiceLiability;
      invoice.totalDue = totalInvoiceLiability;
      invoice.outstandingAmount = Math.max(0, Math.round((totalInvoiceLiability - invoice.paidAmount) * 100) / 100);
      
      if (invoice.outstandingAmount > 0.01) {
        invoice.status = 'PARTIALLY_PAID';
      } else {
        invoice.status = 'PAID';
        invoice.outstandingAmount = 0;
      }

      // Reset offline amount since it has been processed
      invoice.offlineAmount = 0;
    } else if (newStatus === 'CANCELLED') {
      invoice.status = newStatus;
      invoice.paid_at = null;
      invoice.settled_at = null;
      invoice.paymentMethod = null;
      invoice.offlineReference = null;
    } else if (newStatus === 'VERIFICATION_PENDING') {
      invoice.status = newStatus;
      if (paymentData.offlineReference !== undefined) invoice.offlineReference = paymentData.offlineReference;
      if (paymentData.offlineAmount !== undefined) invoice.offlineAmount = paymentData.offlineAmount;
      if (paymentData.paymentMethod !== undefined) invoice.paymentMethod = paymentData.paymentMethod;
      if (paymentData.paymentDate !== undefined) invoice.paymentDate = paymentData.paymentDate;
      if (paymentData.paymentScreenshot !== undefined) invoice.paymentScreenshot = paymentData.paymentScreenshot;
      if (paymentData.payerNotes !== undefined) invoice.payerNotes = paymentData.payerNotes;
    } else {
      invoice.status = newStatus;
    }

    if (paymentData.auditEntry) {
      invoice.auditHistory = invoice.auditHistory || [];
      invoice.auditHistory.push(paymentData.auditEntry);
    }

    return await invoice.save(activeSession ? { session: activeSession } : undefined);
  }

  /**
   * Fetch all community invoices.
   */
  async getInvoices(orgId, query) {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      startDate,
      endDate,
      block,
      paymentMethod,
      groupBy = 'none',
    } = query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const communityMatchCandidates = [];
    if (mongoose.Types.ObjectId.isValid(orgId)) {
      communityMatchCandidates.push(new mongoose.Types.ObjectId(orgId));
    }
    if (orgId) {
      communityMatchCandidates.push(String(orgId));
    }

    const matchConditions = { isDeleted: false };

    // 1. Date Range filtering (on createdAt)
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length === 10) {
          end.setHours(23, 59, 59, 999);
        }
        dateFilter.$lte = end;
      }
      matchConditions.createdAt = dateFilter;
    }

    // 2. Payment Method filtering
    if (paymentMethod && paymentMethod !== 'ALL') {
      if (paymentMethod === 'NEFT' || paymentMethod === 'BANK_TRANSFER') {
        matchConditions.paymentMethod = { $in: ['BANK_TRANSFER', 'NEFT'] };
      } else {
        matchConditions.paymentMethod = paymentMethod;
      }
    }

    // 3. Omnisearch matching with robust barcode/QR protocol handling
    const searchMatch = {};
    const candidateTerms = new Set();
    let isSpecificInvoiceSearch = false;

    if (search && search.trim()) {
      const rawQ = search.trim();
      candidateTerms.add(rawQ);

      // Strip leading #
      if (rawQ.startsWith('#')) {
        candidateTerms.add(rawQ.replace(/^#+/, '').trim());
      }

      // Handle MMG barcode protocol: MMG:TYPE:CODE[:ID][:NAME]
      if (/^MMG[:\-_]/i.test(rawQ)) {
        const withoutPrefix = rawQ.replace(/^MMG[:\-_]/i, '');
        const parts = withoutPrefix.split(':');
        parts.forEach((p) => {
          const cleanP = p.trim().replace(/_/g, ' ');
          if (cleanP) candidateTerms.add(cleanP);
        });
      }

      // Handle JSON payload
      if (rawQ.startsWith('{') && rawQ.endsWith('}')) {
        try {
          const parsed = JSON.parse(rawQ);
          if (parsed.invoiceNumber) candidateTerms.add(String(parsed.invoiceNumber).trim());
          if (parsed.code) candidateTerms.add(String(parsed.code).trim());
          if (parsed.invoiceId) candidateTerms.add(String(parsed.invoiceId).trim());
          if (parsed.id) candidateTerms.add(String(parsed.id).trim());
          if (parsed._id) candidateTerms.add(String(parsed._id).trim());
        } catch (_) {}
      }

      // Handle URL format: .../invoice/:id or ?id=...
      if (rawQ.includes('/') || rawQ.includes('?')) {
        const matchParam = rawQ.match(/[?&](?:code|invoiceNumber|invoiceId|id)=([^&#]+)/i);
        if (matchParam && matchParam[1]) {
          candidateTerms.add(decodeURIComponent(matchParam[1]).trim());
        }
        const lastSlash = rawQ.split('/').pop()?.split('?')[0]?.trim();
        if (lastSlash && lastSlash.length >= 4) {
          candidateTerms.add(decodeURIComponent(lastSlash));
        }
      }

      const orConditions = [];

      for (const term of candidateTerms) {
        if (!term) continue;
        const cleanTerm = term.trim();
        if (!cleanTerm) continue;

        // Check if query is looking for a specific invoice number or ID
        if (
          mongoose.Types.ObjectId.isValid(cleanTerm) ||
          /^INV[-_]?[a-zA-Z0-9_\-]+$/i.test(cleanTerm) ||
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanTerm)
        ) {
          isSpecificInvoiceSearch = true;
        }

        const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        orConditions.push(
          { invoiceNumber: { $regex: escaped, $options: 'i' } },
          { offlineReference: { $regex: escaped, $options: 'i' } },
          { billingPeriodString: { $regex: escaped, $options: 'i' } },
          { 'snapshot.assessmentName': { $regex: escaped, $options: 'i' } },
          { 'assessment.name': { $regex: escaped, $options: 'i' } },
          { 'unitInfo.unitNumber': { $regex: escaped, $options: 'i' } },
          { 'snapshot.unitDetails.unitNumber': { $regex: escaped, $options: 'i' } },
          { 'unitInfo.blockOrBuilding': { $regex: escaped, $options: 'i' } },
          { 'userInfo.name': { $regex: escaped, $options: 'i' } },
          { 'userInfo.username': { $regex: escaped, $options: 'i' } },
          { 'userInfo.email': { $regex: escaped, $options: 'i' } },
          { 'userInfo.phone': { $regex: escaped, $options: 'i' } },
          { 'snapshot.residentDetails.name': { $regex: escaped, $options: 'i' } }
        );

        if (mongoose.Types.ObjectId.isValid(cleanTerm)) {
          orConditions.push({ _id: new mongoose.Types.ObjectId(cleanTerm) });
        }
      }

      if (orConditions.length > 0) {
        searchMatch.$or = orConditions;
      }
    }

    // 4. Block filtering
    const blockMatch = {};
    if (block && block !== 'ALL') {
      blockMatch['unitInfo.blockOrBuilding'] = block;
    }

    // Base pipeline stages up to lookups and filter matches
    const basePipeline = [
      {
        $match: {
          $and: [
            {
              $or: [
                { communityId: { $in: communityMatchCandidates } },
                { orgId: { $in: communityMatchCandidates } },
                { communityId: { $exists: false } },
              ],
            },
            matchConditions,
          ],
        },
      },
      {
        $lookup: {
          from: 'assessments',
          localField: 'assessmentId',
          foreignField: '_id',
          as: 'assessment',
        },
      },
      { $unwind: { path: '$assessment', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $and: [
            {
              $or: [
                { communityId: { $in: communityMatchCandidates } },
                { orgId: { $in: communityMatchCandidates } },
                { 'assessment.communityId': { $in: communityMatchCandidates } },
                { communityId: { $exists: false } },
              ],
            },
            matchConditions,
          ],
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'targetUserId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'villas',
          localField: 'unitId',
          foreignField: '_id',
          as: 'unitInfo',
        },
      },
      { $unwind: { path: '$unitInfo', preserveNullAndEmptyArrays: true } },
      { $match: searchMatch },
      { $match: blockMatch },
    ];

    // Compute live status counts across all statuses for the active tenant, block, and date filter
    const statusCountsFacet = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ];

    // If searching for a specific invoice number or ObjectId (e.g. from QR scan),
    // allow matching across all statuses so the scanned record is never blocked by a status tab filter
    const statusMatch = status && status !== 'ALL' && !isSpecificInvoiceSearch ? [{ $match: { status } }] : [];

    // --- GROUP BY: UNIT / VILLA ---
    if (groupBy === 'unit') {
      const unitPipeline = [
        ...basePipeline,
        {
          $facet: {
            data: [
              ...statusMatch,
              {
                $group: {
                  _id: { $ifNull: ['$unitId', 'unassigned'] },
                  unitId: { $first: '$unitId' },
                  unitNumber: { $first: { $ifNull: ['$unitInfo.unitNumber', 'Unassigned'] } },
                  blockOrBuilding: { $first: { $ifNull: ['$unitInfo.blockOrBuilding', '—'] } },
                  unitType: { $first: { $ifNull: ['$unitInfo.type', 'Apartment'] } },
                  primaryResident: { $first: { $ifNull: ['$userInfo.name', { $ifNull: ['$userInfo.username', '—'] }] } },
                  primaryResidentPhone: { $first: { $ifNull: ['$userInfo.phone', ''] } },
                  totalBilled: { $sum: { $ifNull: ['$totalAmount', { $ifNull: ['$totalDue', 0] }] } },
                  totalPaid: { $sum: { $ifNull: ['$paidAmount', 0] } },
                  outstandingBalance: { $sum: { $ifNull: ['$outstandingAmount', 0] } },
                  invoiceCount: { $sum: 1 },
                  pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'VERIFICATION_PENDING'] }, 1, 0] } },
                  overdueCount: { $sum: { $cond: [{ $eq: ['$status', 'OVERDUE'] }, 1, 0] } },
                  invoices: {
                    $push: {
                      _id: '$_id',
                      invoiceNumber: '$invoiceNumber',
                      billingPeriodString: '$billingPeriodString',
                      assessmentName: { $ifNull: ['$snapshot.assessmentName', { $ifNull: ['$assessment.name', 'Assessment'] }] },
                      totalAmount: { $ifNull: ['$totalAmount', { $ifNull: ['$totalDue', 0] }] },
                      paidAmount: { $ifNull: ['$paidAmount', 0] },
                      outstandingAmount: { $ifNull: ['$outstandingAmount', 0] },
                      status: '$status',
                      dueDate: '$dueDate',
                      createdAt: '$createdAt',
                      paymentMethod: '$paymentMethod',
                      offlineReference: '$offlineReference',
                      offlineAmount: '$offlineAmount',
                      paymentDate: '$paymentDate',
                      paymentScreenshot: '$paymentScreenshot',
                      payerNotes: '$payerNotes',
                    },
                  },
                },
              },
              { $sort: { outstandingBalance: -1, unitNumber: 1 } },
              { $skip: skip },
              { $limit: take },
            ],
            metadata: [
              ...statusMatch,
              {
                $group: {
                  _id: { $ifNull: ['$unitId', 'unassigned'] },
                },
              },
              { $count: 'totalRecords' },
            ],
            statusCounts: statusCountsFacet,
          },
        },
      ];

      const result = await Invoice.aggregate(unitPipeline);
      return this._formatInvoicesResult(result, page, take);
    }

    // --- GROUP BY: RESIDENT ---
    if (groupBy === 'resident') {
      const residentPipeline = [
        ...basePipeline,
        {
          $facet: {
            data: [
              ...statusMatch,
              {
                $group: {
                  _id: { $ifNull: ['$targetUserId', 'unassigned'] },
                  residentId: { $first: '$targetUserId' },
                  residentName: { $first: { $ifNull: ['$userInfo.name', { $ifNull: ['$userInfo.username', 'Unknown Resident'] }] } },
                  phone: { $first: { $ifNull: ['$userInfo.phone', '—'] } },
                  email: { $first: { $ifNull: ['$userInfo.email', '—'] } },
                  units: { $addToSet: { $ifNull: ['$unitInfo.unitNumber', 'Unassigned'] } },
                  totalPortfolioDue: { $sum: { $ifNull: ['$outstandingAmount', 0] } },
                  totalPaid: { $sum: { $ifNull: ['$paidAmount', 0] } },
                  totalBilled: { $sum: { $ifNull: ['$totalAmount', { $ifNull: ['$totalDue', 0] }] } },
                  invoiceCount: { $sum: 1 },
                  pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'VERIFICATION_PENDING'] }, 1, 0] } },
                  overdueCount: { $sum: { $cond: [{ $eq: ['$status', 'OVERDUE'] }, 1, 0] } },
                  invoices: {
                    $push: {
                      _id: '$_id',
                      invoiceNumber: '$invoiceNumber',
                      unitNumber: '$unitInfo.unitNumber',
                      billingPeriodString: '$billingPeriodString',
                      assessmentName: { $ifNull: ['$snapshot.assessmentName', { $ifNull: ['$assessment.name', 'Assessment'] }] },
                      totalAmount: { $ifNull: ['$totalAmount', { $ifNull: ['$totalDue', 0] }] },
                      paidAmount: { $ifNull: ['$paidAmount', 0] },
                      outstandingAmount: { $ifNull: ['$outstandingAmount', 0] },
                      status: '$status',
                      dueDate: '$dueDate',
                      createdAt: '$createdAt',
                    },
                  },
                },
              },
              { $sort: { totalPortfolioDue: -1, residentName: 1 } },
              { $skip: skip },
              { $limit: take },
            ],
            metadata: [
              ...statusMatch,
              {
                $group: {
                  _id: { $ifNull: ['$targetUserId', 'unassigned'] },
                },
              },
              { $count: 'totalRecords' },
            ],
            statusCounts: statusCountsFacet,
          },
        },
      ];

      const result = await Invoice.aggregate(residentPipeline);
      return this._formatInvoicesResult(result, page, take);
    }

    // --- GROUP BY: BILLING CYCLE / ASSESSMENT ---
    if (groupBy === 'cycle') {
      const cyclePipeline = [
        ...basePipeline,
        {
          $facet: {
            data: [
              ...statusMatch,
              {
                $group: {
                  _id: {
                    period: '$billingPeriodString',
                    assessmentId: { $ifNull: ['$assessmentId', 'general'] },
                  },
                  billingPeriodString: { $first: '$billingPeriodString' },
                  assessmentName: { $first: { $ifNull: ['$snapshot.assessmentName', { $ifNull: ['$assessment.name', 'General Assessment'] }] } },
                  totalTargeted: { $sum: 1 },
                  grossDemand: { $sum: { $ifNull: ['$totalAmount', { $ifNull: ['$totalDue', 0] }] } },
                  totalCollected: { $sum: { $ifNull: ['$paidAmount', 0] } },
                  totalOutstanding: { $sum: { $ifNull: ['$outstandingAmount', 0] } },
                  paidCount: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] } },
                  pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'VERIFICATION_PENDING'] }, 1, 0] } },
                  unpaidCount: { $sum: { $cond: [{ $in: ['$status', ['UNPAID', 'OVERDUE']] }, 1, 0] } },
                  invoices: {
                    $push: {
                      _id: '$_id',
                      invoiceNumber: '$invoiceNumber',
                      unitNumber: '$unitInfo.unitNumber',
                      targetUser: { $ifNull: ['$userInfo.name', '$userInfo.username'] },
                      totalAmount: { $ifNull: ['$totalAmount', { $ifNull: ['$totalDue', 0] }] },
                      paidAmount: { $ifNull: ['$paidAmount', 0] },
                      outstandingAmount: { $ifNull: ['$outstandingAmount', 0] },
                      status: '$status',
                      paymentMethod: '$paymentMethod',
                      offlineReference: '$offlineReference',
                      offlineAmount: '$offlineAmount',
                      paymentDate: '$paymentDate',
                      paymentScreenshot: '$paymentScreenshot',
                      payerNotes: '$payerNotes',
                    },
                  },
                },
              },
              { $sort: { billingPeriodString: -1 } },
              { $skip: skip },
              { $limit: take },
            ],
            metadata: [
              ...statusMatch,
              {
                $group: {
                  _id: {
                    period: '$billingPeriodString',
                    assessmentId: { $ifNull: ['$assessmentId', 'general'] },
                  },
                },
              },
              { $count: 'totalRecords' },
            ],
            statusCounts: statusCountsFacet,
          },
        },
      ];

      const result = await Invoice.aggregate(cyclePipeline);
      return this._formatInvoicesResult(result, page, take);
    }

    // --- DEFAULT: FLAT INVOICES LIST (groupBy === 'none') ---
    const result = await Invoice.aggregate([
      ...basePipeline,
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [
            ...statusMatch,
            { $skip: skip },
            { $limit: take },
            {
              $project: {
                _id: 1,
                invoiceNumber: 1,
                billingPeriodString: 1,
                dueDate: 1,
                createdAt: 1,
                assessmentName: { $ifNull: ['$snapshot.assessmentName', { $ifNull: ['$assessment.name', 'Maintenance Assessment'] }] },
                date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                unitNumber: { $ifNull: ['$unitInfo.unitNumber', '$snapshot.unitDetails.unitNumber'] },
                blockOrBuilding: '$unitInfo.blockOrBuilding',
                targetUser: { $ifNull: ['$userInfo.name', { $ifNull: ['$userInfo.username', '$snapshot.residentDetails.name'] }] },
                amount: { $ifNull: ['$totalDue', { $ifNull: ['$totalAmount', { $ifNull: ['$outstandingAmount', { $ifNull: ['$currentCharge', 0] }] }] }] },
                totalDue: { $ifNull: ['$totalDue', { $ifNull: ['$totalAmount', { $ifNull: ['$outstandingAmount', { $ifNull: ['$currentCharge', 0] }] }] }] },
                totalAmount: { $ifNull: ['$totalAmount', { $ifNull: ['$totalDue', 0] }] },
                outstandingAmount: { $ifNull: ['$outstandingAmount', { $ifNull: ['$totalDue', { $ifNull: ['$totalAmount', 0] }] }] },
                paidAmount: { $ifNull: ['$paidAmount', 0] },
                currency: { $literal: 'INR' },
                status: 1,
                paymentMethod: { $ifNull: ['$paymentMethod', '—'] },
                offlineReference: 1,
                offlineAmount: 1,
                paymentDate: 1,
                paymentScreenshot: 1,
                payerNotes: 1,
                rejectionReason: 1,
              },
            },
          ],
          metadata: [
            ...statusMatch,
            { $count: 'totalRecords' },
          ],
          statusCounts: statusCountsFacet,
        },
      },
    ]);

    return this._formatInvoicesResult(result, page, take);
  }

  /**
   * Helper to format pagination and status count metadata.
   */
  _formatInvoicesResult(result, page, take) {
    const data = result[0]?.data || [];
    const totalRecords = result[0]?.metadata[0]?.totalRecords || 0;
    const totalPages = Math.ceil(totalRecords / take) || 1;

    const rawStatusCounts = result[0]?.statusCounts || [];
    const statusCounts = {
      ALL: 0,
      VERIFICATION_PENDING: 0,
      UNPAID: 0,
      PARTIALLY_PAID: 0,
      OVERDUE: 0,
      PAID: 0,
    };

    let totalAll = 0;
    rawStatusCounts.forEach((item) => {
      if (item._id && statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
      totalAll += item.count;
    });
    statusCounts.ALL = totalAll;

    return {
      data,
      statusCounts,
      pagination: {
        totalRecords,
        currentPage: parseInt(page, 10),
        totalPages,
        limit: take,
      },
    };
  }

  /**
   * Check if there are active (unpaid or pending verification) invoices for an assessment template.
   */
  async hasActiveInvoices(assessmentId) {
    const match = await Invoice.exists({
      assessmentId,
      status: { $in: ['UNPAID', 'VERIFICATION_PENDING'] },
    });
    return match !== null;
  }

  /**
   * Check if any invoices exist for an assessment template.
   */
  async hasAnyInvoices(assessmentId) {
    const match = await Invoice.exists({ assessmentId });
    return match !== null;
  }
}

export default new InvoiceRepository();
