import availabilityService from './availability.service.js';

export class AvailabilityController {
  /**
   * Checks archetype-aware availability for a requested window.
   */
  async check(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const { facilityId, resourceId, startDateTime, endDateTime, requestedQuantity, headcount, quantity } = req.query;

      const result = await availabilityService.checkAvailability({
        orgId,
        facilityId,
        resourceId: resourceId || null,
        startDateTime: new Date(startDateTime),
        endDateTime: new Date(endDateTime),
        requestedQuantity: Number(requestedQuantity) || 1,
        headcount: headcount !== undefined ? Number(headcount) : undefined,
        quantity: quantity !== undefined ? Number(quantity) : undefined,
      });

      return res.success(result, 'Availability evaluated successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Evaluates and returns all bookable daily time slots for a facility on a date.
   * Excludes past slots and slots already booked or held.
   */
  async getDailySlots(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const { facilityId, resourceId, date, requestedQuantity, headcount, quantity } = req.query;

      const result = await availabilityService.getDailySlots({
        orgId,
        facilityId,
        resourceId: resourceId || null,
        dateStr: date,
        requestedQuantity: Number(requestedQuantity) || 1,
        headcount: headcount !== undefined ? Number(headcount) : undefined,
        quantity: quantity !== undefined ? Number(quantity) : undefined,
      });

      return res.success(result, 'Daily slots retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
}

export const availabilityController = new AvailabilityController();
export default availabilityController;
