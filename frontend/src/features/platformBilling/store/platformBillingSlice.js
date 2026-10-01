import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as platformBillingService from '../services/platformBillingService'

const mockQuotes = [
  {
    id: 'q1',
    quoteNumber: 'QT-2026-001',
    organizationName: 'Sunrise Villas',
    trialDays: 15,
    totalAmount: 120500,
    status: 'TRIAL_ACTIVE',
  },
  {
    id: 'q2',
    quoteNumber: 'QT-2026-002',
    organizationName: 'Prestige Heights',
    trialDays: 0,
    totalAmount: 93409,
    status: 'ACCEPTED',
  },
  {
    id: 'q3',
    quoteNumber: 'QT-2026-003',
    organizationName: 'Greenwood Estate',
    trialDays: 15,
    totalAmount: 45000,
    status: 'DRAFT',
  },
]

const mockOrders = [
  {
    id: 'o1',
    orderNumber: 'ORD-2026-101',
    organizationName: 'Sunrise Villas',
    createdAt: '2026-08-01T10:00:00Z',
    status: 'TRIAL_PENDING',
    orderSnapshot: { planName: 'Starter Tier', totalAmount: 120500 },
  },
  {
    id: 'o2',
    orderNumber: 'ORD-2026-102',
    organizationName: 'Prestige Heights',
    createdAt: '2026-08-05T14:30:00Z',
    status: 'COMPLETED',
    orderSnapshot: { planName: 'Premium Tier', totalAmount: 93409 },
  },
]

const mockInvoices = [
  {
    id: 'inv1',
    invoiceNumber: 'INV-2026-201',
    organizationName: 'Prestige Heights',
    period: 'Aug 2026 - Jul 2027',
    amount: 93409,
    status: 'PAID',
    grandTotal: 93409,
    invoiceDate: '2026-08-05T10:00:00Z',
  },
  {
    id: 'inv2',
    invoiceNumber: 'INV-2026-202',
    organizationName: 'Sunrise Villas',
    period: 'Sep 2026 - Aug 2027',
    amount: 120500,
    status: 'DRAFT',
    grandTotal: 120500,
    invoiceDate: '2026-08-10T10:00:00Z',
  },
]

const mockSubscriptions = [
  {
    id: 'sub1',
    subscriptionId: 'SUB-2026-301',
    organizationName: 'Prestige Heights',
    planName: 'Starter Tier',
    status: 'ACTIVE',
    nextBillingDate: '2027-08-05T00:00:00Z',
  },
  {
    id: 'sub2',
    subscriptionId: 'SUB-2026-302',
    organizationName: 'Sunrise Villas',
    planName: 'Starter Tier',
    status: 'TRIAL',
    nextBillingDate: '2026-08-15T00:00:00Z',
  },
]

const mockJobs = [
  {
    id: 'job1',
    jobId: 'JOB-2026-401',
    organizationName: 'Sunrise Villas',
    progress: 100,
    status: 'COMPLETED',
  },
  {
    id: 'job2',
    jobId: 'JOB-2026-402',
    organizationName: 'Greenwood Estate',
    progress: 40,
    status: 'IN_PROGRESS',
  },
]

const initialState = {
  activePage: 'dashboard',
  leads: [],
  selectedLeadId: null,
  activeTab: 'Overview',
  isLoading: false,
  error: null,
  pricingPlans: [],
  quotes: [],
  orders: [],
  invoices: [],
  subscriptions: [],
  jobs: [],
}

const extractArrayData = (res) => {
  if (!res) return []
  if (Array.isArray(res)) return res
  if (Array.isArray(res.data)) return res.data
  if (res.data && Array.isArray(res.data.data)) return res.data.data
  if (Array.isArray(res.docs)) return res.docs
  return []
}

// --- Thunks ---

