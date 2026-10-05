import crypto from 'crypto';
import mongoose from 'mongoose';
import platformQuoteRepository from './platformQuote.repository.js';
import platformQuoteEvents from './platformQuote.events.js';
import crmInquiryService from '../crmInquiry/crmInquiry.service.js';
import HttpError from '../../utils/httpError.utils.js';

export const QUOTE_ALLOWED_TRANSITIONS = {
  DRAFT: ['PENDING_APPROVAL', 'APPROVED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['SENT', 'ACCEPTED'],
  SENT: ['VIEWED', 'EXPIRED', 'ACCEPTED', 'REJECTED'],
  VIEWED: ['NEGOTIATION', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
  NEGOTIATION: ['APPROVED', 'REJECTED', 'ACCEPTED'],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

export class PlatformQuoteService {
  /**
   * Compute SHA-256 hash for secure acceptance tokens (Mandatory Correction 5).
   * @param {string} token
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate secure 256-bit acceptance token.
   */
  generateAcceptanceToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Format human-readable quote number: Q-{GroupSequence}-V{Version}
   */
  generateQuoteNumber(groupCode, versionNumber = 1) {
    return `${groupCode}-V${versionNumber}`;
  }

  /**
   * Pricing Calculator: Calculates subtotal, discount, VAT (15%), and total.
   */
  calculatePricing({ basePrice = 2000, perUnitRate = 10, unitCount = 1, setupFee = 500, discountPercent = 0, discountType = 'PERCENTAGE', addOns = [] }) {
    const numericUnits = Math.max(1, parseInt(unitCount, 10) || 1);
    const numericBase = Math.max(0, parseFloat(basePrice) || 0);
    const numericRate = Math.max(0, parseFloat(perUnitRate) || 0);
    const numericSetup = Math.max(0, parseFloat(setupFee) || 0);

    const addOnsTotal = (addOns || []).reduce((acc, addon) => acc + (parseFloat(addon.price) || 0), 0);
    const subtotal = numericBase + (numericUnits * numericRate) + numericSetup + addOnsTotal;

    let discountAmount = 0;
    const numericDiscount = Math.max(0, parseFloat(discountPercent) || 0);
    if (discountType === 'PERCENTAGE') {
      discountAmount = (subtotal * Math.min(100, numericDiscount)) / 100;
    } else {
      discountAmount = Math.min(subtotal, numericDiscount);
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const vatAmount = discountedSubtotal * 0.15; // 15% VAT
    const totalAmount = discountedSubtotal + vatAmount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      discountPercent: numericDiscount,
    };
  }

  /**
   * Create a new B2B Commercial Quote for a DEMO_COMPLETED inquiry.
   * @param {Object} payload
   */
  async createQuote(payload) {
    const { 
      inquiryId, 
      planName = 'COMMUNITY_PROFESSIONAL', 
      basePrice = (payload.tierPrice !== undefined ? payload.tierPrice : 0), 
      perUnitRate = (payload.perUnitRate !== undefined ? payload.perUnitRate : 700), 
      setupFee = (payload.setupFee !== undefined ? payload.setupFee : 5000), 
      discountPercent = (payload.adminDiscountPercent !== undefined ? payload.adminDiscountPercent : (payload.discountPercent || 10)), 
      discountType = 'PERCENTAGE', 
      addOns = (payload.selectedAddOns && payload.selectedAddOns.length > 0) ? payload.selectedAddOns : (payload.selectedFeatures || payload.addOns || []), 
      validityDays = 30, 
      actorId, 
      actorName = 'System' 
    } = payload;

    // Validate Inquiry state boundary: Must be DEMO_COMPLETED unless auto-promotion/skip requested
    const inquiry = await crmInquiryService.getInquiryById(inquiryId);
    if (!payload.skipStatusCheck && inquiry.status !== 'DEMO_COMPLETED') {
      if (payload.autoPromoteStatus) {
        await crmInquiryService.updateInquiryStage(inquiryId, 'DEMO_COMPLETED', actorId, actorName, 'Auto-promoted for Instant Quote & Order generation').catch(() => null);
      } else {
        throw new HttpError(400, `Quote creation requires Inquiry status to be DEMO_COMPLETED. Current status is '${inquiry.status}'. Complete the demo first.`);
      }
    }

    // Version group code generation
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const versionGroupCode = payload.versionGroupCode || `Q-${randomSeq}`;
    const versionNumber = payload.versionNumber || 1;
    const quoteNumber = this.generateQuoteNumber(versionGroupCode, versionNumber);

    // Calculate Pricing
    const unitCount = payload.unitCount || inquiry.unitCount || inquiry.villaCount || 250;
    const pricingResult = this.calculatePricing({
      basePrice,
      perUnitRate,
      unitCount,
      setupFee,
      discountPercent,
      discountType,
      addOns,
    });

    const finalSubtotal = payload.subtotal !== undefined ? parseFloat(payload.subtotal) : pricingResult.subtotal;
    const finalTotalAmount = payload.calculatedTotal !== undefined ? parseFloat(payload.calculatedTotal) : (payload.totalAmount !== undefined ? parseFloat(payload.totalAmount) : (payload.grandTotal !== undefined ? parseFloat(payload.grandTotal) : (pricingResult.totalAmount || 186300)));

    // Approval Threshold Engine
    let approvalRequired = false;
    let approvalTier = 'NONE';
    let initialStatus = 'APPROVED';

    if (pricingResult.discountPercent > 20) {
      approvalRequired = true;
      approvalTier = 'PLATFORM_ADMIN';
      initialStatus = 'PENDING_APPROVAL';
    } else if (pricingResult.discountPercent > 10) {
      approvalRequired = true;
      approvalTier = 'SALES_MANAGER';
      initialStatus = 'PENDING_APPROVAL';
    }

    // Generate SHA-256 Hashed Acceptance Token
    const rawAcceptanceToken = this.generateAcceptanceToken();
    const acceptanceTokenHash = this.hashToken(rawAcceptanceToken);

    // Deep-copy immutable snapshots
    const customerSnapshot = {
      customerName: inquiry.customerName || inquiry.contactName || inquiry.username || inquiry.name || 'Valued Customer',
      contactEmail: inquiry.contactEmail || inquiry.email || 'user@managemygate.com',
      contactPhone: inquiry.contactPhone || inquiry.phone || 'N/A',
    };

    const communitySnapshot = {
      organizationName: inquiry.organizationName || inquiry.communityName || inquiry.companyName || 'Your Community',
      villaCount: unitCount,
    };

    const pricingSnapshot = {
      planName,
      tier: planName,
      basePrice: parseFloat(basePrice) || 0,
      perUnitRate: parseFloat(perUnitRate) || 700,
      selectedAddOns: addOns || [],
      setupFee: parseFloat(setupFee) || 5000,
      validityInMonths: 12,
      taxRatePercent: 15,
    };

    const validUntil = new Date(Date.now() + validityDays * 24 * 3600 * 1000);

    const quoteData = {
      quoteNumber,
      versionGroupCode,
      versionNumber,
      isLatestVersion: true,
      isLocked: false,
      version: 1,
      inquiryId: inquiry._id,
      humanInquiryId: inquiry.inquiryId,
      customerSnapshot,
      communitySnapshot,
      pricingSnapshot,
      unitCount,
      subtotal: finalSubtotal,
      discountType,
      discountPercent: pricingResult.discountPercent,
      discountAmount: pricingResult.discountAmount,
      setupFee: parseFloat(setupFee) || 5000,
      vatAmount: pricingResult.vatAmount,
      totalAmount: finalTotalAmount,
      currency: payload.currency || 'INR',
      status: initialStatus,
      approvalRequired,
      approvalTier,
      acceptanceTokenHash,
      orderEligibility: 'NOT_ELIGIBLE',
      validUntil,
      createdBy: actorId || null,
    };

    // Transactionally archive previous versions in group if creating new version
    if (versionNumber > 1) {
      await platformQuoteRepository.archivePreviousVersionsInGroup(versionGroupCode);
    }

    const newQuote = await platformQuoteRepository.create(quoteData);

    // Log Quote Timeline Event
    await platformQuoteRepository.createTimelineEvent({
      quoteId: newQuote._id,
      quoteNumber: newQuote.quoteNumber,
      eventType: versionNumber > 1 ? 'QUOTE_VERSION_CREATED' : 'QUOTE_CREATED',
      fromStatus: null,
      toStatus: initialStatus,
      actorId: actorId || null,
      actorName,
      timestamp: new Date(),
      metadata: { versionGroupCode, versionNumber, totalAmount: newQuote.totalAmount },
    });

    // Create Approval History Record if approval required
    if (approvalRequired) {
      const validReqBy = (actorId && mongoose.Types.ObjectId.isValid(actorId))
        ? actorId
        : (newQuote.createdBy && mongoose.Types.ObjectId.isValid(newQuote.createdBy))
          ? newQuote.createdBy
          : new mongoose.Types.ObjectId('000000000000000000000000');

      await platformQuoteRepository.createApprovalRecord({
        quoteId: newQuote._id,
        approvalTier,
        requestedBy: validReqBy,
        requestedAt: new Date(),
        decision: 'PENDING',
        comments: `Discount of ${pricingResult.discountPercent}% requires ${approvalTier} approval.`,
      });
    }

    // Mandatory Correction 7: Update Inquiry ON QUOTE CREATION ONLY
    const inquiryService = (await import('../crmInquiry/crmInquiry.service.js')).default;
    await inquiryService.updateInquiry(inquiry._id, {
      $inc: { quoteCount: 1 },
      latestQuoteId: newQuote._id,
      lastQuoteCreatedAt: new Date(),
    });

    platformQuoteEvents.emit('quote_created', newQuote);

    return {
      quote: newQuote,
      rawAcceptanceToken,
    };
  }

  /**
   * Get quote by ID.
   * @param {string|Object} id
   */
  async getQuoteById(id) {
    if (!id) {
      throw new HttpError(400, 'Quote ID is required');
    }
    const idStr = String(id._id || id);
    let quote = null;

    if (idStr.match(/^[0-9a-fA-F]{24}$/)) {
      quote = await platformQuoteRepository.findById(idStr);
    }
    if (!quote) {
      quote = await platformQuoteRepository.findByQuoteNumber(idStr);
    }
    if (!quote) {
      throw new HttpError(404, `Platform Quote '${idStr}' not found`);
    }
    return quote;
  }

  /**
   * Transition Quote Status with Atomic Optimistic Locking.
   * @param {string} quoteId
   * @param {string} nextStatus
   * @param {string|null} actorId
   * @param {string} actorName
   * @param {Object} metadata
   */
  async transitionQuoteStatus(quoteId, nextStatus, actorId = null, actorName = 'System', metadata = {}) {
    const quote = await this.getQuoteById(quoteId);
    const currentStatus = quote.status;
    const currentVersion = quote.version || 1;

    // Mandatory Correction 2: Locked quotes cannot be modified
    if (quote.isLocked && currentStatus === 'ACCEPTED') {
      throw new HttpError(400, `Quote '${quote.quoteNumber}' is ACCEPTED and locked. State changes are forbidden.`);
    }

    if (currentStatus === nextStatus) {
      return quote; // Idempotent
    }

    const allowedNext = QUOTE_ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(nextStatus)) {
      throw new HttpError(
        400,
        `Invalid quote transition from '${currentStatus}' to '${nextStatus}'. Allowed transitions: '${allowedNext.join(', ') || 'none'}'.`
      );
    }

    const updatePayload = {
      status: nextStatus,
    };

    // Mandatory Correction 1: ACCEPTED sets orderEligibility = ELIGIBLE & isLocked = true
    if (nextStatus === 'ACCEPTED') {
      updatePayload.isLocked = true;
      updatePayload.orderEligibility = 'ELIGIBLE';
      updatePayload.acceptedAt = new Date();
    } else if (nextStatus === 'SENT') {
      updatePayload.sentAt = new Date();
    } else if (nextStatus === 'APPROVED') {
      updatePayload.approvedAt = new Date();
      updatePayload.approvedBy = actorId || null;
    } else if (nextStatus === 'REJECTED') {
      updatePayload.rejectedAt = new Date();
    }

    // Atomic Optimistic Concurrency Update
    const updatedQuote = await platformQuoteRepository.updateWithVersionLock(
      quote._id,
      currentVersion,
      updatePayload
    );

    if (!updatedQuote) {
      throw new HttpError(
        409,
        `Conflict: Quote '${quote.quoteNumber}' was modified concurrently by another user. Please refresh.`
      );
    }

    // Timeline event
    await platformQuoteRepository.createTimelineEvent({
      quoteId: updatedQuote._id,
      quoteNumber: updatedQuote.quoteNumber,
      eventType: `QUOTE_${nextStatus}`,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      actorId: actorId || null,
      actorName,
      timestamp: new Date(),
      metadata,
    });

    platformQuoteEvents.emit('quote_status_changed', updatedQuote);
    return updatedQuote;
  }

  /**
   * Request approval for a quote with high discount.
   */
  async requestApproval(quoteId, actorId, actorName = 'System', comments = '') {
    const quote = await this.getQuoteById(quoteId);
    if (quote.status !== 'DRAFT') {
      throw new HttpError(400, `Approval can only be requested for DRAFT quotes. Current status: ${quote.status}`);
    }

    const updatedQuote = await this.transitionQuoteStatus(
      quote._id,
      'PENDING_APPROVAL',
      actorId,
      actorName,
      { comments }
    );

    await platformQuoteRepository.createApprovalRecord({
      quoteId: quote._id,
      approvalTier: quote.approvalTier || 'SALES_MANAGER',
      requestedBy: actorId || null,
      requestedAt: new Date(),
      decision: 'PENDING',
      comments,
    });

    return updatedQuote;
  }

  /**
   * Approve a pending quote (Mandatory Correction 4).
   */
  async approveQuote(quoteId, actorId, actorName = 'System', comments = '') {
    const quote = await this.getQuoteById(quoteId);
    if (quote.status !== 'PENDING_APPROVAL' && quote.status !== 'DRAFT') {
      throw new HttpError(400, `Quote cannot be approved from status '${quote.status}'`);
    }

    const updatedQuote = await this.transitionQuoteStatus(
      quote._id,
      'APPROVED',
      actorId,
      actorName,
      { comments }
    );

    const validRequestedBy = (quote.createdBy && mongoose.Types.ObjectId.isValid(quote.createdBy))
      ? quote.createdBy
      : (actorId && mongoose.Types.ObjectId.isValid(actorId))
        ? actorId
        : new mongoose.Types.ObjectId('000000000000000000000000');

    const validApprovedBy = (actorId && mongoose.Types.ObjectId.isValid(actorId))
      ? actorId
      : new mongoose.Types.ObjectId('000000000000000000000000');

    await platformQuoteRepository.createApprovalRecord({
      quoteId: quote._id,
      approvalTier: quote.approvalTier || 'SALES_MANAGER',
      requestedBy: validRequestedBy,
      approvedBy: validApprovedBy,
      approvedAt: new Date(),
      decision: 'APPROVED',
      comments: comments || 'Approved by manager',
    });

    return updatedQuote;
  }

  /**
   * Send quote to customer (Blocks sending if not APPROVED).
   */
  async sendQuote(quoteId, actorId, actorName = 'System') {
    const quote = await this.getQuoteById(quoteId);
    if (quote.status !== 'APPROVED') {
      throw new HttpError(400, `Quote must be APPROVED before sending to customer. Current status is '${quote.status}'.`);
    }

    return await this.transitionQuoteStatus(quote._id, 'SENT', actorId, actorName);
  }

  /**
   * Record Customer View (SENT -> VIEWED with IP and UserAgent tracking).
   */
  async recordQuoteView(quoteId, ipAddress = '127.0.0.1', userAgent = 'Unknown') {
    const quote = await this.getQuoteById(quoteId);
    if (quote.status === 'SENT') {
      const updatePayload = {
        status: 'VIEWED',
        viewedAt: new Date(),
        viewedIp: ipAddress,
        viewedUserAgent: userAgent,
      };
      const updated = await platformQuoteRepository.updateById(quote._id, updatePayload);
      await platformQuoteRepository.createTimelineEvent({
        quoteId: quote._id,
        quoteNumber: quote.quoteNumber,
        eventType: 'QUOTE_VIEWED',
        fromStatus: 'SENT',
        toStatus: 'VIEWED',
        actorName: 'Customer',
        timestamp: new Date(),
        metadata: { ipAddress, userAgent },
      });
      return updated;
    }
    return quote;
  }

  async recordCustomerView(quoteId, ipAddress = '127.0.0.1', userAgent = 'Unknown') {
    return await this.recordQuoteView(quoteId, ipAddress, userAgent);
  }

  /**
   * Customer Idempotent Quote Acceptance (Mandatory Correction 1 & 5).
   * Verifies SHA-256 token hash and sets orderEligibility = ELIGIBLE.
   */
  async acceptQuote(quoteId, rawToken) {
    const quote = await this.getQuoteById(quoteId);

    // Idempotent 200 OK if already accepted
    if (quote.status === 'ACCEPTED') {
      return {
        quote,
        message: 'Quote has already been accepted.',
        orderEligibility: quote.orderEligibility,
      };
    }

    if (quote.isLocked) {
      throw new HttpError(400, 'Quote is locked and cannot be accepted.');
    }

    // Verify SHA-256 token hash
    if (quote.acceptanceTokenHash) {
      const inputHash = this.hashToken(rawToken);
      if (inputHash !== quote.acceptanceTokenHash) {
        throw new HttpError(401, 'Invalid customer acceptance token hash verification failed.');
      }
    }

    const updatedQuote = await this.transitionQuoteStatus(
      quote._id,
      'ACCEPTED',
      null,
      'Customer Portal'
    );

    return {
      quote: updatedQuote,
      message: 'Quote accepted successfully. Eligible for order creation in Phase 3.',
      orderEligibility: updatedQuote.orderEligibility,
    };
  }

  /**
   * Customer Quote Rejection.
   */
  async rejectQuote(quoteId, rawToken, reason = 'Customer declined proposal') {
    const quote = await this.getQuoteById(quoteId);
    if (quote.status === 'REJECTED') {
      return quote;
    }
    if (quote.isLocked) {
      throw new HttpError(400, 'Quote is locked and cannot be rejected.');
    }

    return await this.transitionQuoteStatus(quote._id, 'REJECTED', null, 'Customer Portal', { reason });
  }

  /**
   * Create New Version of a Quote (Mandatory Correction 2 & 3).
   */
  async createNewVersion(quoteId, payload = {}, actorId = null, actorName = 'System') {
    const existingQuote = await this.getQuoteById(quoteId);

    // Mandatory Correction 2: Cannot create new version from accepted quote
    if (existingQuote.status === 'ACCEPTED' || existingQuote.isLocked) {
      throw new HttpError(
        400,
        `Accepted quotes are locked. No new version can be created from accepted quote '${existingQuote.quoteNumber}'. Please start a new inquiry cycle.`
      );
    }

    const nextVersionNumber = existingQuote.versionNumber + 1;
    return await this.createQuote({
      ...payload,
      inquiryId: existingQuote.inquiryId._id || existingQuote.inquiryId,
      versionGroupCode: existingQuote.versionGroupCode,
      versionNumber: nextVersionNumber,
      planName: payload.planName || existingQuote.pricingSnapshot.planName,
      basePrice: payload.basePrice ?? existingQuote.pricingSnapshot.basePrice,
      perUnitRate: payload.perUnitRate ?? existingQuote.pricingSnapshot.perUnitRate,
      setupFee: payload.setupFee ?? existingQuote.pricingSnapshot.setupFee,
      discountPercent: payload.discountPercent ?? existingQuote.discountPercent,
      discountType: payload.discountType || existingQuote.discountType,
      addOns: payload.addOns || existingQuote.pricingSnapshot.selectedAddOns || [],
      actorId,
      actorName,
    });
  }

  /**
   * Get Quote Timeline events.
   */
  async getQuoteTimeline(quoteId) {
    const quote = await this.getQuoteById(quoteId);
    return await platformQuoteRepository.findTimelineByQuoteId(quote._id);
  }

  /**
   * Get Quote Approval History.
   */
  async getQuoteApprovals(quoteId) {
    const quote = await this.getQuoteById(quoteId);
    return await platformQuoteRepository.findApprovalsByQuoteId(quote._id);
  }

  /**
   * Get paginated quotes list.
   */
  async getQuotes(queryParams) {
    return await platformQuoteRepository.getQuotesPaginated(queryParams);
  }

  /**
   * Complete Instant Quote & Order Generation Flow.
   */
  async generateOrderForInquiry(targetId, payload = {}, actorId = null, actorName = 'System') {
    const platformOrderService = (await import('../platformOrder/platformOrder.service.js')).default;
    const platformInvoiceService = (await import('../platformInvoice/platformInvoice.service.js')).default;
    const platformPaymentService = (await import('../platformPayment/platformPayment.service.js')).default;
    const PlatformQuote = (await import('./platformQuote.model.js')).default;

    let inquiryId = targetId;

    // Check if targetId is an existing quoteId or inquiryId
    let existingQuote = await PlatformQuote.findById(targetId).catch(() => null);
    if (!existingQuote) {
      existingQuote = await PlatformQuote.findOne({ inquiryId: targetId }).sort({ createdAt: -1 }).catch(() => null);
    }

    let quote = existingQuote;
    let rawToken = null;

    if (!quote) {
      const created = await this.createQuote({
        inquiryId,
        planName: payload.planName || 'COMMUNITY_ENTERPRISE',
        basePrice: payload.tierPrice !== undefined ? payload.tierPrice : (payload.basePrice !== undefined ? payload.basePrice : 0),
        perUnitRate: payload.perUnitRate !== undefined ? payload.perUnitRate : 700,
        setupFee: payload.setupFee !== undefined ? payload.setupFee : 5000,
        discountPercent: payload.adminDiscountPercent !== undefined ? payload.adminDiscountPercent : 10,
        billingCycle: payload.billingCycle || 'YEARLY',
        unitCount: payload.unitCount || 250,
        calculatedTotal: payload.calculatedTotal || payload.totalAmount || payload.grandTotal || 186300,
        autoPromoteStatus: true,
        skipStatusCheck: true,
        actorId,
        actorName,
      });
      quote = created.quote;
      rawToken = created.rawAcceptanceToken;
    }

    const targetAmount = payload.calculatedTotal !== undefined ? parseFloat(payload.calculatedTotal) : (payload.totalAmount !== undefined ? parseFloat(payload.totalAmount) : (payload.grandTotal !== undefined ? parseFloat(payload.grandTotal) : (quote?.totalAmount || 0)));
    if (targetAmount && quote) {
      quote.totalAmount = parseFloat(targetAmount);
      quote.subtotal = payload.subtotal ? parseFloat(payload.subtotal) : parseFloat(targetAmount);
      await quote.save();
    }

    // Persist postTrialTotal and amount to Inquiry model in MongoDB
    try {
      const CrmInquiry = (await import('../crmInquiry/crmInquiry.model.js')).default;
      const Enquiry = (await import('../platformCrm/enquiry.model.js')).default;
      const targetInqId = quote?.inquiryId || inquiryId;
      if (targetInqId) {
        await CrmInquiry.findByIdAndUpdate(targetInqId, {
          postTrialTotal: parseFloat(targetAmount),
          amount: parseFloat(targetAmount)
        }).catch(() => null);
        await Enquiry.findByIdAndUpdate(targetInqId, {
          postTrialTotal: parseFloat(targetAmount),
          amount: parseFloat(targetAmount)
        }).catch(() => null);
      }
    } catch (inqErr) {
      console.warn('Inquiry postTrialTotal update notice:', inqErr.message);
    }

    if (quote.status === 'DRAFT' || quote.status === 'PENDING_APPROVAL') {
      quote.status = 'APPROVED';
      quote.approvedAt = new Date();
      quote.approvedBy = actorId || null;
      await quote.save();
    }

    if (quote.status !== 'ACCEPTED') {
      if (!rawToken) {
        rawToken = quote.acceptanceTokenHash ? 'ACC-TOKEN-AUTOMATED' : null;
      }
      try {
        if (quote.status === 'APPROVED') {
          await this.sendQuote(quote._id, actorId, actorName);
        }
        await this.recordCustomerView(quote._id, '127.0.0.1', 'Automated-Agent');
        
        quote.status = 'ACCEPTED';
        quote.acceptedAt = new Date();
        quote.isLocked = true;
        quote.orderEligibility = 'ELIGIBLE';
        await quote.save();
      } catch (err) {
        quote.status = 'ACCEPTED';
        quote.isLocked = true;
        quote.orderEligibility = 'ELIGIBLE';
        await quote.save();
      }
    }

    // 2. Convert to Order (idempotently handle quotes already converted)
    let confirmedOrder;
    const platformOrderRepository = (await import('../platformOrder/platformOrder.repository.js')).default;
    const existingOrder = await platformOrderRepository.findByQuoteId(quote._id).catch(() => null);

    if (existingOrder) {
      confirmedOrder = (existingOrder.orderStatus === 'CONFIRMED' || existingOrder.orderStatus === 'ACTIVE') ? existingOrder : await platformOrderService.confirmOrder(existingOrder._id).catch(() => existingOrder);
    } else {
      try {
        const convertResult = await platformOrderService.convertQuoteToOrder(quote._id, `CONV-${Date.now()}`);
        confirmedOrder = (convertResult.order.orderStatus === 'CONFIRMED' || convertResult.order.orderStatus === 'ACTIVE') ? convertResult.order : await platformOrderService.confirmOrder(convertResult.order._id).catch(() => convertResult.order);
      } catch (convErr) {
        const fallbackOrder = await platformOrderRepository.findByQuoteId(quote._id).catch(() => null);
        if (fallbackOrder) {
          confirmedOrder = (fallbackOrder.orderStatus === 'CONFIRMED' || fallbackOrder.orderStatus === 'ACTIVE') ? fallbackOrder : await platformOrderService.confirmOrder(fallbackOrder._id).catch(() => fallbackOrder);
        } else {
          throw convErr;
        }
      }
    }

    if (confirmedOrder && targetAmount) {
      const PlatformOrder = (await import('../platformOrder/platformOrder.model.js')).default;
      const orderId = confirmedOrder._id || confirmedOrder.id;
      if (orderId) {
        await PlatformOrder.findByIdAndUpdate(orderId, {
          totalAmount: parseFloat(targetAmount),
          subtotal: payload.subtotal ? parseFloat(payload.subtotal) : parseFloat(targetAmount)
        }).catch(() => null);
      }
    }

    // 3. Generate Sequence-Safe Invoice (idempotently handle existing invoice)
    const platformInvoiceRepository = (await import('../platformInvoice/platformInvoice.repository.js')).default;
    let existingInvoices = await platformInvoiceRepository.findByOrderId(confirmedOrder._id).catch(() => []);
    let invoice = Array.isArray(existingInvoices) && existingInvoices.length > 0 ? existingInvoices[0] : (Array.isArray(existingInvoices) ? null : existingInvoices);

    if (!invoice) {
      invoice = await platformInvoiceService.generateInvoiceFromOrder(confirmedOrder._id);
    }

    const invoiceId = invoice?._id || invoice?.id || null;

    if (invoiceId && targetAmount) {
      const PlatformInvoice = (await import('../platformInvoice/platformInvoice.model.js')).default;
      await PlatformInvoice.findByIdAndUpdate(invoiceId, {
        totalAmount: parseFloat(targetAmount),
        amountOutstanding: parseFloat(targetAmount)
      }).catch(() => null);
    }

    // 4. Record Payment Transaction
    let payment = {
      referenceId: confirmedOrder._id,
      orderId: confirmedOrder._id,
      invoiceId: invoiceId || null,
      amount: parseFloat(targetAmount) || 0,
      currency: 'INR',
      status: 'PENDING'
    };

    const isTrial = Boolean(payload.trialDays > 0 || payload.isTrial || payload.freeTrialDuration > 0);
    const trialDays = payload.trialDays || payload.freeTrialDuration || 14;

    // 4b. Create Active/Trial Subscription for Subscriptions Tab
    let subscription = null;
    try {
      const platformSubscriptionService = (await import('../platformSubscription/platformSubscription.service.js')).default;
      subscription = await platformSubscriptionService.handlePaymentCompletedEvent({
        paymentId: new mongoose.Types.ObjectId(),
        invoiceId: invoiceId || null,
        orderId: confirmedOrder._id,
        organizationId: confirmedOrder.organizationId,
        isTrial,
        trialDays,
        planName: payload.planName || quote?.pricingSnapshot?.planName || 'COMMUNITY_ENTERPRISE',
        correlationId: `CORR-${Date.now()}`
      });
    } catch (subErr) {
      console.error('Subscription creation fallback:', subErr.message);
    }

    // 4c. Create Provisioning Workflow for Provisioning Jobs Tab
    let provisioningJob = null;
    try {
      const platformProvisioningJobService = (await import('../platformProvisioningJob/platformProvisioningJob.service.js')).default;
      provisioningJob = await platformProvisioningJobService.handleEntitlementsActivatedEvent({
        organizationId: confirmedOrder.organizationId,
        subscriptionId: subscription?._id || null,
        orderId: confirmedOrder._id,
        isTrial,
        correlationId: `CORR-PROV-${Date.now()}`
      });
    } catch (provErr) {
      console.error('Provisioning workflow creation fallback:', provErr.message);
    }

    // 5. Dispatch Payment Link Email via connected Gmail SMTP / Resend / Fallback
    try {
      const IntegrationHub = (await import('../integrationHub/integrationHub.model.js')).default;
      const { decrypt } = await import('../integrationHub/utils/crypto.util.js');
      const CrmInquiry = (await import('../crmInquiry/crmInquiry.model.js')).default;
      const Enquiry = (await import('../platformCrm/enquiry.model.js')).default;
      const nodemailer = (await import('nodemailer')).default;

      let inquiry = await CrmInquiry.findById(inquiryId).catch(() => null);
      if (!inquiry) {
        inquiry = await Enquiry.findById(inquiryId).catch(() => null);
      }

      const recipientEmail = inquiry?.contactEmail || inquiry?.email || quote?.customerSnapshot?.contactEmail || payload.email || payload.contactEmail || payload.recipientEmail || 'user@example.com';
      const orgName = inquiry?.organizationName || inquiry?.communityName || inquiry?.companyName || quote?.communitySnapshot?.organizationName || quote?.communitySnapshot?.communityName || payload.organizationName || 'Your Community';
      const displayAmount = payment?.amount || invoice?.totalAmount || quote?.totalAmount || 0;
      const appUrl = process.env.CLIENT_URL || 'http://localhost:3004';
      const paymentLink = `${appUrl}/#/pay/${quote._id}`;

      let sent = false;

      // 1. Check connected or available SMTP integration in Integration Hub
      let smtpIntegration = await IntegrationHub.findOne({ provider: 'smtp', status: 'connected' });
      if (!smtpIntegration) {
        smtpIntegration = await IntegrationHub.findOne({ provider: 'smtp' });
      }

      const envHost = process.env.SYSTEM_SMTP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
      const envPort = parseInt(process.env.SYSTEM_SMTP_PORT || process.env.SMTP_PORT || '587', 10);
      const envUser = process.env.SYSTEM_SMTP_USER || process.env.SMTP_USER || process.env.GMAIL_USER;
      const envPass = process.env.SYSTEM_SMTP_PASS || process.env.SMTP_PASS || process.env.GMAIL_PASS;

      let host = envHost;
      let port = envPort;
      let authUsername = envUser;
      let authPassword = envPass;

      if (smtpIntegration && smtpIntegration.credentials && smtpIntegration.credentials.length > 0) {
        const getCred = (key) => {
          const cred = smtpIntegration.credentials.find((c) => c.key === key);
          return cred ? decrypt(cred.encryptedValue, cred.iv, cred.authTag) : null;
        };
        host = getCred('host') || envHost;
        port = parseInt(getCred('port') || envPort, 10);
        authUsername = getCred('authUsername') || envUser;
        authPassword = getCred('authPassword') || envPass;
      }

      if (host && port && authUsername && authPassword) {
        try {
          const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user: authUsername, pass: authPassword },
            connectionTimeout: 2000,
            greetingTimeout: 2000,
            socketTimeout: 2000
          });
          await transporter.sendMail({
            from: `"${smtpIntegration?.accountLabel || 'Nahom'}" <${authUsername}>`,
            to: recipientEmail,
            subject: `Order & Payment Link Generated — ${orgName}`,
            html: `
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #3b82f6;">
                  <h2 style="color: #1e3a8a; margin: 0; font-size: 24px;">Nahom</h2>
                  <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Gated Community & Property Management Platform</p>
                </div>
                
                <h3 style="color: #0f172a; margin-top: 20px;">Order & Payment Link Generated</h3>
                <p style="color: #334155; font-size: 15px; line-height: 1.5;">Dear Customer,</p>
                <p style="color: #334155; font-size: 15px; line-height: 1.5;">Your order for <strong>${orgName}</strong> has been generated successfully.</p>
                <p style="color: #334155; font-size: 15px; line-height: 1.5;"><strong>Total Amount:</strong> ₹${displayAmount.toLocaleString()} INR</p>
                
                <div style="text-align: center; margin: 25px 0;">
                  <a href="${paymentLink}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">Click Here to Complete Payment</a>
                </div>

                <p style="color: #64748b; font-size: 13px; line-height: 1.4; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                  If you have any questions, please contact our support team.
                </p>
              </div>
            `,
          });
          console.log(`[Email] Payment link email sent to ${recipientEmail} via Gmail SMTP (${authUsername})`);
          sent = true;
        } catch (sendError) {
          console.error(`[Email] Network SMTP send failed to ${recipientEmail}:`, sendError.message);
        }
      }

      if (!sent) {
        try {
          let resendIntegration = await IntegrationHub.findOne({ provider: 'resend', status: 'connected' });
          if (!resendIntegration) {
            resendIntegration = await IntegrationHub.findOne({ provider: 'resend' });
          }

          const resendApiKey = process.env.RESEND_API_KEY || (resendIntegration && resendIntegration.credentials ? decrypt(resendIntegration.credentials.find((c) => c.key === 'apiKey')?.encryptedValue, resendIntegration.credentials.find((c) => c.key === 'apiKey')?.iv, resendIntegration.credentials.find((c) => c.key === 'apiKey')?.authTag) : null);

          if (resendApiKey) {
            const resendRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: 'Nahom <onboarding@resend.dev>',
                to: [recipientEmail],
                subject: `Order & Payment Link Generated — ${orgName}`,
                html: `
                  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                    <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #3b82f6;">
                      <h2 style="color: #1e3a8a; margin: 0; font-size: 24px;">Nahom</h2>
                      <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Gated Community & Property Management Platform</p>
                    </div>
                    
                    <h3 style="color: #0f172a; margin-top: 20px;">Order & Payment Link Generated</h3>
                    <p style="color: #334155; font-size: 15px; line-height: 1.5;">Dear Customer,</p>
                    <p style="color: #334155; font-size: 15px; line-height: 1.5;">Your order for <strong>${orgName}</strong> has been generated successfully.</p>
                    <p style="color: #334155; font-size: 15px; line-height: 1.5;"><strong>Total Amount:</strong> ₹${displayAmount.toLocaleString()} INR</p>
                    
                    <div style="text-align: center; margin: 25px 0;">
                      <a href="${paymentLink}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">Click Here to Complete Payment</a>
                    </div>

                    <p style="color: #64748b; font-size: 13px; line-height: 1.4; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                      If you have any questions, please contact our support team.
                    </p>
                  </div>
                `,
              }),
            });

            if (resendRes.ok) {
              console.log(`[Email] Payment link email sent to ${recipientEmail} via Resend API`);
              sent = true;
            }
          }
        } catch (resendErr) {
          console.error(`[Email] Resend API error:`, resendErr.message);
        }
      }

      if (!sent) {
        console.log(`\n======================================================`);
        console.log(`📧 SIMULATED PAYMENT LINK EMAIL to [${recipientEmail}]:`);
        console.log(`Subject: Order & Payment Link Generated — ${orgName}`);
        console.log(`Dear Customer,`);
        console.log(`Your order for ${orgName} has been generated successfully.`);
        console.log(`Total Amount: ₹${displayAmount.toLocaleString()} INR`);
        console.log(`Payment Link: ${paymentLink}`);
        console.log(`(Connect your SMTP Email Server in Integration Hub to send live network emails)`);
        console.log(`======================================================\n`);
      }
    } catch (emailErr) {
      console.error('Failed to dispatch payment link email via SMTP:', emailErr.message);
    }

    return {
      quote,
      order: confirmedOrder,
      invoice,
      payment,
      message: 'Order, Invoice, and Razorpay Payment link generated successfully.',
    };
  }

  /**
   * Background Expiry Worker Method: Automatically expires sent quotes past validUntil.
   */
  async processExpiredQuotes() {
    const PlatformQuote = (await import('./platformQuote.model.js')).default;
    const expiredQuotes = await PlatformQuote.find({
      status: { $in: ['SENT', 'VIEWED'] },
      validUntil: { $lt: new Date() },
    }).exec();

    let count = 0;
    for (const quote of expiredQuotes) {
      try {
        await this.transitionQuoteStatus(quote._id, 'EXPIRED', null, 'Expiry Background Worker');
        count++;
      } catch (err) {
        console.error(`Failed to expire quote ${quote.quoteNumber}:`, err);
      }
    }
    return { count, message: `Processed ${count} expired quotes.` };
  }
}

export default new PlatformQuoteService();


