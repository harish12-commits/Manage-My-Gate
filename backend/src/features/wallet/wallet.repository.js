import mongoose from 'mongoose';
import { Wallet, WalletTransaction } from './wallet.model.js';
import '../amenityBooking/amenityBooking.model.js';
import { v4 as uuidv4 } from 'uuid';

class WalletRepository {
  _getActiveSession(session) {
    return session && typeof session.inTransaction === 'function' && session.inTransaction() ? session : null;
  }

  async getWallet(userId, orgId, session = null) {
    const activeSession = this._getActiveSession(session);
    const options = { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true };
    if (activeSession) options.session = activeSession;

    let targetOrgId = orgId;
    if (!targetOrgId) {
      try {
        const OrgMembership = (await import('../orgMembership/orgMembership.model.js')).default;
        const membership = await OrgMembership.findOne({ userId, status: 'Active' })
          .sort({ updatedAt: -1 })
          .session(activeSession);
        if (membership && membership.orgId) {
          targetOrgId = membership.orgId;
        }
      } catch (e) {
        // Fallback if model not found
      }
    }

    if (!targetOrgId) {
      try {
        const Organization = (await import('../organization/organization.model.js')).default;
        const defaultOrg = (await Organization.findOne({ status: 'Active' })) || (await Organization.findOne({}));
        if (defaultOrg && defaultOrg._id) {
          targetOrgId = defaultOrg._id;
        }
      } catch (e) {}
    }

    if (!targetOrgId && process.env.PLATFORM_ORG_ID) {
      targetOrgId = process.env.PLATFORM_ORG_ID;
    }

    if (targetOrgId) {
      let attempts = 0;
      while (attempts < 3) {
        try {
          return await Wallet.findOneAndUpdate(
            { userId, orgId: targetOrgId },
            { $setOnInsert: { balance: 0, orgId: targetOrgId } },
            options
          );
        } catch (err) {
          if ((err.code === 112 || err.hasErrorLabel?.('TransientTransactionError')) && attempts < 2) {
            attempts++;
            await new Promise((res) => setTimeout(res, 50 * attempts));
            continue;
          }
          throw err;
        }
      }
    }

    // If still no orgId, search existing with most recent activity or insert without orgId
    const existingWallet = await Wallet.findOne({ userId })
      .sort({ updatedAt: -1 })
      .session(activeSession);
    if (existingWallet) return existingWallet;

    return await Wallet.findOneAndUpdate(
      { userId },
      { $setOnInsert: { balance: 0 } },
      options
    );
  }

  async getTransactions(userId, orgId) {
    const query = { userId };
    if (orgId) query.orgId = orgId;
    return await WalletTransaction.find(query)
      .populate({ path: 'referenceId', select: 'qrCode qrStatus status bookingDate startTime endTime' })
      .sort({ createdAt: -1 });
  }

