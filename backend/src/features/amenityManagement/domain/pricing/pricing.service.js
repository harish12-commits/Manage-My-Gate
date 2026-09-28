import { priceBooking } from '../profiles/facilityProfiles.js';

/**
 * Pricing Domain Service for Amenity Management.
 * Computes an immutable pricing snapshot for reservations.
 */
export class PricingService {
  /**
   * Archetype-aware price for a booking on `facility` (per person for shared access,
   * per court/venue/room otherwise, per item for inventory; deposit may apply to free
   * facilities). This is the price residents are quoted, held and charged.
   *
   * @param {Object} facility - AmenityFacility document
   * @param {{ startDateTime: Date, endDateTime: Date, headcount?: number, quantity?: number }} params
   */
  calculateForFacility(facility, { startDateTime, endDateTime, headcount = 1, quantity = 1 }) {
    return priceBooking(facility, {
      start: new Date(startDateTime),
      end: new Date(endDateTime),
      headcount,
      quantity,
    });
  }

  /**
   * Calculates commercial breakdown and produces an immutable pricing snapshot.
   *
   * @param {Object} params
   * @param {Object} params.pricingConfig - Pricing configuration from AmenityFacility
   * @param {Date} params.startDateTime - UTC start instant
   * @param {Date} params.endDateTime - UTC end instant
   * @param {number} [params.headcount=1] - Number of participants
   * @param {number} [params.quantity=1] - Number of inventory units
   * @returns {{
   *   baseAmount: number,
   *   taxAmount: number,
   *   depositAmount: number,
   *   totalAmount: number,
   *   currency: string
   * }}
   */
  calculatePricingSnapshot({
    pricingConfig = {},
    startDateTime,
    endDateTime,
    headcount = 1,
    quantity = 1,
  }) {
    const pricingType = pricingConfig.pricingType || 'FREE';
    const baseRate = Number(pricingConfig.baseRate) || 0;
    const taxPercentage = Number(pricingConfig.taxPercentage) || 0;
    const securityDeposit = Number(pricingConfig.securityDeposit) || 0;
    const currency = pricingConfig.currency || 'INR';

    let baseAmount = 0;

    const durationMs = Math.max(0, new Date(endDateTime).getTime() - new Date(startDateTime).getTime());
    const durationHours = durationMs / (1000 * 60 * 60);
    const durationDays = Math.max(1, Math.ceil(durationHours / 24));

    const qty = Math.max(1, Number(quantity) || 1);
    const count = Math.max(1, Number(headcount) || 1);
    const unitMultiplier = qty * count;

    switch (pricingType) {
      case 'FREE':
        baseAmount = 0;
        break;

      case 'HOURLY':
        baseAmount = Math.round(durationHours * baseRate * unitMultiplier * 100) / 100;
        break;

      case 'DAILY':
        baseAmount = Math.round(durationDays * baseRate * unitMultiplier * 100) / 100;
        break;

      case 'FIXED_EVENT':
        baseAmount = Math.round(baseRate * unitMultiplier * 100) / 100;
        break;

      case 'TIERED':
        baseAmount = Math.round(durationHours * baseRate * unitMultiplier * 100) / 100;
        break;

      default:
        baseAmount = Math.round(baseRate * unitMultiplier * 100) / 100;
        break;
    }

    const taxAmount = Math.round(((baseAmount * taxPercentage) / 100) * 100) / 100;
    const depositAmount = pricingType === 'FREE' ? 0 : Math.round(securityDeposit * 100) / 100;
    const totalAmount = pricingType === 'FREE' ? 0 : Math.round((baseAmount + taxAmount + depositAmount) * 100) / 100;

    return {
      baseAmount,
      taxAmount,
      depositAmount,
      totalAmount,
      currency,
    };
  }

  /**
   * Alias for calculatePricingSnapshot supporting alternative parameter shapes.
   *
   * @param {Object} params
   * @returns {Object}
   */
  calculateReservationPrice(params = {}) {
    return this.calculatePricingSnapshot({
      pricingConfig: params.pricingConfig || params.pricing || {},
      startDateTime: params.startDateTime || params.requestedStartDateTime,
      endDateTime: params.endDateTime || params.requestedEndDateTime,
      headcount: params.headcount,
      quantity: params.quantity,
    });
  }
}

export const pricingService = new PricingService();
export default pricingService;
