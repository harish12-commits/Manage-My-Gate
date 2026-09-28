import amenitySettingsService from './amenitySettings.service.js';

export class AmenitySettingsController {
  async get(req, res, next) {
    try {
      const settings = await amenitySettingsService.getSettings(req.tenant.orgId);
      return res.success(settings, 'Amenity settings retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const settings = await amenitySettingsService.updateSettings(req.tenant.orgId, req.body, req.user);
      return res.success(settings, 'Amenity settings updated successfully');
    } catch (error) {
      return next(error);
    }
  }
}

export const amenitySettingsController = new AmenitySettingsController();
export default amenitySettingsController;
