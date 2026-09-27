import mongoose from 'mongoose';
import invoiceRepository from './invoice.repository.js';
import villaService from '../villa/villa.services.js';
import userService from '../user/user.services.js';
import roleService from '../role/role.services.js';
import invoiceEventEmitter, { INVOICE_GENERATED, INVOICE_STATUS_UPDATED, SEND_WHATSAPP_LINK } from './invoice.events.js';
import Invoice from './invoice.model.js';
import HttpError from '../../utils/httpError.utils.js';
import logger, { loggerStorage } from '../../utils/logger.utils.js';
import paymentService from '../payment/payment.service.js';
import notificationService from '../notification/notification.service.js';
import { paymentEventEmitter, PAYMENT_SUCCESS } from '../payment/payment.events.js';

export class InvoiceService {
  /**
   * Generates batch invoices for a given assessment template.
   */
  async generateBatchInvoices(assessment) {
    const correlationId = loggerStorage.getStore() || 'N/A';
    logger.info('generateBatchInvoices service called', { assessmentId: assessment._id, correlationId });

    // 1. Fetch targeted units (Villas) based on scope
    let units = [];
    const scopeType = assessment.targetScope?.type || 'ALL_COMMUNITY';
    const scopeIds = assessment.targetScope?.scopeIds || [];

    if (scopeType === 'ALL_COMMUNITY') {
      units = await villaService.getUnitsByOrgId(assessment.communityId);
    } else if (scopeType === 'SPECIFIC_UNITS') {
      units = await villaService.getUnitsByVillaIds(scopeIds);
    } else if (scopeType === 'SPECIFIC_USERS') {
      units = await villaService.getUnitsByResidentUserIds(scopeIds);
    } else if (scopeType === 'VILLA_BLOCK') {
      units = await villaService.getUnitsByBlockNames(scopeIds, assessment.communityId);
    } else if (scopeType === 'UNIT_TYPE') {
      units = await villaService.getUnitsByTypes(scopeIds, assessment.communityId);
    } else if (scopeIds.length > 0) {
      units = await villaService.getUnitsByVillaIds(scopeIds);
    }

    logger.info(`Found ${units.length} candidate units matching assessment scope`);

    // 2. Fetch targeted dynamic roles (to compare user's role lists)
    const targetRoles = await roleService.getRolesByIds(assessment.targetScope.targetRoleIds || []);
    const targetRoleNames = targetRoles.map((r) => r.name.toLowerCase());

    // 2.5 Fetch Organization Billing Settings for Carry Forward isolation
    const Organization = (await import('../organization/organization.model.js')).default;
    const org = await Organization.findById(assessment.communityId).select('billingSettings').lean();
    const combineOutstanding = org?.billingSettings?.combineOutstandingInvoices || false;

    const invoicesToCreate = [];

    // Calculate billing period string (e.g. YYYY-MM, YYYY-Wxx, or YYYY-Qx)
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    
    let defaultPeriodString = assessment.billingPeriodString;
    if (!defaultPeriodString) {
      if (assessment.billingCycle === 'WEEKLY') {
        // Calculate standard ISO week string (e.g. 2026-W36)
        const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const dayNr = (target.getUTCDay() + 6) % 7;
        target.setUTCDate(target.getUTCDate() - dayNr + 3);
        const firstThursday = target.valueOf();
        target.setUTCMonth(0, 1);
        if (target.getUTCDay() !== 4) {
          target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
        }
        const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
        const weekYear = new Date(firstThursday).getUTCFullYear();
        defaultPeriodString = `${weekYear}-W${String(weekNum).padStart(2, '0')}`;
      } else {
        defaultPeriodString = `${year}-${month}`;
      }
    }

    for (const unit of units) {
      // Find tenant and owner resident assignments
      const tenantResident = (unit.residents || []).find((r) => r.residencyType === 'Tenant');
      const ownerResident = (unit.residents || []).find((r) =>
        ['Resident Owner', 'Non-Resident Owner'].includes(r.residencyType)
      ) || { userId: unit.primaryResidentId };

      let targetUserId = null;
      
      // Occupancy Fallback Logic
      const targetsTenant = targetRoleNames.some(name => name.includes('tenant'));
      if (targetsTenant && tenantResident && tenantResident.userId) {
        targetUserId = tenantResident.userId;
      } else if (ownerResident && ownerResident.userId) {
        targetUserId = ownerResident.userId;
      }

      if (!targetUserId) {
        logger.warn(`Skipping unit ${unit.unitNumber} - No target resident user found.`);
        continue;
      }

      // Calculate totalDue based on calculationMethod
      let baseAmount = 0;
      const calc = assessment.calculationMethod;
      if (calc.type === 'FLAT_RATE') {
        baseAmount = calc.flatAmount || 0;
      } else if (calc.type === 'PER_SQ_FT') {
        baseAmount = (calc.ratePerSqFt || 0) * (unit.floorAreaSqFt || 0);
      } else if (calc.type === 'TIERED_BHK') {
        const uType = (unit.type || '').toLowerCase().trim();
        const tr = calc.tieredRates || {};
        if (['studio'].includes(uType)) {
          baseAmount = Number(tr.studio) || 0;
        } else if (['bhk1', '1bhk', '1bha', '1-bhk', '1 bhk'].includes(uType)) {
          baseAmount = Number(tr.bhk1) || 0;
        } else if (['bhk2', '2bhk', '2bha', '2-bhk', '2 bhk', 'apartment'].includes(uType)) {
          baseAmount = Number(tr.bhk2) || 0;
        } else if (['bhk3', '3bhk', '3bha', '3-bhk', '3 bhk'].includes(uType)) {
          baseAmount = Number(tr.bhk3) || 0;
        } else if (['bhk4', '4bhk', '4bha', '4-bhk', '4 bhk', 'villa'].includes(uType)) {
          baseAmount = Number(tr.bhk4) || 0;
        } else if (['penthouse'].includes(uType)) {
          baseAmount = Number(tr.penthouse) || 0;
        } else if (['duplex'].includes(uType)) {
          baseAmount = Number(tr.duplex) || 0;
        } else {
          baseAmount = Number(tr.bhk2) || 0; // fallback standard
        }
      }

      baseAmount = Math.round(baseAmount * 100) / 100;
      const taxAmount = 0; // simple snapshot tax
      
      // -- NEW CARRY FORWARD LOGIC (Assessment-Specific vs Global) --
      let previousOutstanding = 0;
      const carryForwardHistory = [];
      try {
        const query = {
          targetUserId: targetUserId,
          status: { $in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
          isDeleted: false,
          carryForwardEnabled: true
        };
        
        // Isolate carry forward by assessment unless combineOutstandingInvoices is true
        if (!combineOutstanding) {
          query.assessmentId = assessment._id;
        }

        const eligibleInvoices = await Invoice.find(query);
        
        for (const prevInv of eligibleInvoices) {
           previousOutstanding += prevInv.outstandingAmount;
           carryForwardHistory.push({
             invoiceId: prevInv._id,
             invoiceNumber: prevInv.invoiceNumber,
             amount: prevInv.outstandingAmount,
             billingPeriodString: prevInv.billingPeriodString,
             generatedDate: prevInv.createdAt
           });
        }
      } catch (err) {
        logger.warn(`Failed to fetch carry forward history for user ${targetUserId}`);
      }

      const totalAmount = Math.round((baseAmount + previousOutstanding + taxAmount) * 100) / 100;

      if (totalAmount <= 0) {
        logger.warn(`Skipping unit ${unit.unitNumber} - Total amount is ₹0 (Calculation type: ${calc.type}, Unit type: ${unit.type}).`);
        continue;
      }

      // Set dueDate to +10 days by default
      const dueDate = new Date();
      dueDate.setUTCDate(dueDate.getUTCDate() + 10);

      // Create snapshot object for invoice immutability
      const snapshot = {
        assessmentName: assessment.name,
        assessmentType: assessment.type,
        calculationMethod: assessment.calculationMethod,
        unitDetails: {
          unitId: unit._id,
          unitNumber: unit.unitNumber,
          type: unit.type,
          floorAreaSqFt: unit.floorAreaSqFt
        },
        residentDetails: {
          targetUserId,
          roles: targetRoleNames
        },
        billingConfiguration: org?.billingSettings || {}
      };

      invoicesToCreate.push({
        communityId: assessment.communityId,
        orgId: assessment.communityId,
        assessmentId: assessment._id,
        targetUserId,
        unitId: unit._id,
        billingPeriodString: defaultPeriodString,
        
        // Enterprise Fields
        snapshot,
        currentCharge: baseAmount,
        previousOutstanding,
        carryForwardHistory,
        subtotal: baseAmount + previousOutstanding,
        taxAmount,
        totalAmount,
        paidAmount: 0,
        outstandingAmount: totalAmount,
        dueDate,
        status: 'UNPAID',
        
        // Audit Trail Initial Event
        auditHistory: [{
          action: 'INVOICE_GENERATED',
          details: `Invoice generated via batch processor for period ${defaultPeriodString}`,
          date: new Date(),
          performedBy: null // System generated
        }],

        // Legacy fallback
        hardcodedAmount: baseAmount,
        totalDue: totalAmount
      });

    }

    let created = 0;
    let duplicatesSkipped = 0;

    // Process one-by-one to support safe duplicate skipping & precise event emission
    for (const invoiceData of invoicesToCreate) {
      try {
        const createdInvoices = await invoiceRepository.createBatch([invoiceData]);
        if (createdInvoices && createdInvoices.length > 0) {
          const insertedInvoice = createdInvoices[0];
          created++;

          // 1. Fetch targeted user
          let targetUser = null;
          try {
            targetUser = await userService.getUserById(insertedInvoice.targetUserId);
          } catch (err) {
            logger.warn(`Failed to fetch target user for invoice ${insertedInvoice._id}`);
          }

          let paymentLink = null;
          if (targetUser) {
            // 2. Generate Razorpay payment link
            paymentLink = await paymentService.createPaymentLink(insertedInvoice, targetUser);

            // 3. Save link to invoice
            if (paymentLink) {
              await Invoice.updateOne({ _id: insertedInvoice._id }, { $set: { paymentLink } });
              insertedInvoice.paymentLink = paymentLink;
            }
          }

          const invoiceObj = insertedInvoice.toObject ? insertedInvoice.toObject() : insertedInvoice;
          invoiceObj.communityId = assessment.communityId;

          // 4. Emit custom event payload
          invoiceEventEmitter.emit(INVOICE_GENERATED, {
            _id: invoiceObj._id,
            invoiceId: invoiceObj._id,
            targetUserId: invoiceObj.targetUserId,
            unitId: invoiceObj.unitId,
            communityId: assessment.communityId,
            billingPeriodString: defaultPeriodString,
            amount: invoiceObj.totalAmount || invoiceObj.totalDue,
            totalDue: invoiceObj.totalAmount || invoiceObj.totalDue,
            targetPhone: targetUser?.contactSettings?.phone || targetUser?.phone || '',
            userName: targetUser?.name || targetUser?.username || 'Resident',
            paymentLink: paymentLink
          });
        }
      } catch (error) {
        if (error instanceof HttpError && error.statusCode === 409) {
          duplicatesSkipped++;
        } else {
          throw error;
        }
      }
    }

    logger.info(`Batch invoice generation completed. Created: ${created}, Skipped: ${duplicatesSkipped}`);

    // Persist last run metadata on the Assessment model if available
    const assessmentId = assessment._id || assessment.id;
    if (assessmentId) {
      try {
        const Assessment = (await import('../assessment/assessment.model.js')).default;
        await Assessment.findByIdAndUpdate(assessmentId, {
          $set: {
            lastRunAt: new Date(),
            lastBilledPeriod: defaultPeriodString,
            lastRunStats: {
              created,
              duplicatesSkipped,
              totalTargeted: invoicesToCreate.length,
            },
          },
        });
      } catch (err) {
        logger.warn(`Failed to update lastRun metadata for assessment ${assessmentId}: ${err.message}`);
      }
    }

    return {
      totalTargeted: invoicesToCreate.length,
      created,
      duplicatesSkipped,
      billingPeriodString: defaultPeriodString,
      lastRunAt: new Date(),
      lastBilledPeriod: defaultPeriodString,
    };
  }

  /**
   * Wrapper for manual trigger controller.
   */
  async triggerManualBilling(payload) {
    const Assessment = (await import('../assessment/assessment.model.js')).default;
    const assessment = await Assessment.findById(payload.assessmentId).lean();
    if (!assessment) throw new HttpError(404, 'Assessment template not found');

    // Merge manual override payload with template
    const mergedAssessment = { ...assessment, ...payload };
    return this.generateBatchInvoices(mergedAssessment);
  }

  /**
   * Resend WhatsApp Links for existing UNPAID invoices of a specific assessment and period.
   */
  async resendWhatsAppLinks(assessmentId, billingPeriodString, orgId) {
    const correlationId = loggerStorage.getStore() || 'N/A';
    logger.info('resendWhatsAppLinks called', { assessmentId, billingPeriodString, correlationId });

    const invoices = await Invoice.find({
      assessmentId,
      billingPeriodString,
      orgId,
      status: 'UNPAID'
    });

    let resentCount = 0;
    for (const invoice of invoices) {
      let targetUser = null;
      try {
        targetUser = await userService.getUserById(invoice.targetUserId);
      } catch (err) {
        logger.warn(`Failed to fetch target user for invoice ${invoice._id}`);
      }

      if (targetUser) {
        let paymentLink = invoice.paymentLink;
        
        // If payment link is missing (e.g. legacy invoice), generate it now
        if (!paymentLink) {
          try {
            paymentLink = await paymentService.createPaymentLink(invoice, targetUser);
            if (paymentLink) {
              await Invoice.updateOne({ _id: invoice._id }, { $set: { paymentLink } });
              invoice.paymentLink = paymentLink;
            }
          } catch (err) {
            logger.error(`Failed to generate missing payment link for invoice ${invoice._id}`, err);
          }
        }

        if (paymentLink) {
          const targetPhone = targetUser?.contactSettings?.phone || targetUser?.phone;
          const userName = targetUser?.name || targetUser?.username || 'Resident';

          if (targetPhone) {
            invoiceEventEmitter.emit(SEND_WHATSAPP_LINK, {
              invoiceId: invoice._id,
              amount: invoice.totalDue,
              targetPhone,
              userName,
              paymentLink: invoice.paymentLink
            });
            resentCount++;
          }
        }
      }
    }

    logger.info(`Resent ${resentCount} WhatsApp links for assessment ${assessmentId}`);
    return { resentCount, totalFound: invoices.length };
  }

  /**
   * Idempotent payment webhook processor.
   */
  async processPaymentConfirmation(webhookData) {
    // legacy method preserved
  }

  /**
   * Webhook settlement logic with OCC and automated refund bugfix.
   */
  async settleInvoiceFromWebhook(invoiceId, paymentDetails) {
    const correlationId = loggerStorage.getStore() || 'N/A';
    logger.info('settleInvoiceFromWebhook triggered', { invoiceId, paymentDetails, correlationId });

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw new HttpError(404, `Invoice with ID ${invoiceId} not found.`);
    }

    const Payment = (await import('../payment/payment.model.js')).default;
    const paymentSettlementService = (await import('../payment/paymentSettlement.service.js')).default;

    // 1. Webhook Idempotency Lock
    if (paymentDetails.paymentId) {
      const existingPayment = await Payment.findOne({ gatewayTransactionId: paymentDetails.paymentId });
      if (existingPayment) {
        if (existingPayment.status === 'success') {
          logger.info('Idempotency lock: Duplicate webhook ignored', { paymentId: paymentDetails.paymentId });
          return { success: true, message: 'Duplicate webhook skipped', invoice };
        }
        // If existingPayment is pending, settle it via paymentSettlementService
        const settlement = await paymentSettlementService.settlePayment({
          paymentId: existingPayment._id,
          gatewayTransactionId: paymentDetails.paymentId,
          gatewayOrderId: paymentDetails.orderId || existingPayment.gatewayOrderId,
          gatewayEventId: paymentDetails.eventId,
          paymentMethod: paymentDetails.method || existingPayment.paymentMethod || 'RAZORPAY',
        });
        const updatedInvoice = await Invoice.findById(invoiceId);
        return { success: true, invoice: updatedInvoice, payment: settlement.payment };
      }
    }

    const amountPaid = paymentDetails.amount || 0;

    // 2. Overpayment Protection
    if (amountPaid > (invoice.outstandingAmount ?? invoice.totalAmount)) {
      logger.error('Overpayment detected, rejecting', { invoiceId, amountPaid, outstanding: invoice.outstandingAmount });
      
      // Attempt automated refund if possible
      if (paymentDetails.paymentId) {
         try {
           paymentService.processRefund(paymentDetails.paymentId).catch(err => {
             logger.error('Failed to issue gateway refund for overpayment:', { error: err.message });
           });
         } catch (err) {}
      }

      throw new HttpError(400, 'Payment amount exceeds outstanding amount. Refund initiated.');
    }

    // 3. Find or Create pending Payment record
    const targetUserId = invoice.targetUserId?._id || invoice.targetUserId;
    const payment = await Payment.create({
      orgId: invoice.communityId || invoice.orgId,
      userId: targetUserId,
      residentId: targetUserId,
      invoiceId: invoice._id,
      villaId: invoice.unitId,
      referenceId: invoice._id,
      referenceType: 'Invoice',
      domain: 'INVOICE',
      amount: amountPaid,
      status: 'pending',
      gateway: 'razorpay',
      gatewayTransactionId: paymentDetails.paymentId,
      gatewayOrderId: paymentDetails.orderId || null,
      paymentMethod: paymentDetails.method || 'RAZORPAY',
      idempotencyKey: paymentDetails.paymentId ? `INV_WEBHOOK:${invoice._id.toString()}:${paymentDetails.paymentId}` : undefined,
    });

    // 4. Settle through canonical PaymentSettlementService (updates invoice, records double-entry ledger, emits events)
    const settlement = await paymentSettlementService.settlePayment({
      paymentId: payment._id,
      gatewayTransactionId: paymentDetails.paymentId,
      gatewayOrderId: paymentDetails.orderId,
      gatewayEventId: paymentDetails.eventId,
      paymentMethod: paymentDetails.method || 'RAZORPAY',
    });

    const updatedInvoice = await Invoice.findById(invoiceId);
    return { success: true, invoice: updatedInvoice, payment: settlement.payment };
  }

