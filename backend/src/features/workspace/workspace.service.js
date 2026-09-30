import workspaceRepository from './workspace.repository.js';
import workspaceEvents from './workspace.events.js';
import HttpError from '../../utils/httpError.utils.js';
import Organization from '../organization/organization.model.js';
import User from '../user/user.model.js';
import mongoose from 'mongoose';
import Workspace from './workspace.model.js';

export const DEFAULT_MODULES = [
  { moduleName: 'Visitor Management', moduleKey: 'visitor', route: '/visitor', icon: 'QrCode', displayOrder: 1, enabled: true, sidebarVisible: true },
  { moduleName: 'Administration & Security', moduleKey: 'administration_security', route: '/admin', icon: 'ShieldCheck', displayOrder: 2, enabled: true, sidebarVisible: true },
  { moduleName: 'Amenities & Bookings', moduleKey: 'amenities', route: '/amenities', icon: 'Building', displayOrder: 6, enabled: true, sidebarVisible: true },
  { moduleName: 'Notice Board', moduleKey: 'notices', route: '/notices', icon: 'List', displayOrder: 7, enabled: true, sidebarVisible: true },
  { moduleName: 'Complaints / Maintenance', moduleKey: 'complaints', route: '/complaints', icon: 'Warning', displayOrder: 8, enabled: true, sidebarVisible: true },
  { moduleName: 'Billing & Invoices', moduleKey: 'billing', route: '/billing', icon: 'Speedometer', displayOrder: 9, enabled: true, sidebarVisible: true }
];

export class WorkspaceService {
  async createWorkspace(workspaceData, actorId, session = null) {
    const { workspaceName, organizationId } = workspaceData;

    // Check organization exists
    const org = await Organization.findById(organizationId).session(session);
    if (!org) {
      throw new HttpError(404, 'Organization not found.');
    }

    // Check name uniqueness in organization
    const existing = await workspaceRepository.findOne({ workspaceName, organizationId }, session);
    if (existing) {
      throw new HttpError(409, 'Workspace already exists.');
    }

    // Assign default modules and metadata
    const workspacePayload = {
      ...workspaceData,
      organizationName: workspaceData.organizationName || org.name,
      createdBy: actorId,
      modules: DEFAULT_MODULES,
      activityLogs: [
        {
          action: 'Workspace Created',
          performedBy: actorId,
          details: `Workspace "${workspaceName}" created and seeded with default modules.`,
        }
      ]
    };

    const workspace = await workspaceRepository.create(workspacePayload, session);

    workspaceEvents.emit('WORKSPACE_CREATED', {
      actorId,
      targetId: workspace._id,
      workspaceName,
    });

    return workspace;
  }

  async getWorkspaceById(id, orgId = null, isPlatform = false, session = null) {
    let workspace;
    if (id === 'current' && orgId) {
      workspace = await workspaceRepository.findOne({ organizationId: orgId }, session);
    } else {
      workspace = await workspaceRepository.findById(id, session);
    }
    
    if (!workspace) {
      throw new HttpError(404, `Workspace with ID ${id} not found.`);
    }

    // Tenant check
    if (!isPlatform && orgId && (!workspace.organizationId || workspace.organizationId.toString() !== orgId.toString())) {
      throw new HttpError(403, 'Forbidden. You do not have access to this workspace.');
    }

    // Self-healing: backfill organizationName if missing
    if (!workspace.organizationName && workspace.organizationId) {
      const org = await Organization.findById(workspace.organizationId).session(session);
      if (org) {
        workspace.organizationName = org.name;
        await workspace.save({ validateBeforeSave: false });
      }
    }

    // Self-healing: backfill missing default modules and prune legacy standalone modules
    const LEGACY_STANDALONE_MODULE_KEYS = ['villas', 'users', 'roles', 'integrations', 'financial_suit', 'financials'];
    if (workspace && Array.isArray(DEFAULT_MODULES)) {
      let modified = false;
      if (!workspace.modules) {
        workspace.modules = [];
        modified = true;
      }
      if (workspace.modules.some(m => LEGACY_STANDALONE_MODULE_KEYS.includes(m.moduleKey))) {
        workspace.modules = workspace.modules.filter(m => !LEGACY_STANDALONE_MODULE_KEYS.includes(m.moduleKey));
        modified = true;
      }
      for (const defaultMod of DEFAULT_MODULES) {
        const exists = workspace.modules.some(m => m.moduleKey === defaultMod.moduleKey);
        if (!exists) {
          workspace.modules.push({ ...defaultMod });
          modified = true;
        }
      }
      if (modified) {
        await workspace.save({ validateBeforeSave: false });
      }
    }

    return workspace;
  }

