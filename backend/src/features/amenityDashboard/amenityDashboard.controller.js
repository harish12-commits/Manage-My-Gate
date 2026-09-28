import dashboardService from './amenityDashboard.service.js';
class AmenityDashboardController {
  async getKpis(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const data = await dashboardService.getKpis(orgId);
      res.success(data, 'Dashboard KPIs retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getRevenue(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const data = await dashboardService.getRevenue(orgId);
      res.success(data, 'Revenue retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getOccupancy(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const data = await dashboardService.getOccupancy(orgId);
      res.success(data, 'Occupancy retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getTrends(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const data = await dashboardService.getTrends(orgId);
      res.success(data, 'Trends retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getRecentActivity(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const data = await dashboardService.getRecentActivity(orgId);
      res.success(data, 'Recent activity retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /** Booking ledger (V2): one row per booking with its money, plus a summary. */
  async getLedger(req, res, next) {
    try {
      const data = await dashboardService.getLedger(req.tenant.orgId, req.query);
      res.success(data, 'Amenity ledger retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCalendarEvents(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const { startDate, endDate, date, facilityId, amenityId, resourceId, status, paymentStatus, search } = req.query;
      const filters = {
        facilityId: facilityId || amenityId,
        resourceId,
        status,
        paymentStatus,
        search,
      };
      const effectiveStart = startDate || date;
      const effectiveEnd = endDate || date;
      const data = await dashboardService.getCalendarEvents(orgId, effectiveStart, effectiveEnd, filters);
      res.success(data, 'Calendar events retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCalendarIndicators(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const { year, month } = req.query; 
      const data = await dashboardService.getCalendarIndicators(orgId, year, month);
      res.success(data, 'Calendar indicators retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new AmenityDashboardController();
