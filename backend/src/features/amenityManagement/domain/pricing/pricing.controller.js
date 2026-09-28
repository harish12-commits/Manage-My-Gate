import pricingService from './pricing.service.js';
import amenityFacilityService from '../../facilities/amenityFacility.service.js';

export class PricingController {
  /**
   * Calculates pricing snapshot for a prospective booking window.
   */
  async calculate(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const { facilityId, startDateTime, endDateTime, headcount, quantity } = req.body;

      const facility = await amenityFacilityService.getFacilityById(facilityId, orgId);

      const pricingSnapshot = pricingService.calculateForFacility(facility, {
        startDateTime: new Date(startDateTime),
        endDateTime: new Date(endDateTime),
        headcount: Number(headcount) || 1,
        quantity: Number(quantity) || 1,
      });

      return res.success(pricingSnapshot, 'Pricing breakdown computed successfully');
    } catch (error) {
      return next(error);
    }
  }
}

export const pricingController = new PricingController();
export default pricingController;
