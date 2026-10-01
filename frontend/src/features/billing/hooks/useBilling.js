import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchAdminKPIs,
  fetchMyDues,
  fetchInvoicesGrid,
  executeManualTrigger,
  submitOfflineSettlement,
  clearOfflineSettlement,
  rejectOfflineSettlement,
  sendInvoiceReminderThunk,
  recordCashPaymentThunk,
  fetchCashCollectionsThunk,
  searchCashEligibleThunk,
  payWithWallet,
  createRazorpayOrder,
  verifyRazorpaySignature,
  clearBillingError,
} from '../store/billingSlice.js'
import { fetchWalletBalance } from '../store/walletSlice.js'

/**
 * Custom Hook: useBilling
 *
 * Sole controller bridge between visual UI components and Redux Toolkit state.
 * Conforms to the "Thin View" pattern by encapsulating all dispatch actions.
 */
export const useBilling = () => {
  const dispatch = useDispatch()

  // 1. Selector mapping
  const { kpis, activeDues, invoicesList, pagination, loadingStates, error } = useSelector(
    (state) => state.billing,
  )
  const walletBalance = useSelector((state) => state.wallet?.balance || 0)
  const activeOrgId = useSelector((state) => state.workspace?.activeOrganizationId)

  // 2. Action dispatchers wrapped in useCallback to prevent unnecessary UI re-renders
  const loadAdminDashboard = useCallback(
    (communityId) => {
      const orgId = communityId || activeOrgId
      if (!orgId) {
        console.warn('loadAdminDashboard ignored: workspace communityId is undefined')
        return
      }
      return dispatch(fetchAdminKPIs(orgId))
    },
    [dispatch, activeOrgId],
  )

  const loadResidentDues = useCallback(() => {
    dispatch(fetchWalletBalance())
    return dispatch(fetchMyDues())
  }, [dispatch])

  const loadWalletBalance = useCallback(() => {
    return dispatch(fetchWalletBalance())
  }, [dispatch])

  const changeTablePage = useCallback(
    (pageNumber, filters = {}) => {
      return dispatch(
        fetchInvoicesGrid({
          page: pageNumber,
          limit: pagination.limit,
          filters,
        }),
      )
    },
    [dispatch, pagination.limit],
  )

  const triggerManualRun = useCallback(
    (assessmentId, periodString) => {
      return dispatch(
        executeManualTrigger({
          assessmentId,
          billingPeriodString: periodString,
        }),
      ).unwrap()
    },
    [dispatch],
  )

  const settleOffline = useCallback(
    (invoiceId, referenceData) => {
      return dispatch(
        submitOfflineSettlement({
          invoiceId,
          paymentReference: referenceData.paymentReference || referenceData.offlineReference,
          offlineReference: referenceData.paymentReference || referenceData.offlineReference,
          amountPaid:
            referenceData.amountPaid || referenceData.offlineAmount || referenceData.amount,
          amount: referenceData.amountPaid || referenceData.offlineAmount || referenceData.amount,
          paymentMethod: referenceData.paymentMethod || 'BANK_TRANSFER',
          paymentDate: referenceData.paymentDate,
          paymentScreenshot: referenceData.paymentScreenshot,
        }),
      ).unwrap()
    },
    [dispatch],
  )

  const approveOffline = useCallback(
    (invoiceId) => {
      return dispatch(clearOfflineSettlement(invoiceId)).unwrap()
    },
    [dispatch],
  )

  const rejectOffline = useCallback(
    (invoiceId, rejectionReason) => {
      return dispatch(rejectOfflineSettlement({ invoiceId, rejectionReason })).unwrap()
    },
    [dispatch],
  )

  const recordCash = useCallback(
    (invoiceId, amount) => {
      return dispatch(recordCashPaymentThunk({ invoiceId, amount })).unwrap()
    },
    [dispatch],
  )

  const fetchCollections = useCallback(() => {
    return dispatch(fetchCashCollectionsThunk()).unwrap()
  }, [dispatch])

  const searchCashEligibleInvoices = useCallback(
    (query) => {
      return dispatch(searchCashEligibleThunk(query)).unwrap()
    },
    [dispatch],
  )

  const payInvoiceWallet = useCallback(
    (invoiceId, amount) => {
      return dispatch(payWithWallet({ invoiceId, amount })).unwrap()
    },
    [dispatch],
  )

  const payInvoiceRazorpay = useCallback(
    (invoiceId, amount) => {
      return dispatch(createRazorpayOrder({ invoiceId, amount })).unwrap()
    },
    [dispatch],
  )

  const verifyRazorpay = useCallback(
    (verificationData) => {
      return dispatch(verifyRazorpaySignature(verificationData)).unwrap()
    },
    [dispatch],
  )

  const sendReminder = useCallback(
    (invoiceId) => {
      return dispatch(sendInvoiceReminderThunk(invoiceId)).unwrap()
    },
    [dispatch],
  )

  const resetBillingError = useCallback(() => {
    dispatch(clearBillingError())
  }, [dispatch])

  return {
    // Redux Slice states
    kpis,
    activeDues,
    invoicesList,
    pagination,
    loadingStates,
    error,
    walletBalance,
    activeOrgId,

    // Dispatcher methods
    loadAdminDashboard,
    loadResidentDues,
    loadWalletBalance,
    changeTablePage,
    triggerManualRun,
    settleOffline,
    approveOffline,
    rejectOffline,
    sendReminder,
    recordCash,
    fetchCollections,
    searchCashEligibleInvoices,
    payInvoiceWallet,
    payInvoiceRazorpay,
    verifyRazorpay,
    resetBillingError,
  }
}

export default useBilling
