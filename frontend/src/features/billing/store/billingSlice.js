import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import billingService from '../services/billing.service.js'

// Thunks
export const fetchAdminKPIs = createAsyncThunk(
  'billing/fetchAdminKPIs',
  async (communityId, { rejectWithValue }) => {
    try {
      const response = await billingService.getKPIs(communityId)
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch KPIs')
    }
  },
)

export const fetchMyDues = createAsyncThunk(
  'billing/fetchMyDues',
  async (_, { rejectWithValue }) => {
    try {
      const response = await billingService.getMyDues()
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch personal dues')
    }
  },
)

export const fetchInvoicesGrid = createAsyncThunk(
  'billing/fetchInvoicesGrid',
  async ({ page, limit, filters }, { rejectWithValue }) => {
    try {
      const response = await billingService.getInvoicesTable(page, limit, filters)
      const body = response?.success !== undefined ? response : response?.data
      const innerData = body?.data || body
      return {
        data: Array.isArray(innerData) ? innerData : innerData?.data || [],
        totalRecords: innerData?.pagination?.totalRecords || innerData?.totalRecords || 0,
        currentPage: innerData?.pagination?.currentPage || page || 1,
        limit: innerData?.pagination?.limit || limit || 10,
        totalPages: innerData?.pagination?.totalPages || innerData?.totalPages || 1,
      }
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch invoices grid')
    }
  },
)

export const executeManualTrigger = createAsyncThunk(
  'billing/executeManualTrigger',
  async ({ assessmentId, billingPeriodString }, { rejectWithValue }) => {
    try {
      const response = await billingService.triggerManualBilling(assessmentId, billingPeriodString)
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to trigger manual billing')
    }
  },
)

export const triggerInvoiceGenerationThunk = createAsyncThunk(
  'billing/triggerInvoiceGenerationThunk',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await billingService.triggerInvoiceGeneration(payload || {})
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to trigger invoice generation')
    }
  },
)

export const submitOfflineSettlement = createAsyncThunk(
  'billing/submitOfflineSettlement',
  async (payload, { rejectWithValue }) => {
    try {
      const {
        invoiceId,
        paymentReference,
        offlineReference,
        amountPaid,
        amount,
        paymentMethod,
        paymentDate,
        paymentScreenshot,
      } = payload
      const response = await billingService.settleInvoiceOffline(invoiceId, {
        paymentReference: paymentReference || offlineReference,
        offlineReference: paymentReference || offlineReference,
        amountPaid: amountPaid || amount,
        amount: amountPaid || amount,
        paymentMethod: paymentMethod || 'BANK_TRANSFER',
        paymentDate,
        paymentScreenshot,
      })
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to submit bank transfer payment')
    }
  },
)

export const clearOfflineSettlement = createAsyncThunk(
  'billing/clearOfflineSettlement',
  async (invoiceId, { rejectWithValue }) => {
    try {
      const response = await billingService.approveInvoiceOffline(invoiceId)
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to approve bank transfer payment')
    }
  },
)

export const rejectOfflineSettlement = createAsyncThunk(
  'billing/rejectOfflineSettlement',
  async ({ invoiceId, rejectionReason }, { rejectWithValue }) => {
    try {
      const response = await billingService.rejectInvoiceOffline(invoiceId, rejectionReason)
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to reject bank transfer payment')
    }
  },
)

export const sendInvoiceReminderThunk = createAsyncThunk(
  'billing/sendInvoiceReminderThunk',
  async (invoiceId, { rejectWithValue }) => {
    try {
      const response = await billingService.sendInvoiceReminder(invoiceId)
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to send invoice reminder')
    }
  },
)

export const recordCashPaymentThunk = createAsyncThunk(
  'billing/recordCashPaymentThunk',
  async ({ invoiceId, amount }, { rejectWithValue }) => {
    try {
      const response = await billingService.recordCashPayment(invoiceId, amount)
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to record cash payment')
    }
  },
)

export const fetchCashCollectionsThunk = createAsyncThunk(
  'billing/fetchCashCollectionsThunk',
  async (_, { rejectWithValue }) => {
    try {
      const response = await billingService.getCashCollections()
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch cash collections')
    }
  },
)

export const searchCashEligibleThunk = createAsyncThunk(
  'billing/searchCashEligibleThunk',
  async (query, { rejectWithValue }) => {
    try {
      const response = await billingService.searchCashEligible(query)
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to search cash eligible invoices')
    }
  },
)