  async getWorkspaces(orgId = null, isPlatform = false, session = null) {
    const query = !isPlatform && orgId ? { organizationId: orgId } : {};
    return await workspaceRepository.find(query, session);
  }

  async updateWorkspace(id, updateData, orgId = null, isPlatform = false, actorId, session = null) {
    const workspace = await this.getWorkspaceById(id, orgId, isPlatform, session);

    if (updateData.workspaceName && updateData.workspaceName !== workspace.workspaceName) {
      // Check name uniqueness
      const existing = await workspaceRepository.findOne({
        workspaceName: updateData.workspaceName,
        organizationId: workspace.organizationId
      }, session);
      if (existing) {
        throw new HttpError(409, 'Workspace already exists.');
      }
    }

    // Sync Organization Name
    if (updateData.organizationName && workspace.organizationId) {
      const organizationService = (await import('../organization/organization.services.js')).default;
      await organizationService.updateOrganizationName(workspace.organizationId.toString(), updateData.organizationName, session);
    }

    const payload = {
      ...updateData,
      updatedBy: actorId,
    };

    const updated = await workspaceRepository.update(id, payload, session);

    await workspaceRepository.addActivityLog(id, {
      action: 'Workspace Updated',
      performedBy: actorId,
      details: 'Workspace general details updated.',
    }, session);

    workspaceEvents.emit('WORKSPACE_UPDATED', {
      actorId,
      targetId: id,
      updateData,
    });

    return updated;
  }

  async deleteWorkspace(id, orgId = null, isPlatform = false, actorId, session = null) {
    const workspace = await this.getWorkspaceById(id, orgId, isPlatform, session);

    await workspaceRepository.delete(id, session);

    workspaceEvents.emit('WORKSPACE_DELETED', {
      actorId,
      targetId: id,
      workspaceName: workspace.workspaceName,
    });

    return { message: 'Workspace deleted successfully.' };
  }

  // --- Modules Management ---

  async getWorkspaceModules(workspaceId, orgId = null, isPlatform = false, session = null) {
    const workspace = await this.getWorkspaceById(workspaceId, orgId, isPlatform, session);
    return workspace.modules || [];
  }

  async addModule(workspaceId, orgId = null, isPlatform = false, moduleData, actorId, session = null) {
    const workspace = await this.getWorkspaceById(workspaceId, orgId, isPlatform, session);

    // Prevent duplicates on moduleKey or route or icon
    const keyDup = workspace.modules.find(m => m.moduleKey === moduleData.moduleKey);
    if (keyDup) throw new HttpError(400, 'A module with this key already exists in the workspace.');

    const routeDup = workspace.modules.find(m => m.route === moduleData.route);
    if (routeDup) throw new HttpError(400, 'A module with this route already exists in the workspace.');

    const actualWorkspaceId = workspace._id;
    const updated = await workspaceRepository.addModule(actualWorkspaceId, moduleData, session);

    await workspaceRepository.addActivityLog(actualWorkspaceId, {
      action: 'Module Added',
      performedBy: actorId,
      details: `Module "${moduleData.moduleName}" added.`,
    }, session);

    workspaceEvents.emit('MODULE_ADDED', {
      actorId,
      targetId: workspaceId,
      moduleKey: moduleData.moduleKey,
    });

    return updated.modules;
  }

  async updateModule(workspaceId, orgId = null, isPlatform = false, moduleId, moduleData, actorId, session = null) {
    const workspace = await this.getWorkspaceById(workspaceId, orgId, isPlatform, session);

    const isMongoId = mongoose.Types.ObjectId.isValid(moduleId);
    const targetModule = (isMongoId ? workspace.modules.id(moduleId) : null) || workspace.modules.find(m => m.moduleKey === moduleId || m._id?.toString() === moduleId);
    if (!targetModule) throw new HttpError(404, 'Module not found.');

    // Prevent duplicates
    if (moduleData.moduleKey && moduleData.moduleKey !== targetModule.moduleKey) {
      if (workspace.modules.find(m => m.moduleKey === moduleData.moduleKey)) {
        throw new HttpError(400, 'A module with this key already exists.');
      }
    }
    if (moduleData.route && moduleData.route !== targetModule.route) {
      if (workspace.modules.find(m => m.route === moduleData.route)) {
        throw new HttpError(400, 'A module with this route already exists.');
      }
    }

    const actualWorkspaceId = workspace._id;
    const lookupId = targetModule._id ? targetModule._id.toString() : targetModule.moduleKey;
    const updated = await workspaceRepository.updateModule(actualWorkspaceId, lookupId, moduleData, session);

    await workspaceRepository.addActivityLog(actualWorkspaceId, {
      action: 'Module Updated',
      performedBy: actorId,
      details: `Module "${targetModule.moduleName}" updated.`,
    }, session);

    workspaceEvents.emit('MODULE_UPDATED', {
      actorId,
      targetId: workspaceId,
      moduleKey: targetModule.moduleKey,
    });

    return updated.modules;
  }

