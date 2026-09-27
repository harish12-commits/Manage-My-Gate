import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store/store';
import { useAppSocket } from '../../../hooks/useAppSocket';
import { syncRealtimeInvoice, fetchMyDues, fetchAdminKPIs, fetchInvoicesGrid } from '../store/billingSlice';
import { fetchWalletBalance, syncWalletBalance } from '../../wallet/store/walletSlice';
import { checkIsAdmin } from '../../../utils/rbac';

/**
 * Custom Hook: useBillingSocket
 *
 * Silent background listener that manages the real-time Socket.io connections
 * and event listeners for invoice billing & wallet balance updates.
 * Conforms to the "Thin View" pattern by encapsulating all socket logic.
 *
 * Features:
 * 1. Community Isolation: Only updates dues and active invoices if the event belongs to the active community.
 * 2. RBAC Guard: Restricts admin-only calls (fetchAdminKPIs, fetchInvoicesGrid) to authorized admin roles.
 */
export const useBillingSocket = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { socket } = useAppSocket();

  const user = useSelector((state: RootState) => state.auth?.user);
  const activeOrgId = useSelector((state: any) =>
    state.workspace?.activeOrganizationId ||
    state.auth?.activeOrganizationId ||
    state.auth?.user?.activeOrganizationId ||
    state.auth?.user?.orgId ||
    state.auth?.user?.communityId
  );
  const userId = user?.id || user?._id;
  const orgId = activeOrgId || user?.orgId;

  const permissions: string[] = user?.permissions || [];
  const canManageAdminBilling = useMemo(() => {
    return (
      checkIsAdmin(user) ||
      permissions.includes('billing:dashboard') ||
      permissions.includes('billing:assessment_manager') ||
      permissions.includes('*')
    );
  }, [user, permissions]);

  const rooms = useMemo(() => {
    const list: string[] = [];
    if (userId) list.push(`user:${userId}`);
    if (orgId) list.push(`org:${orgId}`);
    return list;
  }, [userId, orgId]);

  useEffect(() => {
    if (!socket) return;

    // Join rooms dynamically for targeted real-time broadcasts
    rooms.forEach((room) => {
      socket.emit('join_room', room);
    });

    // Helper: Verify if an incoming event belongs to the currently active community
    const isEventForCurrentCommunity = (payload: any) => {
      if (!orgId) return true;
      const eventCommunityId =
        payload?.communityId?._id ||
        payload?.communityId?.id ||
        payload?.communityId ||
        payload?.orgId?._id ||
        payload?.orgId?.id ||
        payload?.orgId;
      if (!eventCommunityId) return true;
      return String(eventCommunityId) === String(orgId);
    };

    // 1. Invoice Generation Handler
    const handleInvoiceGenerated = (payload: any) => {
      console.log('[Billing Socket] Real-time event: invoice_generated', payload);
      const isCurrentCommunity = isEventForCurrentCommunity(payload);
      if (payload && isCurrentCommunity) {
        dispatch(syncRealtimeInvoice(payload));
      }
      if (isCurrentCommunity) {
        dispatch(fetchMyDues(orgId));
      }
      if (orgId && canManageAdminBilling) {
        dispatch(fetchAdminKPIs(orgId));
        dispatch(fetchInvoicesGrid({ page: 1, limit: 10, filters: { communityId: orgId } }));
      }
    };

    // 2. Invoice Status Update Handler
    const handleInvoiceStatusUpdated = (payload: any) => {
      console.log('[Billing Socket] Real-time event: invoice_status_updated / INVOICE_UPDATED', payload);
      const isCurrentCommunity = isEventForCurrentCommunity(payload);
      if (payload && isCurrentCommunity) {
        dispatch(syncRealtimeInvoice(payload));
      }
      if (isCurrentCommunity) {
        dispatch(fetchMyDues(orgId));
      }
      if (orgId && canManageAdminBilling) {
        dispatch(fetchAdminKPIs(orgId));
        dispatch(fetchInvoicesGrid({ page: 1, limit: 10, filters: { communityId: orgId } }));
      }
    };

    // 3. Payment Success Handler
    const handlePaymentSuccess = (payload: any) => {
      console.log('[Billing Socket] Real-time event: PAYMENT_SUCCESS', payload);
      const isCurrentCommunity = isEventForCurrentCommunity(payload?.invoice || payload);
      if (payload?.invoice && isCurrentCommunity) {
        dispatch(syncRealtimeInvoice(payload.invoice));
      }
      if (isCurrentCommunity) {
        dispatch(fetchMyDues(orgId));
      }
      dispatch(fetchWalletBalance());
      if (orgId && canManageAdminBilling) {
        dispatch(fetchAdminKPIs(orgId));
        dispatch(fetchInvoicesGrid({ page: 1, limit: 10, filters: { communityId: orgId } }));
      }
    };

    // 4. Digital Wallet Update Handler
    const handleWalletUpdated = (payload: any) => {
      console.log('[Billing Socket] Real-time event: WALLET_UPDATED / walletUpdated', payload);
      if (payload) {
        dispatch(syncWalletBalance(payload));
      }
      dispatch(fetchWalletBalance());
      dispatch(fetchMyDues(orgId));
    };

    // 5. Offline Payment Submission Handler
    const handleOfflinePaymentSubmitted = (payload: any) => {
      console.log('[Billing Socket] Real-time event: offline_payment_submitted', payload);
      const isCurrentCommunity = isEventForCurrentCommunity(payload?.invoice || payload);
      if (payload?.invoice && isCurrentCommunity) {
        dispatch(syncRealtimeInvoice(payload.invoice));
      }
      if (orgId && canManageAdminBilling) {
        dispatch(fetchAdminKPIs(orgId));
        dispatch(fetchInvoicesGrid({ page: 1, limit: 10, filters: { communityId: orgId } }));
      }
    };

    // Register event listeners
    socket.on('invoice_generated', handleInvoiceGenerated);
    socket.on('invoice_status_updated', handleInvoiceStatusUpdated);
    socket.on('INVOICE_UPDATED', handleInvoiceStatusUpdated);
    socket.on('INVOICE_STATUS_UPDATED', handleInvoiceStatusUpdated);
    socket.on('offline_payment_approved', handleInvoiceStatusUpdated);
    socket.on('bank_transfer_rejected', handleInvoiceStatusUpdated);
    socket.on('cash_payment_recorded', handleInvoiceStatusUpdated);
    socket.on('invoice_paid', handleInvoiceStatusUpdated);
    socket.on('PAYMENT_SUCCESS', handlePaymentSuccess);
    socket.on('WALLET_UPDATED', handleWalletUpdated);
    socket.on('walletUpdated', handleWalletUpdated);
    socket.on('wallet_updated', handleWalletUpdated);
    socket.on('wallet_transaction_created', handleWalletUpdated);
    socket.on('offline_payment_submitted', handleOfflinePaymentSubmitted);

    // Lifecycle Cleanup
    return () => {
      socket.off('invoice_generated', handleInvoiceGenerated);
      socket.off('invoice_status_updated', handleInvoiceStatusUpdated);
      socket.off('INVOICE_UPDATED', handleInvoiceStatusUpdated);
      socket.off('INVOICE_STATUS_UPDATED', handleInvoiceStatusUpdated);
      socket.off('offline_payment_approved', handleInvoiceStatusUpdated);
      socket.off('bank_transfer_rejected', handleInvoiceStatusUpdated);
      socket.off('cash_payment_recorded', handleInvoiceStatusUpdated);
      socket.off('invoice_paid', handleInvoiceStatusUpdated);
      socket.off('PAYMENT_SUCCESS', handlePaymentSuccess);
      socket.off('WALLET_UPDATED', handleWalletUpdated);
      socket.off('walletUpdated', handleWalletUpdated);
      socket.off('wallet_updated', handleWalletUpdated);
      socket.off('wallet_transaction_created', handleWalletUpdated);
      socket.off('offline_payment_submitted', handleOfflinePaymentSubmitted);
    };
  }, [socket, dispatch, rooms, orgId, canManageAdminBilling]);
};

export default useBillingSocket;