export const payWithWallet = createAsyncThunk(
  'billing/payWithWallet',
  async ({ invoiceId, amount }, { rejectWithValue }) => {
    try {
      const response = await billingService.payInvoiceWithWallet(invoiceId, amount)
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to pay invoice with wallet',
      )
    }
  },
)

export const createRazorpayOrder = createAsyncThunk(
  'billing/createRazorpayOrder',
  async ({ invoiceId, amount }, { rejectWithValue }) => {
    try {
      const response = await billingService.createRazorpayOrder(invoiceId, amount)
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to create payment order',
      )
    }
  },
)

export const verifyRazorpaySignature = createAsyncThunk(
  'billing/verifyRazorpaySignature',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await billingService.verifyRazorpayPayment(payload)
      const body = response?.success !== undefined ? response : response?.data
      return body?.data || body
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Payment verification failed',
      )
    }
  },
)

const performInvoiceSync = (state, updatedInvoice) => {
  if (!updatedInvoice) return

  // Map fields to match what the grid expects
  const targetUser = updatedInvoice.targetUserId
    ? updatedInvoice.targetUserId.name || updatedInvoice.targetUserId.username
    : updatedInvoice.targetUser || '—'

  const unitNumber = updatedInvoice.unitId
    ? updatedInvoice.unitId.unitNumber || updatedInvoice.unitNumber || '—'
    : updatedInvoice.unitNumber || '—'

  const dateVal = updatedInvoice.createdAt
    ? new Date(updatedInvoice.createdAt).toISOString().split('T')[0]
    : updatedInvoice.date || new Date().toISOString().split('T')[0]

  const mappedInvoice = {
    _id: updatedInvoice._id,
    invoiceNumber: updatedInvoice.invoiceNumber,
    date: dateVal,
    unitNumber,
    targetUser,
    amount: updatedInvoice.totalDue || updatedInvoice.amount || 0,
    currency: '₹',
    status: updatedInvoice.status,
    paymentMethod: updatedInvoice.paymentMethod || '—',
    offlineReference: updatedInvoice.offlineReference || null,
  }

  // 1. Sync invoicesList grid
  const targetId = String(updatedInvoice._id || updatedInvoice.id || '')
  const targetNum = String(updatedInvoice.invoiceNumber || '')

  const index = state.invoicesList.findIndex(
    (inv) =>
      (targetId && String(inv._id || inv.id || '') === targetId) ||
      (targetNum && String(inv.invoiceNumber || '') === targetNum),
  )
  let oldStatus = null
  const amount = updatedInvoice.totalDue || updatedInvoice.amount || 0

  if (index !== -1) {
    oldStatus = state.invoicesList[index].status
    state.invoicesList[index] = {
      ...state.invoicesList[index],
      ...mappedInvoice,
      targetUser:
        mappedInvoice.targetUser !== '—'
          ? mappedInvoice.targetUser
          : state.invoicesList[index].targetUser,
      unitNumber:
        mappedInvoice.unitNumber !== '—'
          ? mappedInvoice.unitNumber
          : state.invoicesList[index].unitNumber,
    }
  } else {
    // Prepend new invoice to the list
    state.invoicesList = [mappedInvoice, ...state.invoicesList]
    state.pagination.totalRecords += 1
  }

  // 2. Sync KPIs
  const newStatus = updatedInvoice.status
  if (state.kpis) {
    if (oldStatus) {
      if (oldStatus !== newStatus) {
        // Subtract from old status
        if (oldStatus === 'PAID') {
          state.kpis.totalCollected = Math.max(0, state.kpis.totalCollected - amount)
        } else if (oldStatus === 'UNPAID') {
          state.kpis.totalUnpaidArrears = Math.max(0, state.kpis.totalUnpaidArrears - amount)
        } else if (oldStatus === 'VERIFICATION_PENDING') {
          state.kpis.inTransitGateway = Math.max(0, state.kpis.inTransitGateway - amount)
        }

        // Add to new status
        if (newStatus === 'PAID') {
          state.kpis.totalCollected += amount
        } else if (newStatus === 'UNPAID') {
          state.kpis.totalUnpaidArrears += amount
        } else if (newStatus === 'VERIFICATION_PENDING') {
          state.kpis.inTransitGateway += amount
        }
      }
    } else {
      // New invoice addition
      state.kpis.grossDemand += amount
      state.kpis.grossDemandCount = (state.kpis.grossDemandCount || 0) + 1
      if (newStatus === 'PAID') {
        state.kpis.totalCollected += amount
      } else if (newStatus === 'UNPAID') {
        state.kpis.totalUnpaidArrears += amount
      } else if (newStatus === 'VERIFICATION_PENDING') {
        state.kpis.inTransitGateway += amount
      }
    }
  }

  // 3. Sync activeDues portfolio (if invoice becomes PAID, remove from active dues)
  if (state.activeDues && Array.isArray(state.activeDues.unitBreakdown)) {
    const breakdownIndex = state.activeDues.unitBreakdown.findIndex(
      (item) =>
        (targetId && String(item.invoiceId || item._id || '') === targetId) ||
        (targetNum && String(item.invoiceNumber || '') === targetNum),
    )

    if (breakdownIndex !== -1) {
      if (updatedInvoice.status === 'PAID') {
        state.activeDues.unitBreakdown.splice(breakdownIndex, 1)
      } else {
        state.activeDues.unitBreakdown[breakdownIndex] = {
          ...state.activeDues.unitBreakdown[breakdownIndex],
          status: updatedInvoice.status,
          totalDue: updatedInvoice.totalDue || updatedInvoice.amount || 0,
        }
      }
    } else if (updatedInvoice.status !== 'PAID') {
      // Add to active dues
      const newDue = {
        invoiceId: updatedInvoice._id,
        invoiceNumber: updatedInvoice.invoiceNumber,
        unitId: updatedInvoice.unitId?._id || updatedInvoice.unitId,
        unitNumber,
        totalDue: updatedInvoice.totalDue || updatedInvoice.amount || 0,
        billingPeriodString: updatedInvoice.billingPeriodString,
        status: updatedInvoice.status,
        dueDate: updatedInvoice.dueDate,
      }
      state.activeDues.unitBreakdown.push(newDue)
      state.activeDues.totalPortfolioDue += newDue.totalDue
    }
  }
}