export const fetchLeadsThunk = createAsyncThunk(
  'platformBilling/fetchLeads',
  async (_, { rejectWithValue }) => {
    try {
      const response = await platformBillingService.fetchInquiries()
      return extractArrayData(response)
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  },
)

export const createInquiryThunk = createAsyncThunk(
  'platformBilling/createInquiry',
  async (inquiryData, { rejectWithValue, dispatch }) => {
    try {
      const response = await platformBillingService.createInquiry(inquiryData)
      dispatch(fetchLeadsThunk())
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  },
)

export const fetchMasterPricingThunk = createAsyncThunk(
  'platformBilling/fetchMasterPricing',
  async (_, { rejectWithValue }) => {
    try {
      const response = await platformBillingService.fetchMasterPricing()
      return extractArrayData(response)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  },
)

export const saveMasterPricingThunk = createAsyncThunk(
  'platformBilling/saveMasterPricing',
  async (planData, { rejectWithValue, dispatch }) => {
    try {
      let response
      if (planData.id || planData._id) {
        response = await platformBillingService.updateMasterPricing(
          planData.id || planData._id,
          planData,
        )
      } else {
        response = await platformBillingService.createMasterPricing(planData)
      }
      dispatch(fetchMasterPricingThunk())
      return response
    } catch (error) {
      return rejectWithValue(error.message)
    }
  },
)

export const fetchQuotesThunk = createAsyncThunk(
  'platformBilling/fetchQuotes',
  async (_, { rejectWithValue }) => {
    try {
      const response = await platformBillingService.fetchQuotes()
      return extractArrayData(response)
    } catch (error) {
      return []
    }
  },
)

export const generateQuoteThunk = createAsyncThunk(
  'platformBilling/generateQuote',
  async (quoteData, { rejectWithValue, dispatch }) => {
    try {
      const response = await platformBillingService.generateQuoteAndProvision(quoteData)

      // Dispatch all thunks so all tables refresh automatically
      dispatch(fetchQuotesThunk())
      dispatch(fetchOrdersThunk())
      dispatch(fetchInvoicesThunk())
      dispatch(fetchSubscriptionsThunk())
      dispatch(fetchJobsThunk())

      return response
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  },
)

export const fetchOrdersThunk = createAsyncThunk(
  'platformBilling/fetchOrders',
  async (_, { rejectWithValue }) => {
    try {
      const response = await platformBillingService.fetchOrders()
      return extractArrayData(response)
    } catch (error) {
      return []
    }
  },
)

export const fetchInvoicesThunk = createAsyncThunk(
  'platformBilling/fetchInvoices',
  async (_, { rejectWithValue }) => {
    try {
      const response = await platformBillingService.fetchInvoices()
      return extractArrayData(response)
    } catch (error) {
      return []
    }
  },
)

export const fetchSubscriptionsThunk = createAsyncThunk(
  'platformBilling/fetchSubscriptions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await platformBillingService.fetchSubscriptions()
      return extractArrayData(response)
    } catch (error) {
      return []
    }
  },
)

export const fetchJobsThunk = createAsyncThunk(
  'platformBilling/fetchJobs',
  async (_, { rejectWithValue }) => {
    try {
      const response = await platformBillingService.fetchProvisioningJobs()
      return extractArrayData(response)
    } catch (error) {
      return []
    }
  },
)

// --- Slice ---

const handlePending = (state) => {
  state.isLoading = true
  state.error = null
}

const handleRejected = (state, action) => {
  state.isLoading = false
  state.error = action.payload || 'An error occurred'
}

const extractArray = (payload) => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (payload.data && Array.isArray(payload.data)) return payload.data
  if (payload.data?.docs && Array.isArray(payload.data.docs)) return payload.data.docs
  if (payload.data?.data && Array.isArray(payload.data.data)) return payload.data.data
  if (payload.docs && Array.isArray(payload.docs)) return payload.docs
  return []
}

const platformBillingSlice = createSlice({
  name: 'platformBilling',
  initialState,
  reducers: {
    setSelectedLeadId: (state, action) => {
      state.selectedLeadId = action.payload
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload
    },
    setActivePage: (state, action) => {
      state.activePage = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Leads
      .addCase(fetchLeadsThunk.pending, handlePending)
      .addCase(fetchLeadsThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.leads = extractArray(action.payload)
        if (state.leads.length > 0 && !state.selectedLeadId) {
          state.selectedLeadId = state.leads[0]._id || state.leads[0].id
        }
      })
      .addCase(fetchLeadsThunk.rejected, handleRejected)

      // Create Inquiry
      .addCase(createInquiryThunk.pending, handlePending)
      .addCase(createInquiryThunk.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(createInquiryThunk.rejected, handleRejected)

      // Fetch Master Pricing
      .addCase(fetchMasterPricingThunk.pending, handlePending)
      .addCase(fetchMasterPricingThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.pricingPlans = extractArray(action.payload)
      })
      .addCase(fetchMasterPricingThunk.rejected, handleRejected)

      // Save Master Pricing
      .addCase(saveMasterPricingThunk.pending, handlePending)
      .addCase(saveMasterPricingThunk.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(saveMasterPricingThunk.rejected, handleRejected)

      // Fetch Quotes
      .addCase(fetchQuotesThunk.pending, handlePending)
      .addCase(fetchQuotesThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.quotes = extractArray(action.payload)
      })
      .addCase(fetchQuotesThunk.rejected, handleRejected)

      // Generate Quote
      .addCase(generateQuoteThunk.pending, handlePending)
      .addCase(generateQuoteThunk.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(generateQuoteThunk.rejected, handleRejected)

      // Fetch Orders
      .addCase(fetchOrdersThunk.pending, handlePending)
      .addCase(fetchOrdersThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.orders = extractArray(action.payload)
      })
      .addCase(fetchOrdersThunk.rejected, handleRejected)

      // Fetch Invoices
      .addCase(fetchInvoicesThunk.pending, handlePending)
      .addCase(fetchInvoicesThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.invoices = extractArray(action.payload)
      })
      .addCase(fetchInvoicesThunk.rejected, handleRejected)

      // Fetch Subscriptions
      .addCase(fetchSubscriptionsThunk.pending, handlePending)
      .addCase(fetchSubscriptionsThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.subscriptions = extractArray(action.payload)
      })
      .addCase(fetchSubscriptionsThunk.rejected, handleRejected)

      // Fetch Jobs
      .addCase(fetchJobsThunk.pending, handlePending)
      .addCase(fetchJobsThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.jobs = extractArray(action.payload)
      })
      .addCase(fetchJobsThunk.rejected, handleRejected)
  },
})

export const { setSelectedLeadId, setActiveTab, setActivePage } = platformBillingSlice.actions

export default platformBillingSlice.reducer
