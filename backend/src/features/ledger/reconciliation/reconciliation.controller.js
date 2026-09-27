import historicalInventoryService from './historicalInventory.service.js';
import historicalReconciliationService from './historicalReconciliation.service.js';
import reconciliationReportService from './reconciliationReport.service.js';
import financialIntegrityService from '../financialIntegrity.service.js';
import financialMetricsService from '../financialMetrics.service.js';

export class ReconciliationController {
  async getIntegrity(req, res, next) {
    try {
      const orgId = req.query.orgId || null;
      const report = await financialIntegrityService.runIntegrityCheck(orgId);
      res.status(200).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }

  async getMetrics(req, res, next) {
    try {
      const orgId = req.query.orgId || null;
      const metrics = await financialMetricsService.getMetrics(orgId);
      res.status(200).json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  }

  async getInventory(req, res, next) {
    try {
      const orgId = req.query.orgId || null;
      const inventory = await historicalInventoryService.getInventory(orgId);
      res.status(200).json({ success: true, data: inventory });
    } catch (err) {
      next(err);
    }
  }

  async runReconciliation(req, res, next) {
    try {
      const { orgId, mode, allowGenesis, domains } = req.body;
      const result = await historicalReconciliationService.reconcile({
        orgId,
        mode,
        allowGenesis,
        domains,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async verifyInvariants(req, res, next) {
    try {
      const orgId = req.query.orgId || null;
      const report = await reconciliationReportService.verifyFinancialInvariants(orgId);
      res.status(200).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }

  async getRunReport(req, res, next) {
    try {
      const { runId } = req.params;
      const report = await reconciliationReportService.getRunReport(runId);
      if (!report) {
        return res.status(404).json({ success: false, message: `Run report ${runId} not found` });
      }
      res.status(200).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }

  async getExceptions(req, res, next) {
    try {
      const { orgId, status, domain, limit, skip } = req.query;
      const data = await historicalReconciliationService.getExceptions({
        orgId,
        status,
        domain,
        limit: limit ? Number(limit) : 50,
        skip: skip ? Number(skip) : 0,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateException(req, res, next) {
    try {
      const { exceptionId } = req.params;
      const { status, resolutionNotes } = req.body;
      const resolvedBy = req.user?._id || req.user?.id || null;

      const updated = await historicalReconciliationService.updateException(exceptionId, {
        status,
        resolutionNotes,
        resolvedBy,
      });
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
}

export const reconciliationController = new ReconciliationController();
export default reconciliationController;
