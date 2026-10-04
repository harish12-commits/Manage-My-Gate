import platformEntitlementService from '../features/platformEntitlement/platformEntitlement.service.js';
import HttpError from '../utils/httpError.utils.js';

/**
 * Middleware factory to authorize access based on Platform Feature Entitlements.
 * Checks if the requesting user's organization has an active entitlement for the specified feature key.
 *
 * @param {string} featureKey - The feature key to check (e.g. 'VISITOR_MANAGEMENT', 'AMENITY_BOOKING')
 * @returns {Function} Express middleware function
 */
export const authorizeFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new HttpError(401, 'Unauthorized access. Authentication session missing.'));
      }

      // Support property variants: orgId, organisationId, or organizationId
      const orgId = req.user.orgId || req.user.organisationId || req.user.organizationId;

      if (!orgId) {
        return next(
          new HttpError(403, 'Forbidden. User is not associated with an active community ID.')
        );
      }

      const isEntitled = await platformEntitlementService.verifyEntitlement(orgId, featureKey);

      if (!isEntitled) {
        return next(
          new HttpError(
            403,
            `Forbidden. Community does not have an active entitlement for feature '${featureKey}'.`
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default authorizeFeature;