  async toggleModule(workspaceId, orgId = null, isPlatform = false, moduleId, enabled, actorId, session = null) {
    const workspace = await this.getWorkspaceById(workspaceId, orgId, isPlatform, session);
    const isMongoId = mongoose.Types.ObjectId.isValid(moduleId);
    const targetModule = (isMongoId ? workspace.modules.id(moduleId) : null) || workspace.modules.find(m => m.moduleKey === moduleId || m._id?.toString() === moduleId);
    if (!targetModule) throw new HttpError(404, 'Module not found.');

    const actualWorkspaceId = workspace._id;
    const lookupId = targetModule._id ? targetModule._id.toString() : targetModule.moduleKey;
    const updated = await workspaceRepository.updateModule(actualWorkspaceId, lookupId, { enabled }, session);

    const actionText = enabled ? 'Module Enabled' : 'Module Disabled';
    await workspaceRepository.addActivityLog(actualWorkspaceId, {
      action: actionText,
      performedBy: actorId,
      details: `Module "${targetModule.moduleName}" status toggled to ${enabled}.`,
    }, session);

    workspaceEvents.emit(enabled ? 'MODULE_ENABLED' : 'MODULE_DISABLED', {
      actorId,
      targetId: workspaceId,
      moduleKey: targetModule.moduleKey,
    });

    // We must return the filtered modules so the frontend state doesn't suddenly show disabled modules
    const result = await this.getCurrentWorkspaceModules(orgId || workspace.organizationId, actorId);
    return result; // Returns { modules, allModules }
  }

  async reorderModules(workspaceId, orgId = null, isPlatform = false, orders, actorId, session = null) {
    // orders = [{ moduleId: '...', displayOrder: 1 }]
    const workspace = await this.getWorkspaceById(workspaceId, orgId, isPlatform, session);

    const modulesList = workspace.modules.toObject();
    orders.forEach(ord => {
      const target = modulesList.find(m => (m._id && m._id.toString() === ord.moduleId) || m.moduleKey === ord.moduleId);
      if (target) {
        target.displayOrder = ord.displayOrder;
      }
    });

    // Sort by displayOrder
    modulesList.sort((a, b) => a.displayOrder - b.displayOrder);

    const actualWorkspaceId = workspace._id;
    const updated = await workspaceRepository.reorderModules(actualWorkspaceId, modulesList, session);

    await workspaceRepository.addActivityLog(actualWorkspaceId, {
      action: 'Module Reordered',
      performedBy: actorId,
      details: 'Workspace modules order updated.',
    }, session);

    workspaceEvents.emit('MODULES_REORDERED', {
      actorId,
      targetId: workspaceId,
    });

    return updated.modules;
  }

  async deleteModule(workspaceId, orgId = null, isPlatform = false, moduleId, actorId, session = null) {
    const workspace = await this.getWorkspaceById(workspaceId, orgId, isPlatform, session);
    const isMongoId = mongoose.Types.ObjectId.isValid(moduleId);
    const targetModule = (isMongoId ? workspace.modules.id(moduleId) : null) || workspace.modules.find(m => m.moduleKey === moduleId || m._id?.toString() === moduleId);
    if (!targetModule) throw new HttpError(404, 'Module not found.');

    const actualWorkspaceId = workspace._id;
    const lookupId = targetModule._id ? targetModule._id.toString() : targetModule.moduleKey;
    const updated = await workspaceRepository.deleteModule(actualWorkspaceId, lookupId, session);

    await workspaceRepository.addActivityLog(actualWorkspaceId, {
      action: 'Module Deleted',
      performedBy: actorId,
      details: `Module "${targetModule.moduleName}" deleted.`,
    }, session);

    workspaceEvents.emit('MODULE_DELETED', {
      actorId,
      targetId: workspaceId,
      moduleKey: targetModule.moduleKey,
    });

    return updated.modules;
  }

  // --- Settings & Activity Logs ---

  async getSettings(workspaceId, orgId = null, isPlatform = false, session = null) {
    const workspace = await this.getWorkspaceById(workspaceId, orgId, isPlatform, session);
    return workspace.settings || {};
  }