  /**
   * Settle invoice payment transactionally with session and OCC support.
   */
  async settleInvoicePayment(invoiceId, paymentData = {}, session = null) {
    const correlationId = loggerStorage.getStore() || 'N/A';
    logger.info('settleInvoicePayment called', { invoiceId, paymentData, correlationId });

    const updated = await invoiceRepository.updateStatusWithLock(
      invoiceId,
      'PAID',
      paymentData,
      session
    );

    invoiceEventEmitter.emit(INVOICE_STATUS_UPDATED, updated);
    return updated;
  }

  /**
   * Settle payment with offline payment request.
   */
  async logOfflinePayment(invoiceId, offlineReference, amount, paymentMethod = 'BANK_TRANSFER', paymentDate = null, paymentScreenshot = null, payerNotes = null) {
    const correlationId = loggerStorage.getStore() || 'N/A';
    logger.info('logOfflinePayment called', { invoiceId, offlineReference, amount, paymentMethod, correlationId });

    const Invoice = (await import('./invoice.model.js')).default;
    const Payment = (await import('../payment/payment.model.js')).default;

    const existingInvoice = await Invoice.findById(invoiceId);
    if (!existingInvoice) {
      throw new Error('Invoice not found');
    }

    if (existingInvoice.status === 'PAID') {
      throw new Error('Invoice is already fully settled.');
    }

    if (existingInvoice.status === 'VERIFICATION_PENDING') {
      throw new Error('An offline payment for this invoice is already pending verification.');
    }

    const effectiveMethod = (paymentMethod || 'BANK_TRANSFER').toUpperCase();
    if (effectiveMethod !== 'CASH' && (!offlineReference || !String(offlineReference).trim())) {
      throw new HttpError(400, `Payment reference number or transaction UTR is required for ${effectiveMethod}.`);
    }

    const prefixMap = {
      CASH: 'CASH',
      CHEQUE: 'CHQ',
      UPI: 'UPI',
      DEMAND_DRAFT: 'DD',
      NEFT: 'NEFT',
      BANK_TRANSFER: 'BANK',
    };
    const prefix = prefixMap[effectiveMethod] || 'OFFLINE';

    const cleanRef = offlineReference ? String(offlineReference).trim() : '';
    const effectiveRef = cleanRef || `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (cleanRef) {
      const duplicateRef = await Payment.findOne({ paymentReference: cleanRef, status: { $ne: 'REJECTED' } });
      if (duplicateRef) {
        throw new Error('This payment reference number has already been submitted.');
      }
    }

    const updatePayload = {
      offlineReference: effectiveRef,
      paymentMethod: effectiveMethod,
    };
    if (amount) {
      updatePayload.offlineAmount = amount;
    }
    if (paymentDate) {
      updatePayload.paymentDate = new Date(paymentDate);
    }
    if (paymentScreenshot) {
      updatePayload.paymentScreenshot = paymentScreenshot;
    }
    if (payerNotes) {
      updatePayload.payerNotes = payerNotes;
    }

    const updated = await invoiceRepository.updateStatusWithLock(
      invoiceId,
      'VERIFICATION_PENDING',
      updatePayload
    );

    const populated = await Invoice.findById(updated._id)
      .populate('targetUserId', 'name username email firstName lastName')
      .populate('unitId', 'unitNumber')
      .lean();

    const result = populated || (updated.toObject ? updated.toObject() : updated);

    // Create a pending Payment record
    try {
      await Payment.create({
        orgId: result.communityId || result.orgId,
        userId: (result.targetUserId && result.targetUserId._id) ? result.targetUserId._id : (result.targetUserId || result.orgId),
        invoiceId: result._id,
        residentId: (result.targetUserId && result.targetUserId._id) ? result.targetUserId._id : (result.targetUserId || result.orgId),
        villaId: (result.unitId && result.unitId._id) ? result.unitId._id : result.unitId,
        referenceId: result._id,
        referenceType: 'Invoice',
        amount: amount || result.totalAmount,
        status: 'VERIFICATION_PENDING',
        paymentCategory: 'OFFLINE',
        paymentMethod: effectiveMethod,
        paymentReference: effectiveRef,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        proofDocument: paymentScreenshot || null,
        payerNotes: payerNotes || null,
        gateway: 'offline',
        gatewayTransactionId: effectiveRef,
      });
    } catch (err) {
      logger.error('Failed to log pending Payment record:', err);
    }

    invoiceEventEmitter.emit('OFFLINE_PAYMENT_SUBMITTED', {
      invoice: result,
      communityId: result.orgId || result.communityId,
      residentName: result.targetUserId ? `${result.targetUserId.firstName || ''} ${result.targetUserId.lastName || result.targetUserId.username || ''}`.trim() : 'Resident',
      reference: effectiveRef,
      paymentMethod: effectiveMethod,
      amount: amount || result.totalAmount,
      payerNotes: payerNotes || null,
      paymentScreenshot: paymentScreenshot || null,
    });

    return result;
  }

  /**
   * Approve/verify offline payment (Cash or Bank Transfer) with Full or Custom amount support (Admin only).
   */
  async approveOfflinePayment(invoiceId, adminUserId = null, options = {}) {
    const correlationId = loggerStorage.getStore() || 'N/A';
    logger.info('approveOfflinePayment called', { invoiceId, adminUserId, options, correlationId });

    const Invoice = (await import('./invoice.model.js')).default;
    const Payment = (await import('../payment/payment.model.js')).default;

    const session = await mongoose.startSession();
    let isTransactionActive = false;
    try {
      session.startTransaction();
      isTransactionActive = true;
    } catch (err) {
      logger.warn('Mongoose transaction not supported in current MongoDB environment; continuing with session:', { error: err.message });
    }
    const activeSession = isTransactionActive ? session : null;

    try {
      const invoiceQuery = Invoice.findById(invoiceId);
      if (activeSession) invoiceQuery.session(activeSession);
      const invoice = await invoiceQuery;

      if (!invoice) {
        throw new HttpError(404, 'Invoice not found');
      }

      if (invoice.status === 'PAID') {
        throw new HttpError(400, 'Invoice is already marked as PAID.');
      }

      const currentTotal = Number(invoice.totalAmount || invoice.totalDue || 0);
      const currentPaid = Number(invoice.paidAmount || 0);
      const remainingDue = invoice.outstandingAmount !== undefined
        ? Number(invoice.outstandingAmount)
        : Math.max(0, currentTotal - currentPaid);

      // Determine amount to apply
      let amountToApply = 0;
      const customAmount = options?.amount !== undefined && options?.amount !== null ? Number(options.amount) : null;
      const settlementType = options?.settlementType || (customAmount ? 'CUSTOM' : 'FULL');

      if (settlementType === 'FULL') {
        amountToApply = remainingDue;
      } else if (customAmount && customAmount > 0) {
        amountToApply = Math.min(customAmount, remainingDue);
      } else if (invoice.offlineAmount && invoice.offlineAmount > 0) {
        amountToApply = Math.min(invoice.offlineAmount, remainingDue);
      } else {
        amountToApply = remainingDue;
      }

      if (amountToApply <= 0) {
        amountToApply = remainingDue;
      }

      const paymentMethod = (options?.paymentMethod || invoice.paymentMethod || 'BANK_TRANSFER').toUpperCase();
      const isCash = paymentMethod === 'CASH';
      const prefixMap = {
        CASH: 'CASH',
        CHEQUE: 'CHQ',
        UPI: 'UPI',
        DEMAND_DRAFT: 'DD',
        NEFT: 'NEFT',
        BANK_TRANSFER: 'BANK',
      };
      const methodPrefix = prefixMap[paymentMethod] || 'OFFLINE';
      const rawProvidedRef = options?.paymentReference || options?.reference || invoice.offlineReference;
      const cleanRef = rawProvidedRef ? String(rawProvidedRef).trim() : '';
      if (paymentMethod !== 'CASH' && !cleanRef) {
        throw new HttpError(400, `Payment reference number or transaction UTR is required for ${paymentMethod}.`);
      }
      const offlineReference = cleanRef || `${methodPrefix}-${Date.now()}`;

      const newOutstanding = Math.max(0, Math.round((remainingDue - amountToApply) * 100) / 100);
      const finalStatus = newOutstanding > 0 ? 'PARTIALLY_PAID' : 'PAID';

      // Generate unique receipt number (METHOD-YYYY-XXXXXX)
      const yearStr = new Date().getFullYear();
      const randSeq = Math.floor(100000 + Math.random() * 900000);
      const receiptNumber = `${methodPrefix}-${yearStr}-${randSeq}`;

      const methodLabels = {
        CASH: 'Cash',
        CHEQUE: 'Cheque',
        UPI: 'UPI Transfer',
        DEMAND_DRAFT: 'Demand Draft',
        BANK_TRANSFER: 'Bank transfer',
        NEFT: 'NEFT',
      };
      const methodLabel = methodLabels[paymentMethod] || paymentMethod;

      const auditEntry = {
        action: `${paymentMethod}_PAYMENT_VERIFIED`,
        details: `${methodLabel} payment of ₹${amountToApply} approved (${finalStatus}). Receipt #${receiptNumber}. Remaining due: ₹${newOutstanding}`,
        performedBy: adminUserId,
        source: 'ADMIN_PANEL',
        date: new Date(),
      };