  async createTransaction(data, session = null) {
    const activeSession = this._getActiveSession(session);
    let targetOrgId = data.orgId;
    if (!targetOrgId) {
      try {
        const Organization = (await import('../organization/organization.model.js')).default;
        const defaultOrg = (await Organization.findOne({ status: 'Active' })) || (await Organization.findOne({}));
        if (defaultOrg && defaultOrg._id) {
          targetOrgId = defaultOrg._id;
        }
      } catch (e) {}
    }
    const transactionId = data.transactionId || `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const transaction = new WalletTransaction({
      ...data,
      orgId: targetOrgId || data.orgId,
      transactionId
    });
    return await transaction.save(activeSession ? { session: activeSession } : undefined);
  }

  async updateBalance(userId, orgId, amountDelta, session = null) {
    const activeSession = this._getActiveSession(session);
    let targetOrgId = orgId;
    
    if (!targetOrgId) {
      const existingWallet = await Wallet.findOne({ userId }).sort({ updatedAt: -1 }).session(activeSession);
      if (existingWallet && existingWallet.orgId) {
        targetOrgId = existingWallet.orgId;
      }
    }

    if (!targetOrgId) {
      try {
        const Organization = (await import('../organization/organization.model.js')).default;
        const defaultOrg = (await Organization.findOne({ status: 'Active' })) || (await Organization.findOne({}));
        if (defaultOrg && defaultOrg._id) {
          targetOrgId = defaultOrg._id;
        }
      } catch (e) {}
    }

    // Atomic conditional check on debit: Prevents overdraft race conditions
    if (amountDelta < 0) {
      const debitAmount = Math.abs(amountDelta);
      const query = targetOrgId
        ? { userId: new mongoose.Types.ObjectId(userId), orgId: new mongoose.Types.ObjectId(targetOrgId), balance: { $gte: debitAmount } }
        : { userId: new mongoose.Types.ObjectId(userId), balance: { $gte: debitAmount } };

      const options = { returnDocument: 'after' };
      if (activeSession) options.session = activeSession;

      const updated = await Wallet.findOneAndUpdate(query, { $inc: { balance: amountDelta } }, options);
      if (!updated) {
        const HttpError = (await import('../../utils/httpError.utils.js')).default;
        const findQuery = Wallet.findOne(targetOrgId ? { userId, orgId: targetOrgId } : { userId });
        if (activeSession) findQuery.session(activeSession);
        const currentWallet = await findQuery;
        const currentBalance = currentWallet ? currentWallet.balance : 0;
        throw new HttpError(
          400,
          `Insufficient wallet balance. Total due is ₹${debitAmount}, but current available wallet balance is ₹${currentBalance}.`
        );
      }
      return updated;
    }

    // Credit (amountDelta >= 0)
    const query = targetOrgId ? { userId, orgId: targetOrgId } : { userId };
    const options = { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true };
    if (activeSession) options.session = activeSession;
    
    const update = { $inc: { balance: amountDelta } };
    if (targetOrgId) {
      update.$setOnInsert = { orgId: targetOrgId };
    }

    let attempts = 0;
    while (attempts < 3) {
      try {
        return await Wallet.findOneAndUpdate(query, update, options);
      } catch (err) {
        if ((err.code === 112 || err.hasErrorLabel?.('TransientTransactionError')) && attempts < 2) {
          attempts++;
          await new Promise((res) => setTimeout(res, 50 * attempts));
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Atomic conditional wallet debit.
   */
  async atomicDebit(userId, orgId, amount, session = null) {
    return await this.updateBalance(userId, orgId, -amount, session);
  }

  /**
   * Atomic wallet credit.
   */
  async atomicCredit(userId, orgId, amount, session = null) {
    return await this.updateBalance(userId, orgId, amount, session);
  }

  /**
   * Atomically debits a tenant-scoped wallet only when sufficient funds remain.
   *
   * A read-then-write balance check can overdraw a wallet when two booking
   * requests arrive at the same time. Keeping the balance guard in the query
   * makes the debit authoritative even under concurrent requests.
   */
  async debitBalanceIfSufficient(userId, orgId, amount, session = null) {
    const numericAmount = Number(amount);
    if (!orgId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return null;
    }

    const activeSession = this._getActiveSession(session);
    const options = { returnDocument: 'after', new: true };
    if (activeSession) options.session = activeSession;

    return Wallet.findOneAndUpdate(
      { userId, orgId, balance: { $gte: numericAmount } },
      { $inc: { balance: -numericAmount } },
      options
    );
  }

  async updateTransactionDescription(referenceId, type, appendText) {
    const transaction = await WalletTransaction.findOne({ referenceId, type });
    if (transaction) {
      transaction.description = transaction.description + ' ' + appendText;
      await transaction.save();
      return transaction;
    }
    return null;
  }

  async findTransactionByRazorpayPaymentId(razorpayPaymentId, session = null) {
    if (!razorpayPaymentId) return null;
    const activeSession = this._getActiveSession(session);
    return await WalletTransaction.findOne({ razorpay_payment_id: razorpayPaymentId }).session(activeSession);
  }

  async findTransactionByRazorpayOrderId(razorpayOrderId, session = null) {
    if (!razorpayOrderId) return null;
    const activeSession = this._getActiveSession(session);
    return await WalletTransaction.findOne({ razorpay_order_id: razorpayOrderId }).session(activeSession);
  }

  async updateTransaction(transactionId, updates, session = null) {
    const activeSession = this._getActiveSession(session);
    const options = { new: true, returnDocument: 'after' };
    if (activeSession) options.session = activeSession;
    return WalletTransaction.findByIdAndUpdate(transactionId, updates, options);
  }

  async createRazorpayTransaction(data, session = null) {
    const activeSession = this._getActiveSession(session);
    let targetOrgId = data.orgId;
    if (!targetOrgId) {
      try {
        const Organization = (await import('../organization/organization.model.js')).default;
        const defaultOrg = (await Organization.findOne({ status: 'Active' })) || (await Organization.findOne({}));
        if (defaultOrg && defaultOrg._id) {
          targetOrgId = defaultOrg._id;
        }
      } catch (e) {}
    }
    const transaction = new WalletTransaction({
      ...data,
      orgId: targetOrgId || data.orgId,
      paymentMethod: 'razorpay',
      referenceType: 'Recharge',
      type: 'Credit'
    });
    return await transaction.save(activeSession ? { session: activeSession } : undefined);
  }
}

export default new WalletRepository();
