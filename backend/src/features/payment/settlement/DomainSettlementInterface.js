/**
 * Base Abstract Domain Settlement Interface
 * All domain settlement handlers (Invoice, Amenity, Wallet) must implement this contract.
 */
export class DomainSettlementInterface {
  /**
   * Execute authoritative financial domain settlement within a transaction session.
   * @param {object} payment - Payment record
   * @param {import('mongoose').ClientSession} session - Active Mongoose transaction session
   * @returns {Promise<object>} Settled domain entity
   */
  async settle(payment, session) {
    throw new Error('Method settle() must be implemented.');
  }

  /**
   * Execute domain refund adjustments within a transaction session.
   * @param {object} payment - Original Payment record
   * @param {object} refundRecord - Refund Payment record
   * @param {import('mongoose').ClientSession} session - Active Mongoose transaction session
   * @returns {Promise<object>}
   */
  async refund(payment, refundRecord, session) {
    throw new Error('Method refund() must be implemented.');
  }
}

export default DomainSettlementInterface;