      const updated = await invoiceRepository.updateStatusWithLock(
        invoiceId,
        finalStatus,
        {
          paid_at: new Date(),
          settled_at: new Date(),
          amount: amountToApply,
          paymentMethod: paymentMethod,
          offlineReference: offlineReference,
          payerNotes: options?.notes || invoice.payerNotes,
          paymentScreenshot: options?.paymentScreenshot || invoice.paymentScreenshot,
          auditEntry,
        },
        activeSession
      );

      // Find existing pending payment or create new PAID payment
      const paymentFindQuery = Payment.findOne({ invoiceId: invoice._id, status: 'VERIFICATION_PENDING' });
      if (activeSession) paymentFindQuery.session(activeSession);
      let payment = await paymentFindQuery;

      if (payment) {
        payment.status = 'success';
        payment.domain = 'INVOICE';
        payment.amount = amountToApply;
        payment.verifiedBy = adminUserId || null;
        payment.verifiedAt = new Date();
        payment.receivedBy = payment.receivedBy || adminUserId || null;
        payment.processedBy = adminUserId || null;
        payment.receiptNumber = receiptNumber;
        payment.paymentMethod = paymentMethod;
        if (options?.notes) payment.payerNotes = options.notes;
        if (options?.paymentScreenshot) payment.proofDocument = options.paymentScreenshot;
        await payment.save(activeSession ? { session: activeSession } : undefined);
      } else {
        const targetUserId = invoice.targetUserId?._id || invoice.targetUserId;
        const paymentDocs = await Payment.create([{
          orgId: invoice.communityId || invoice.orgId,
          userId: targetUserId,
          invoiceId: invoice._id,
          residentId: targetUserId,
          villaId: invoice.unitId,
          referenceId: invoice._id,
          referenceType: 'Invoice',
          domain: 'INVOICE',
          amount: amountToApply,
          status: 'success',
          paymentCategory: 'OFFLINE',
          paymentMethod: paymentMethod,
          paymentReference: offlineReference,
          gatewayTransactionId: offlineReference,
          receiptNumber: receiptNumber,
          verifiedBy: adminUserId || null,
          verifiedAt: new Date(),
          receivedBy: adminUserId || null,
          processedBy: adminUserId || null,
          proofDocument: options?.paymentScreenshot || invoice.paymentScreenshot || null,
          payerNotes: options?.notes || invoice.payerNotes || null,
          gateway: 'offline',
          idempotencyKey: `OFFLINE_PAY:${invoice._id.toString()}:${receiptNumber}`,
        }], activeSession ? { session: activeSession } : {});
        payment = paymentDocs[0];
      }

