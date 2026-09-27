import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store/store';
import { useVisitorSocket } from './useVisitorSocket';
import { selectActiveOrgId } from '../../auth/store/authSelectors';
import visitorService from '../services/visitorService';
import {
  getPasses,
  getPassDetails,
  fetchPassByCode,
  createPass,
  updatePassStatus,
  clearPassStatus,
  setActivePass,
  fetchDashboardSummary,
  fetchPendingWalkIns,
  resolveWalkInRequest,
  fetchActiveVisitorsThunk,
  processPreApprovedThunk,
  checkoutVisitorThunk,
  VisitorPass,
} from '../store/visitorPassSlice';

export const useVisitorPass = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Activate real-time Visitor Management Socket.IO event listeners
  useVisitorSocket();

  // 1. Selector mapping
  const {
    passes,
    activePass,
    activeVisitors,
    activeVisitorsStatus,
    dashboard,
    walkIns,
    pagination,
    status,
    actionStatus,
    error,
  } = useSelector((state: RootState) => (state as any).visitorPass);

  // Retrieve organization ID using centralized selector
  const activeOrgId = useSelector(selectActiveOrgId);

  // 2. Action dispatchers wrapped in useCallback
  const fetchPasses = useCallback(
    (params?: any) => {
      const orgId = params?.orgId || activeOrgId;
      if (!orgId) {
        console.warn('Cannot fetch passes: organization context is not loaded.');
        return;
      }
      return dispatch(getPasses({ orgId, params }));
    },
    [dispatch, activeOrgId]
  );

  const fetchDashboardData = useCallback(
    (orgIdParam?: string) => {
      const orgId = orgIdParam || activeOrgId;
      if (!orgId) {
        console.warn('Cannot fetch dashboard summary: organization context is not loaded.');
        return;
      }
      return dispatch(fetchDashboardSummary(orgId));
    },
    [dispatch, activeOrgId]
  );

  const loadPendingWalkIns = useCallback(
    (orgIdParam?: string) => {
      const orgId = orgIdParam || activeOrgId;
      if (!orgId) {
        console.warn('Cannot fetch pending walk-ins: organization context is not loaded.');
        return;
      }
      return dispatch(fetchPendingWalkIns(orgId));
    },
    [dispatch, activeOrgId]
  );

  const resolveWalkIn = useCallback(
    (id: string, action: 'APPROVE' | 'REJECT') => {
      return dispatch(resolveWalkInRequest({ id, action }));
    },
    [dispatch]
  );

  const fetchPassDetails = useCallback(
    (codeOrId: string) => {
      const clean = (codeOrId || '')
        .trim()
        .replace(
          /^MMG[:\-_](GUEST|GROUP|CAB|DELIVERY|SERVICE|STAFF|AUTO|TAXI|VISITOR|RESIDENT|AMENITY|VIS|RES)[:\-_]/i,
          ''
        );
      const parts = clean.split(/[:\-_]/);
      const targetCode = parts[0] || clean;
      const targetId = parts[1];

      if (targetId && /^[0-9a-fA-F]{24}$/.test(targetId)) {
        return dispatch(getPassDetails(targetId));
      }
      if (/^[0-9a-fA-F]{24}$/.test(targetCode)) {
        return dispatch(getPassDetails(targetCode));
      }
      return dispatch(fetchPassByCode(targetCode));
    },
    [dispatch]
  );

  const createNewPass = useCallback(
    (payload: any) => {
      const orgId = payload?.orgId || activeOrgId;
      const enrichedPayload = { ...payload, orgId };
      return dispatch(createPass(enrichedPayload));
    },
    [dispatch, activeOrgId]
  );

  const revokePass = useCallback(
    (id: string) => {
      return dispatch(updatePassStatus({ id, status: 'REVOKED' }));
    },
    [dispatch]
  );

  const resetPassStatus = useCallback(() => {
    dispatch(clearPassStatus());
  }, [dispatch]);

  const selectPass = useCallback(
    (pass: VisitorPass | null) => {
      dispatch(setActivePass(pass));
    },
    [dispatch]
  );

  const submitWalkIn = useCallback(
    async (payload: any) => {
      const orgId = payload?.orgId || activeOrgId;
      return await visitorService.initiateWalkIn({ ...payload, orgId });
    },
    [activeOrgId]
  );

  const fetchActiveVisitors = useCallback(
    async (orgIdParam?: string) => {
      const orgId = orgIdParam || activeOrgId;
      if (!orgId) return [];
      const res = await dispatch(fetchActiveVisitorsThunk(orgId));
      return (res as any)?.payload || [];
    },
    [dispatch, activeOrgId]
  );

  const processPreApproved = useCallback(
    async (payload: any) => {
      const orgId = payload?.orgId || activeOrgId;
      const res = await dispatch(processPreApprovedThunk({ ...payload, orgId }));
      // Gate decisions must fail loudly: a refused entry is never reported as admitted.
      if (processPreApprovedThunk.rejected.match(res)) {
        throw new Error(String(res.payload || 'Failed to check in visitor'));
      }
      return res.payload;
    },
    [dispatch, activeOrgId]
  );

  const checkoutVisitor = useCallback(
    async (logId: string) => {
      const res = await dispatch(checkoutVisitorThunk(logId));
      if (checkoutVisitorThunk.rejected.match(res)) {
        throw new Error(String(res.payload || 'Failed to checkout visitor'));
      }
      return res.payload;
    },
    [dispatch]
  );

  return {
    // State properties
    passes,
    activePass,
    activeVisitors,
    activeVisitorsStatus,
    dashboard,
    walkIns,
    pagination,
    status,
    actionStatus,
    error,

    // Dispatcher methods
    fetchPasses,
    fetchDashboardData,
    loadPendingWalkIns,
    resolveWalkIn,
    fetchPassDetails,
    createNewPass,
    revokePass,
    resetPassStatus,
    selectPass,
    setActivePass: selectPass,
    submitWalkIn,
    fetchActiveVisitors,
    processPreApproved,
    checkoutVisitor,
  };
};

export default useVisitorPass;