const initialState = {
  kpis: {
    grossDemand: 0,
    grossDemandCount: 0,
    totalCollected: 0,
    inTransitGateway: 0,
    totalUnpaidArrears: 0,
  },
  activeDues: {
    totalPortfolioDue: 0,
    unitBreakdown: [],
    secondaryCompliance: [],
  },
  invoicesList: [],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10,
  },
  loadingStates: {
    fetchKPIs: false,
    fetchDues: false,
    fetchGrid: false,
    triggerRun: false,
    settleInvoice: false,
  },
  error: null,
}

export const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    clearBillingError: (state) => {
      state.error = null
    },
    syncRealtimeInvoice: (state, action) => {
      performInvoiceSync(state, action.payload)
    },
    clearInvoicesGrid: (state) => {
      state.invoicesList = []
      state.pagination = { ...initialState.pagination }
      state.kpis = { ...initialState.kpis }
      state.activeDues = { ...initialState.activeDues }
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchAdminKPIs
      .addCase(fetchAdminKPIs.pending, (state) => {
        state.loadingStates.fetchKPIs = true
        state.error = null
      })
      .addCase(fetchAdminKPIs.fulfilled, (state, action) => {
        state.loadingStates.fetchKPIs = false
        state.kpis = action.payload || initialState.kpis
      })
      .addCase(fetchAdminKPIs.rejected, (state, action) => {
        state.loadingStates.fetchKPIs = false
        state.error = action.payload
      })

      // fetchMyDues
      .addCase(fetchMyDues.pending, (state) => {
        state.loadingStates.fetchDues = true
        state.error = null
      })
      .addCase(fetchMyDues.fulfilled, (state, action) => {
        state.loadingStates.fetchDues = false
        const duesData = action.payload || {}
        state.activeDues = {
          totalPortfolioDue: duesData.personalDues?.totalPortfolioDue || 0,
          unitBreakdown: duesData.personalDues?.unitBreakdown || [],
          secondaryCompliance: duesData.secondaryCompliance || [],
          recentInvoices: duesData.recentInvoices || [],
        }
      })
      .addCase(fetchMyDues.rejected, (state, action) => {
        state.loadingStates.fetchDues = false
        state.error = action.payload
      })

      // fetchInvoicesGrid
      .addCase(fetchInvoicesGrid.pending, (state) => {
        state.loadingStates.fetchGrid = true
        state.error = null
      })
      .addCase(fetchInvoicesGrid.fulfilled, (state, action) => {
        state.loadingStates.fetchGrid = false
        state.invoicesList = action.payload.data
        state.pagination = {
          currentPage: action.payload.currentPage,
          totalPages: action.payload.totalPages,
          totalRecords: action.payload.totalRecords,
          limit: action.payload.limit,
        }
      })
      .addCase(fetchInvoicesGrid.rejected, (state, action) => {
        state.loadingStates.fetchGrid = false
        state.error = action.payload
      })

      // executeManualTrigger
      .addCase(executeManualTrigger.pending, (state) => {
        state.loadingStates.triggerRun = true
        state.error = null
      })
      .addCase(executeManualTrigger.fulfilled, (state) => {
        state.loadingStates.triggerRun = false
      })
      .addCase(executeManualTrigger.rejected, (state, action) => {
        state.loadingStates.triggerRun = false
        state.error = action.payload
      })

      // submitOfflineSettlement
      .addCase(submitOfflineSettlement.pending, (state) => {
        state.loadingStates.settleInvoice = true
        state.error = null
      })
      .addCase(submitOfflineSettlement.fulfilled, (state, action) => {
        state.loadingStates.settleInvoice = false
        performInvoiceSync(state, action.payload)
      })
      .addCase(submitOfflineSettlement.rejected, (state, action) => {
        state.loadingStates.settleInvoice = false
        state.error = action.payload
      })

      // clearOfflineSettlement
      .addCase(clearOfflineSettlement.pending, (state) => {
        state.loadingStates.settleInvoice = true
        state.error = null
      })
      .addCase(clearOfflineSettlement.fulfilled, (state, action) => {
        state.loadingStates.settleInvoice = false
        performInvoiceSync(state, action.payload)
      })
      .addCase(clearOfflineSettlement.rejected, (state, action) => {
        state.loadingStates.settleInvoice = false
        state.error = action.payload
      })

      // rejectOfflineSettlement
      .addCase(rejectOfflineSettlement.pending, (state) => {
        state.loadingStates.settleInvoice = true
        state.error = null
      })
      .addCase(rejectOfflineSettlement.fulfilled, (state, action) => {
        state.loadingStates.settleInvoice = false
        performInvoiceSync(state, action.payload)
      })
      .addCase(rejectOfflineSettlement.rejected, (state, action) => {
        state.loadingStates.settleInvoice = false
        state.error = action.payload
      })

      // recordCashPaymentThunk
      .addCase(recordCashPaymentThunk.pending, (state) => {
        state.loadingStates.settleInvoice = true
        state.error = null
      })
      .addCase(recordCashPaymentThunk.fulfilled, (state, action) => {
        state.loadingStates.settleInvoice = false
        performInvoiceSync(state, action.payload)
      })
      .addCase(recordCashPaymentThunk.rejected, (state, action) => {
        state.loadingStates.settleInvoice = false
        state.error = action.payload
      })

      // payWithWallet
      .addCase(payWithWallet.pending, (state) => {
        state.loadingStates.settleInvoice = true
        state.error = null
      })
      .addCase(payWithWallet.fulfilled, (state, action) => {
        state.loadingStates.settleInvoice = false
        if (action.payload?.invoice) {
          performInvoiceSync(state, action.payload.invoice)
        }
      })
      .addCase(payWithWallet.rejected, (state, action) => {
        state.loadingStates.settleInvoice = false
        state.error = action.payload
      })

      // verifyRazorpaySignature
      .addCase(verifyRazorpaySignature.pending, (state) => {
        state.loadingStates.settleInvoice = true
        state.error = null
      })
      .addCase(verifyRazorpaySignature.fulfilled, (state, action) => {
        state.loadingStates.settleInvoice = false
        if (action.payload?.invoice) {
          performInvoiceSync(state, action.payload.invoice)
        }
      })
      .addCase(verifyRazorpaySignature.rejected, (state, action) => {
        state.loadingStates.settleInvoice = false
        state.error = action.payload
      })
  },
})

export const { clearBillingError, syncRealtimeInvoice, clearInvoicesGrid } = billingSlice.actions
export default billingSlice.reducer