      // Record Double-Entry Financial Ledger entry (Bank/Cheque/Cash Clearing -> Invoice Receivable)
      const financialLedgerService = (await import('../ledger/financialLedger.service.js')).default;
      const ledgerEntry = await financialLedgerService.recordSettlementLedgerEntry(payment, 'INVOICE', activeSession);

      if (isTransactionActive) {
        await session.commitTransaction();
      }
      await session.endSession();

      const populated = await Invoice.findById(updated._id)
        .populate('targetUserId', 'name username email firstName lastName')
        .populate('unitId', 'unitNumber')
        .lean();

      const result = populated || (updated.toObject ? updated.toObject() : updated);
      result.receiptNumber = receiptNumber;
      result.payment = payment;
      result.ledgerEntry = ledgerEntry;

      paymentEventEmitter.emit(PAYMENT_SUCCESS, payment, { alreadySettled: true });
      invoiceEventEmitter.emit(INVOICE_STATUS_UPDATED, result);
      invoiceEventEmitter.emit('OFFLINE_PAYMENT_APPROVED', result);
      if (isCash) {
        invoiceEventEmitter.emit('CASH_PAYMENT_RECORDED', result);
      }

      return result;
    } catch (err) {
      if (isTransactionActive) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      await session.endSession();
      throw err;
    }
  }

  /**
  /**
   * Reject a pending offline payment submission (Admin only).
   */
  async rejectOfflinePayment(invoiceId, adminUserIdOrReason = null, rejectionReasonParam = '') {
    let adminUserId = null;
    let reason = '';

    if (typeof adminUserIdOrReason === 'string' && adminUserIdOrReason.length > 0 && !mongoose.Types.ObjectId.isValid(adminUserIdOrReason) && !rejectionReasonParam) {
      reason = adminUserIdOrReason;
    } else if (rejectionReasonParam) {
      adminUserId = adminUserIdOrReason;
      reason = rejectionReasonParam;
    } else {
      adminUserId = adminUserIdOrReason;
      reason = '';
    }

    const correlationId = loggerStorage.getStore() || 'N/A';
    logger.info('rejectOfflinePayment called', { invoiceId, reason, adminUserId, correlationId });

    const Invoice = (await import('./invoice.model.js')).default;
    const Payment = (await import('../payment/payment.model.js')).default;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw new HttpError(404, 'Invoice not found');
    }

    if (invoice.status !== 'VERIFICATION_PENDING') {
      throw new HttpError(400, `Cannot reject offline payment for invoice in '${invoice.status}' status`);
    }

    const prevRef = invoice.offlineReference || 'N/A';
    const prevAmount = invoice.offlineAmount || 0;
    const now = new Date();

    // Determine restored status based on existing paidAmount and dueDate
    let restoredStatus = 'UNPAID';
    if ((invoice.paidAmount || 0) > 0 && (invoice.outstandingAmount || 0) > 0) {
      restoredStatus = (invoice.dueDate && invoice.dueDate < now) ? 'OVERDUE' : 'PARTIALLY_PAID';
    } else {
      restoredStatus = (invoice.dueDate && invoice.dueDate < now) ? 'OVERDUE' : 'UNPAID';
    }

    invoice.status = restoredStatus;
    invoice.rejectionReason = reason;
    invoice.offlineAmount = null;
    invoice.offlineReference = null;

    if (!invoice.auditHistory) invoice.auditHistory = [];
    invoice.auditHistory.push({
      action: 'OFFLINE_PAYMENT_REJECTED',
      details: `Offline payment submission (Ref: ${prevRef}, Amount: ₹${prevAmount}) was rejected by admin. Reason: ${reason || 'Payment could not be verified'}`,
      date: now,
      performedBy: adminUserId || null,
      userRole: 'ADMIN',
      reason: reason || null,
    });

    await invoice.save();

    // Update pending Payment record if present
    try {
      const payment = await Payment.findOne({ invoiceId: invoice._id, status: 'VERIFICATION_PENDING' });
      if (payment) {
        payment.status = 'REJECTED';
        payment.rejectionReason = reason;
        payment.verifiedBy = adminUserId || null;
        payment.verifiedAt = new Date();
        await payment.save();
      }
    } catch (err) {
      logger.error('Failed to update Payment status to REJECTED:', err);
    }

    const populated = await Invoice.findById(invoice._id)
      .populate('targetUserId', 'name username email firstName lastName')
      .populate('unitId', 'unitNumber')
      .lean();

    const result = populated || (invoice.toObject ? invoice.toObject() : invoice);
    result.rejectionReason = reason;

    invoiceEventEmitter.emit(INVOICE_STATUS_UPDATED, result);
    invoiceEventEmitter.emit('BANK_TRANSFER_REJECTED', result);

    // Send in-app notification to resident
    try {
      const notificationService = (await import('../notification/notification.service.js')).default;
      const targetUserId = invoice.targetUserId?._id || invoice.targetUserId;
      if (targetUserId) {
        await notificationService.createNotification({
          recipientId: targetUserId,
          orgId: invoice.orgId || null,
          senderId: adminUserId || null,
          title: 'Offline Payment Rejected',
          body: `Your offline payment submission for invoice #${invoice.invoiceNumber || invoice._id} was rejected${reason ? `: ${reason}` : '.'}`,
          actionUrl: '/billing',
          type: 'WARNING',
        });
      }
    } catch (err) {
      logger.error('Failed to create user notification for rejected offline payment:', err);
    }

    return result;
  }

  /**
   * Record Cash Payment directly by Facility In-Charge / Admin.
   */
  async recordCashPayment(invoiceId, amount, facilityUserId) {
    const correlationId = loggerStorage.getStore() || 'N/A';
    logger.info('recordCashPayment called', { invoiceId, amount, facilityUserId, correlationId });

    const Invoice = (await import('./invoice.model.js')).default;
    const Payment = (await import('../payment/payment.model.js')).default;
    const financialLedgerService = (await import('../ledger/financialLedger.service.js')).default;

    const session = await mongoose.startSession();
    let isTransactionActive = false;
    try {
      session.startTransaction();
      isTransactionActive = true;
    } catch (err) {
      logger.warn('Mongoose transaction not supported; continuing with session:', { error: err.message });
    }

    const activeSession = isTransactionActive ? session : undefined;

    try {
      const invoiceQuery = Invoice.findById(invoiceId);
      if (activeSession) invoiceQuery.session(activeSession);
      const invoice = await invoiceQuery;

      if (!invoice) {
        throw new HttpError(404, 'Invoice not found');
      }

      if (invoice.status === 'PAID') {
        throw new HttpError(400, 'Invoice is already fully paid.');
      }

      const totalLiability =
        Number(invoice.totalAmount) ||
        Number(invoice.totalDue) ||
        Number(invoice.currentCharge) ||
        ((Number(invoice.outstandingAmount || 0) + Number(invoice.paidAmount || 0))) ||
        0;
      const previousPaid = Number(invoice.paidAmount || 0);
      const remainingDue = Math.max(0, totalLiability - previousPaid);

      const amountToApply = amount !== undefined && amount !== null && Number(amount) > 0
        ? Number(amount)
        : (invoice.outstandingAmount !== undefined ? Number(invoice.outstandingAmount) : remainingDue);

      if (amountToApply <= 0) {
        throw new HttpError(400, 'Invalid cash payment amount.');
      }

      if (amountToApply > remainingDue) {
        throw new HttpError(400, `Payment amount ₹${amountToApply} exceeds outstanding balance ₹${remainingDue}.`);
      }

      const newOutstanding = Math.max(0, remainingDue - amountToApply);
      const finalStatus = newOutstanding > 0 ? 'PARTIALLY_PAID' : 'PAID';

      // Generate unique receipt number (CASH-YYYY-XXXXXX)
      const yearStr = new Date().getFullYear();
      const randSeq = Math.floor(100000 + Math.random() * 900000);
      const receiptNumber = `CASH-${yearStr}-${randSeq}`;

      const auditEntry = {
        action: 'CASH_PAYMENT_RECORDED',
        details: `Cash payment of ₹${amountToApply} recorded (${finalStatus}). Receipt #${receiptNumber}. Remaining due: ₹${newOutstanding}`,
        performedBy: facilityUserId,
        source: 'ADMIN_PANEL',
        date: new Date(),
      };

      // Update invoice using repository lock
      const updated = await invoiceRepository.updateStatusWithLock(
        invoiceId,
        finalStatus,
        {
          amount: amountToApply,
          paymentMethod: 'CASH',
          paid_at: new Date(),
          settled_at: new Date(),
          offlineReference: receiptNumber,
          auditEntry,
        },
        activeSession
      );

      const targetUserId = invoice.targetUserId?._id || invoice.targetUserId;

      // Create canonical Payment record
      const paymentDocs = await Payment.create([{
        orgId: invoice.communityId || invoice.orgId,
        userId: targetUserId,
        invoiceId: invoice._id,
        residentId: targetUserId,
        villaId: invoice.unitId,
        referenceId: invoice._id,
        referenceType: 'Invoice',
        domain: 'INVOICE',
        amount: amountToApply,
        status: 'success',
        paymentCategory: 'OFFLINE',
        paymentMethod: 'CASH',
        paymentDate: new Date(),
        receivedBy: facilityUserId,
        processedBy: facilityUserId,
        receiptNumber: receiptNumber,
        gateway: 'offline',
        gatewayTransactionId: receiptNumber,
        idempotencyKey: `CASH_PAY:${invoice._id.toString()}:${receiptNumber}`,
      }], activeSession ? { session: activeSession } : {});
      const payment = paymentDocs[0];

      // Record Double-Entry Financial Ledger entry (CASH_CLEARING -> INVOICE_RECEIVABLE)
      const ledgerEntry = await financialLedgerService.recordSettlementLedgerEntry(payment, 'INVOICE', activeSession);

      if (isTransactionActive) {
        await session.commitTransaction();
      }
      await session.endSession();

      const populated = await Invoice.findById(invoice._id)
        .populate('targetUserId', 'name username email firstName lastName')
        .populate('unitId', 'unitNumber')
        .lean();

      const result = populated || (updated.toObject ? updated.toObject() : updated);
      result.receiptNumber = receiptNumber;
      result.payment = payment;
      result.ledgerEntry = ledgerEntry;

      paymentEventEmitter.emit(PAYMENT_SUCCESS, payment, { alreadySettled: true });
      invoiceEventEmitter.emit('CASH_PAYMENT_RECORDED', result);
      invoiceEventEmitter.emit(INVOICE_STATUS_UPDATED, result);

      return result;
    } catch (err) {
      if (isTransactionActive) {
        try { await session.abortTransaction(); } catch (e) {}
      }
      await session.endSession();
      throw err;
    }
  }

  /**
   * Search eligible unpaid/outstanding invoices for Cash collection universal search.
   */
  async searchCashEligible(searchQuery, orgId) {
    const Invoice = (await import('./invoice.model.js')).default;
    const Villa = (await import('../villa/villa.model.js')).default;
    const User = (await import('../user/user.model.js')).default;

    if (!searchQuery || !searchQuery.trim()) {
      return [];
    }

    const q = searchQuery.trim();
    const regex = new RegExp(q, 'i');

    // Find matching villas
    const matchingVillas = await Villa.find({
      $or: [{ unitNumber: regex }, { number: regex }, { block: regex }]
    }).select('_id');
    const villaIds = matchingVillas.map(v => v._id);

    // Find matching users
    const matchingUsers = await User.find({
      $or: [{ name: regex }, { firstName: regex }, { lastName: regex }, { username: regex }, { email: regex }, { phone: regex }, { phoneNumber: regex }]
    }).select('_id');
    const userIds = matchingUsers.map(u => u._id);

    const invoices = await Invoice.find({
      orgId: orgId,
      status: { $in: ['UNPAID', 'OVERDUE', 'PARTIALLY_PAID'] },
      $or: [
        { invoiceNumber: regex },
        { unitId: { $in: villaIds } },
        { targetUserId: { $in: userIds } }
      ]
    })
      .populate('targetUserId', 'name username email firstName lastName phone phoneNumber')
      .populate('unitId', 'unitNumber block type')
      .populate('assessmentId', 'title name')
      .lean();

    return invoices;
  }

  /**
   * Fetch cash collections history for facility staff.
   */
  async getCashCollections(facilityUserId, orgId, query = {}) {
    const Payment = (await import('../payment/payment.model.js')).default;
    
    const filter = {
      paymentMethod: 'CASH',
      status: 'PAID',
    };

    if (orgId) {
      filter.orgId = orgId;
    }

    // If specific facilityUserId provided and not requesting all
    if (facilityUserId && !query.allStaff) {
      filter.receivedBy = facilityUserId;
    }

    const payments = await Payment.find(filter)
      .populate('residentId', 'name username email firstName lastName phone')
      .populate('villaId', 'unitNumber block')
      .populate('invoiceId', 'invoiceNumber snapshot billingPeriodString')
      .populate('receivedBy', 'name username email')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate today's collection summary
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayCount = 0;
    let todayAmount = 0;
    let totalCount = payments.length;
    let totalAmount = 0;

    for (const p of payments) {
      const amt = p.amount || 0;
      totalAmount += amt;
      const pDate = new Date(p.createdAt || p.paymentDate);
      if (pDate >= today) {
        todayCount++;
        todayAmount += amt;
      }
    }

    return {
      collections: payments,
      summary: {
        todayCashReceived: todayAmount,
        todayTransactions: todayCount,
        totalCashReceived: totalAmount,
        totalTransactions: totalCount
      }
    };
  }

  /**
   * Fetch portfolio dues and compliance info for a persona.
   * @param {object} userContext - Current authenticated user context
   * @param {string} [communityId] - Optional Community / Organization ID to scope dues
   */
  async getUserDuesOverview(userContext, communityId = null) {
    const correlationId = loggerStorage.getStore() || 'N/A';
    const resolvedUserId = userContext.id || userContext._id;
    logger.info('getUserDuesOverview called', { userId: resolvedUserId, communityId, correlationId });

    const personalDues = await invoiceRepository.getUserPortfolioDues(resolvedUserId, communityId);
    const recentInvoices = await invoiceRepository.getUserRecentInvoices(resolvedUserId, communityId);

    const secondaryCompliance = [];

    // Check if user has Owner role using roleService (Dynamic role check)
    let isOwner = false;
    if (userContext.roles && userContext.roles.length > 0) {
      try {
        const roles = await roleService.getRolesByIds(userContext.roles);
        isOwner = roles.some((r) => r.name.toLowerCase().includes('owner'));
      } catch (err) {
        logger.error('Failed to resolve roles for portfolio dues check:', err);
      }
    }

    if (isOwner) {
      // Find units owned by this user (scoped to communityId if provided)
      const ownedUnits = await villaService.getUnitsByOwner(resolvedUserId, communityId);
      
      for (const unit of ownedUnits) {
        // Find if occupied by tenant
        const tenant = (unit.residents || []).find((r) => r.residencyType === 'Tenant');
        if (tenant && tenant.userId) {
          // Fetch tenant details
          let tenantUser = null;
          try {
            tenantUser = await userService.getUserById(tenant.userId);
          } catch (err) {
            logger.warn(`Tenant details not resolved for user ${tenant.userId}`);
          }

          // Fetch outstanding unpaid tenant invoices for this unit (scoped to communityId if provided)
          const tenantInvoiceQuery = {
            unitId: unit._id,
            targetUserId: tenant.userId,
            status: { $in: ['UNPAID', 'VERIFICATION_PENDING'] },
          };
          if (communityId) {
            tenantInvoiceQuery.communityId = communityId;
          }
          const tenantInvoices = await Invoice.find(tenantInvoiceQuery);

          for (const inv of tenantInvoices) {
            secondaryCompliance.push({
              unit: unit.unitNumber,
              tenantName: tenantUser ? (tenantUser.name || tenantUser.username) : 'Tenant',
              amountDue: inv.totalDue,
              status: inv.status,
            });
          }
        }
      }
    }

    return {
      personalDues,
      secondaryCompliance,
      recentInvoices,
    };
  }

  /**
   * Fetch aggregated dashboard KPIs for a community.
   */
  async getDashboardKPIs(communityId) {
    if (!communityId) {
      throw new HttpError(400, 'Community ID (communityId) is required');
    }
    return await invoiceRepository.getDashboardKPIs(communityId);
  }

  /**
   * Fetch paginated and populated invoices for a community.
   */
  async getInvoices(orgId, query) {
    return await invoiceRepository.getInvoices(orgId, query);
  }

  /**
   * Check if there are active invoices for an assessment template.
   */
  async checkActiveInvoicesForAssessment(assessmentId) {
    return await invoiceRepository.hasActiveInvoices(assessmentId);
  }

  /**
   * Check if any invoices exist for an assessment template.
   */
  async checkInvoicesExistForAssessment(assessmentId) {
    return await invoiceRepository.hasAnyInvoices(assessmentId);
  }

  /**
   * Fetch invoice by ID with optional transaction session.
   */
  async getInvoiceById(invoiceId, session = null) {
    if (!invoiceId) {
      throw new HttpError(400, 'Invoice ID or number is required');
    }

    const cleanId = String(invoiceId).replace(/^[#]/, '').trim();

    // Support lookup by MongoDB _id OR invoiceNumber (with/without # or MMG prefix)
    const matchConditions = [];
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      matchConditions.push({ _id: new mongoose.Types.ObjectId(cleanId) });
    }
    matchConditions.push({ invoiceNumber: cleanId });

    if (/^MMG[:\-_]/i.test(cleanId)) {
      const parts = cleanId.replace(/^MMG[:\-_]/i, '').split(':');
      if (parts[0]) matchConditions.push({ invoiceNumber: parts[0] });
      if (parts[1]) matchConditions.push({ invoiceNumber: parts[1] });
      if (parts[2] && mongoose.Types.ObjectId.isValid(parts[2])) {
        matchConditions.push({ _id: new mongoose.Types.ObjectId(parts[2]) });
      }
    }

    const query = Invoice.findOne({ $or: matchConditions })
      .populate('unitId')
      .populate('assessmentId')
      .populate('targetUserId', 'name email username phone');
    if (session) query.session(session);
    const invoice = await query;
    if (!invoice) {
      throw new HttpError(404, 'Invoice not found');
    }
    const invObj = invoice.toObject ? invoice.toObject() : invoice;
    if (!invObj.assessmentName) {
      invObj.assessmentName = invObj.snapshot?.assessmentName || invObj.assessmentId?.name || 'Community Maintenance Assessment';
    }
    if (!invObj.unitNumber) {
      invObj.unitNumber = invObj.snapshot?.unitDetails?.unitNumber || invObj.unitId?.unitNumber || invObj.unitId?.villaNumber || '';
    }
    return invObj;
  }

  /**
   * Send an in-app reminder notification to the resident for an individual invoice.
   * @param {string} invoiceId - Invoice ID
   * @param {string} adminUserId - Admin user ID
   * @param {string} orgId - Community / Organization ID
   * @returns {Promise<object>}
   */
  async sendInvoiceReminder(invoiceId, adminUserId, orgId) {
    const invoice = await this.getInvoiceById(invoiceId);

    // Tenant isolation check
    if (orgId && invoice.communityId?.toString() !== orgId.toString()) {
      throw new HttpError(403, 'Unauthorized access to this invoice');
    }

    if (invoice.status === 'PAID') {
      throw new HttpError(400, 'Invoice is already marked as PAID');
    }

    if (!invoice.targetUserId) {
      throw new HttpError(400, 'No resident user assigned to this invoice');
    }

    // Determine unit representation and gather all configured resident recipients
    let unitStr = 'your unit';
    const recipientUserIds = new Set();
    if (invoice.targetUserId) {
      recipientUserIds.add(invoice.targetUserId.toString());
    }

    if (invoice.unitId && (invoice.communityId || orgId)) {
      try {
        const unit = await villaService.getUnitById(invoice.unitId, invoice.communityId || orgId);
        if (unit?.unitNumber) {
          unitStr = `Unit ${unit.unitNumber}`;
        }
        if (unit?.ownerId) {
          recipientUserIds.add(unit.ownerId.toString());
        }
        if (unit?.primaryResidentId) {
          recipientUserIds.add(unit.primaryResidentId.toString());
        }
        if (Array.isArray(unit?.residents)) {
          unit.residents.forEach((r) => {
            const uid = r.userId?._id || r.userId;
            if (uid && (!r.moveOutDate || new Date(r.moveOutDate) > new Date())) {
              recipientUserIds.add(uid.toString());
            }
          });
        }
      } catch (e) {
        // Continue with default unit string and primary targetUserId
      }
    } else if (invoice.snapshot?.unitDetails?.unitNumber) {
      unitStr = `Unit ${invoice.snapshot.unitDetails.unitNumber}`;
    }

    const dueAmount = invoice.outstandingAmount ?? invoice.totalDue ?? invoice.totalAmount ?? 0;
    const formattedAmount = Number(dueAmount).toLocaleString('en-IN');
    const invoiceNo = invoice.invoiceNumber || invoice._id;

    const title = `Payment Reminder: Invoice #${invoiceNo}`;
    const body = `A maintenance payment of ₹${formattedAmount} is pending for ${unitStr}. Tap to view invoice and pay now.`;
    const actionUrl = `/(resident)/billing/invoice/${invoice._id}`;

    const createdNotificationIds = [];
    for (const recipientId of recipientUserIds) {
      try {
        const notification = await notificationService.createNotification({
          recipientId,
          orgId: invoice.orgId || null,
          senderId: adminUserId,
          title,
          body,
          actionUrl,
          type: 'WARNING',
        });
        createdNotificationIds.push(notification._id);
      } catch (notifErr) {
        logger.warn(`Failed to dispatch reminder to resident ${recipientId}:`, notifErr);
      }
    }

    invoice.reminderCount = (invoice.reminderCount || 0) + 1;
    invoice.lastReminderSentAt = new Date();
    await invoice.save();

    return {
      success: true,
      message: `Reminder notification sent to ${createdNotificationIds.length} configured resident(s)`,
      recipientsCount: createdNotificationIds.length,
      notificationIds: createdNotificationIds,
    };
  }

  /**
   * Send an in-app reminder notification to a resident for their overall dues portfolio.
   * @param {object} payload - { residentUserId, residentName, totalDue, units }
   * @param {string} adminUserId - Admin user ID
   * @param {string} orgId - Community / Organization ID
   * @returns {Promise<object>}
   */
  async notifyResidentPortfolio(payload, adminUserId, orgId) {
    const { residentUserId, totalDue, units = [] } = payload || {};
    if (!residentUserId || residentUserId === 'unassigned') {
      throw new HttpError(400, 'Valid resident user ID is required to send notification');
    }

    const unitsStr = Array.isArray(units) && units.length > 0 ? units.join(', ') : 'your units';
    const formattedAmount = Number(totalDue || 0).toLocaleString('en-IN');

    const title = 'Maintenance Dues Reminder';
    const body = `Your outstanding maintenance balance across units (${unitsStr}) is ₹${formattedAmount}. Tap to view details and settle your dues.`;
    const actionUrl = '/(resident)/billing/my-dues';

    const notification = await notificationService.createNotification({
      recipientId: residentUserId,
      orgId: orgId || null,
      senderId: adminUserId,
      title,
      body,
      actionUrl,
      type: 'WARNING',
    });

    return {
      success: true,
      message: 'Portfolio reminder notification sent successfully',
      notificationId: notification._id,
    };
  }
}

export default new InvoiceService();
