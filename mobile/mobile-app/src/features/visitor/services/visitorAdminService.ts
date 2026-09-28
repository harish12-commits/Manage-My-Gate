import apiClient from '../../../services/apiClient';

export const visitorAdminService = {
  // 1. Fetch community-wide passes with optional filters (villaId, block, passType, search, page, limit)
  getCommunityPasses: async (orgId: string, params?: any) => {
    return await apiClient.get(`/visitor-pass/org/${orgId}`, { params });
  },

  // 2. Admin Override Pass Creation (for community event / vendor / resident override)
  createAdminOverridePass: async (payload: any) => {
    return await apiClient.post('/visitor-pass', payload);
  },

  // 3. Admin Force Revoke any pass with reason
  forceRevokePass: async (id: string, reason: string) => {
    return await apiClient.patch(`/visitor-pass/${id}/status`, { status: 'REVOKED', reason });
  },

  // 4. Admin Master Gate Approvals Stream
  getAllPendingWalkIns: async (orgId: string) => {
    return await apiClient.get(`/visitor-log/org/${orgId}/pending`);
  },

  // 5. Admin Override Walk-in Approval / Rejection
  adminResolveWalkIn: async (id: string, action: 'APPROVE' | 'REJECT', notes?: string) => {
    return await apiClient.patch(`/visitor-log/walk-in/${id}/resolve`, { action, notes });
  },

  // 6. Admin Gate Security Analytics & Check-in Trends
  getGateAnalytics: async (orgId: string, params?: any) => {
    return await apiClient.get(`/visitor-log/org/${orgId}/inside`, { params });
  },

  // 7. Community Visitor Blacklist Management
  getBlacklist: async (orgId: string) => {
    // The endpoint pages at 10 by default; the admin registry and its count need every entry.
    return await apiClient.get(`/blacklist/org/${orgId}`, { params: { page: 1, limit: 500 } });
  },

  addToBlacklist: async (payload: {
    orgId: string;
    visitorName?: string;
    name?: string;
    phone?: string;
    idProofNumber?: string;
    plate?: string;
    vehicleNumber?: string;
    reason: string;
  }) => {
    const formatted = {
      orgId: payload.orgId,
      name: payload.name || payload.visitorName || '',
      phone: payload.phone || undefined,
      idProofNumber: payload.idProofNumber || undefined,
      plate: payload.plate || payload.vehicleNumber || undefined,
      reason: payload.reason,
    };
    return await apiClient.post('/blacklist', formatted);
  },

  removeFromBlacklist: async (id: string) => {
    return await apiClient.delete(`/blacklist/${id}`);
  },

  // 8. Emergency Force Check-Out for stuck visitors inside
  forceCheckoutVisitor: async (logId: string, reason?: string) => {
    return await apiClient.patch(`/visitor-log/${logId}/checkout`, { reason });
  },
};

export default visitorAdminService;
