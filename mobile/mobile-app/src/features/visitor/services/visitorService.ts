import apiClient from '../../../services/apiClient';

export const visitorService = {
  createPass: async (payload: any) => {
    return await apiClient.post('/visitor-pass', payload);
  },

  getPassDetails: async (id: string) => {
    return await apiClient.get(`/visitor-pass/${id}`);
  },

  getPassByCode: async (code: string) => {
    return await apiClient.get(`/visitor-pass/code/${code}`);
  },

  updatePassStatus: async (id: string, status: string, reason?: string) => {
    return await apiClient.patch(`/visitor-pass/${id}/status`, { status, ...(reason ? { reason } : {}) });
  },

  getPasses: async (orgId: string, params?: any) => {
    return await apiClient.get(`/visitor-pass/org/${orgId}`, { params });
  },

  processPreApproved: async (payload: any) => {
    return await apiClient.post('/visitor-log/pre-approved', payload);
  },

  initiateWalkIn: async (payload: any) => {
    return await apiClient.post('/visitor-log/walk-in', payload);
  },

  resolveWalkIn: async (id: string, status: string) => {
    const action = status.toUpperCase();
    return await apiClient.patch(`/visitor-log/walk-in/${id}/resolve`, { action });
  },

  checkoutVisitor: async (id: string) => {
    return await apiClient.patch(`/visitor-log/${id}/checkout`);
  },

  getActiveVisitors: async (orgId: string) => {
    return await apiClient.get(`/visitor-log/org/${orgId}/inside`);
  },

  getHistoryLogs: async (orgId: string, params?: any) => {
    return await apiClient.get(`/visitor-log/org/${orgId}`, { params });
  },

  getWalkInBoard: async (orgId: string, since: string) => {
    return await apiClient.get(`/visitor-log/org/${orgId}/walk-ins`, { params: { since } });
  },

  getPendingApprovals: async (orgId: string) => {
    return await apiClient.get(`/visitor-log/org/${orgId}/pending`);
  },
};

export default visitorService;
