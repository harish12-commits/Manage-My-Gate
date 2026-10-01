import { useSelector, useDispatch } from 'react-redux'
import { downloadInvoicePdf } from '../services/platformBillingService'
import {
  setSelectedLeadId,
  setActiveTab,
  setActivePage,
  fetchLeadsThunk,
  fetchMasterPricingThunk,
  saveMasterPricingThunk,
  fetchQuotesThunk,
  generateQuoteThunk,
  fetchOrdersThunk,
  fetchInvoicesThunk,
  fetchSubscriptionsThunk,
  fetchJobsThunk,
  createInquiryThunk,
} from '../store/platformBillingSlice'

export const usePlatformBilling = () => {
  const dispatch = useDispatch()

  // Extract raw state from the Redux store
  const rawState = useSelector((state) => state.platformBilling)

  const toSafeArray = (arr) => {
    if (!arr) return []
    if (Array.isArray(arr)) return arr
    if (arr.data && Array.isArray(arr.data)) return arr.data
    if (arr.docs && Array.isArray(arr.docs)) return arr.docs
    return []
  }

  const activePage = rawState.activePage
  const activeTab = rawState.activeTab
  const selectedLeadId = rawState.selectedLeadId
  const isLoading = rawState.isLoading
  const error = rawState.error

  const leads = toSafeArray(rawState.leads)
  const pricingPlans = toSafeArray(rawState.pricingPlans)
  const quotes = toSafeArray(rawState.quotes)
  const orders = toSafeArray(rawState.orders)
  const invoices = toSafeArray(rawState.invoices)
  const subscriptions = toSafeArray(rawState.subscriptions)
  const jobs = toSafeArray(rawState.jobs)

  // Compute derived state
  const selectedLead =
    leads.find((lead) => lead._id === selectedLeadId || lead.id === selectedLeadId) || null

  // Bind Actions to Dispatch
  const selectLead = (id) => {
    dispatch(setSelectedLeadId(id))
  }

  const changeTab = (tabName) => {
    dispatch(setActiveTab(tabName))
  }

  const changePage = (pageName) => {
    dispatch(setActivePage(pageName))
  }

  const fetchAllData = () => {
    dispatch(fetchLeadsThunk())
    dispatch(fetchMasterPricingThunk())
    dispatch(fetchQuotesThunk())
    dispatch(fetchOrdersThunk())
    dispatch(fetchInvoicesThunk())
    dispatch(fetchSubscriptionsThunk())
    dispatch(fetchJobsThunk())
  }

  const savePlan = async (plan) => {
    return await dispatch(saveMasterPricingThunk(plan)).unwrap()
  }

  const togglePlan = async (id, currentPlan) => {
    const updatedPlan = {
      ...currentPlan,
      status: currentPlan.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
    }
    return await dispatch(saveMasterPricingThunk(updatedPlan)).unwrap()
  }

  const fetchLeads = () => {
    dispatch(fetchLeadsThunk())
  }

  const dispatchQuote = async (quoteData) => {
    // Return the promise so the component can .unwrap() it for toast notifications
    return await dispatch(generateQuoteThunk(quoteData)).unwrap()
  }

  const createInquiry = async (inquiryData) => {
    return await dispatch(createInquiryThunk(inquiryData)).unwrap()
  }

  const downloadPdf = async (invoiceId) => {
    return await downloadInvoicePdf(invoiceId)
  }

  return {
    // Raw State
    activePage,
    leads,
    selectedLeadId,
    activeTab,
    isLoading,
    error,
    pricingPlans,
    quotes,
    orders,
    invoices,
    subscriptions,
    jobs,

    // Derived State
    selectedLead,

    // Actions
    selectLead,
    changeTab,
    changePage,
    togglePlan,
    savePlan,
    fetchLeads,
    fetchAllData,
    dispatchQuote,
    createInquiry,
    downloadPdf,

    // Legacy support bindings for CrmWorkspaceView compatibility
    setSelectedLeadId: selectLead,
    setActiveTab: changeTab,
  }
}