  async updateSettings(workspaceId, orgId = null, isPlatform = false, settingsData, actorId, session = null) {
    const workspace = await this.getWorkspaceById(workspaceId, orgId, isPlatform, session);
    
    const actualWorkspaceId = workspace._id;
    const updated = await workspaceRepository.update(actualWorkspaceId, { settings: settingsData }, session);

    // The community's phone default country lives on the organization so every role receives it at login.
    const orgIdForCountry = workspace.organizationId || orgId;
    if (/^[A-Za-z]{2}$/.test(settingsData?.countryCode || '') && orgIdForCountry) {
      const Organization = (await import('../organization/organization.model.js')).default;
      await Organization.updateOne(
        { _id: orgIdForCountry },
        { $set: { countryCode: String(settingsData.countryCode).toUpperCase() } },
        { session }
      );
    }

    await workspaceRepository.addActivityLog(actualWorkspaceId, {
      action: 'Settings Updated',
      performedBy: actorId,
      details: 'Workspace settings updated.',
    }, session);

    workspaceEvents.emit('SETTINGS_UPDATED', {
      actorId,
      targetId: workspaceId,
    });

    return updated.settings;
  }

  async getActivityLogs(workspaceId, orgId = null, isPlatform = false, session = null) {
    const workspace = await this.getWorkspaceById(workspaceId, orgId, isPlatform, session);
    return workspace.activityLogs || [];
  }

  // --- Current Workspace bootstrap (self-healing) ---

  async getCurrentWorkspaceModules(orgId, actorId, session = null) {
    if (!orgId) return { modules: [], subscriptionStatus: 'ACTIVE', accessGranted: true };

    const org = await Organization.findById(orgId).session(session);
    let workspace = await workspaceRepository.findOne({ organizationId: orgId }, session);
    if (!workspace) {
      // Self-healing bootstrap: Get organization name and create workspace
      const name = org ? org.name : 'Default Workspace';
      
      try {
        workspace = await this.createWorkspace({
          workspaceName: `${name} Workspace`,
          description: 'Auto-bootstrapped workspace context.',
          organizationId: orgId,
          status: 'Active',
        }, actorId, session);
      } catch (err) {
        if (err.status === 409 || err.code === 11000) {
          workspace = await workspaceRepository.findOne({ organizationId: orgId }, session);
          if (!workspace) throw err;
        } else {
          throw err;
        }
      }
    } else if (workspace && Array.isArray(DEFAULT_MODULES)) {
      let modified = false;
      if (!workspace.modules) {
        workspace.modules = [];
        modified = true;
      }
      const LEGACY_KEYS = ['villas', 'users', 'roles', 'integrations', 'financial_suit', 'financials'];
      if (workspace.modules.some(m => LEGACY_KEYS.includes(m.moduleKey))) {
        workspace.modules = workspace.modules.filter(m => !LEGACY_KEYS.includes(m.moduleKey));
        modified = true;
      }
      for (const defaultMod of DEFAULT_MODULES) {
        const exists = workspace.modules.some(m => m.moduleKey === defaultMod.moduleKey);
        if (!exists) {
          workspace.modules.push({ ...defaultMod });
          modified = true;
        }
      }
      if (modified) {
        await workspace.save({ validateBeforeSave: false });
      }
    }

    const platformSubscriptionService = (await import('../platformSubscription/platformSubscription.service.js')).default;
    const subEval = await platformSubscriptionService.checkAndEvaluateSubscriptionStatus(orgId);

    const allowed = org?.allowedFeatures || [];
    const isPlatform = org?.isPlatform || false;
    const LEGACY_KEYS = ['villas', 'users', 'roles', 'integrations', 'financial_suit', 'financials'];

    // Filter all allowed modules (whether enabled or not), strictly excluding legacy standalone module keys
    const allowedModules = (workspace.modules || [])
      .filter(m => !LEGACY_KEYS.includes(m.moduleKey))
      .filter(m => {
        if (isPlatform || !allowed || allowed.length === 0) return true;
        if (m.moduleKey === 'administration_security') return true;
        if (allowed.includes(m.moduleKey) || allowed.includes(m.moduleName)) return true;
        if (m.moduleKey === 'amenities') {
          return allowed.some(a => ['amenities', 'booking', 'amenity', 'amenitiesBooking', 'amenityBooking'].includes(a));
        }
        // Always allow standard default modules
        if (DEFAULT_MODULES.some(d => d.moduleKey === m.moduleKey)) return true;
        return false;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);

    // Enabled modules for sidebar/dashboard usage
    const enabledModules = allowedModules.filter(m => m.enabled);

    if (!isPlatform && !subEval.accessGranted) {
      return {
        modules: [],
        allModules: allowedModules,
        subscriptionStatus: subEval.status,
        accessGranted: false,
        reason: subEval.reason,
        subscription: subEval.subscription
      };
    }

    return {
      modules: enabledModules,
      allModules: allowedModules,
      subscriptionStatus: subEval.status,
      accessGranted: true,
      subscription: subEval.subscription
    };
  }
}

export default new WorkspaceService();
