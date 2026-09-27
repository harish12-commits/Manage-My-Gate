import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import billingService from '@/src/features/billing/services/billingService';
import { BillingKPIs, ActiveDues, Invoice, InvoicesGridPagination, BillingState } from '@/src/features/billing/types';

// Helper to perform sync when an invoice status changes
const performInvoiceSync = (state: BillingState, payload: any) => {
  if (!payload) return;
  const updatedInvoice = payload?.invoice || payload?.data?.invoice || payload?.data || payload;
  if (!updatedInvoice || (!updatedInvoice._id && !updatedInvoice.invoiceNumber)) return;

  // 1. Sync invoicesList grid
  if (state.invoicesList && Array.isArray(state.invoicesList)) {
    const gridIndex = state.invoicesList.findIndex(
      (inv: any) => inv._id === updatedInvoice._id || inv.invoiceNumber === updatedInvoice.invoiceNumber
    );
    if (gridIndex !== -1) {
      const existing = state.invoicesList[gridIndex];
      state.invoicesList[gridIndex] = {
        ...existing,
        ...updatedInvoice,
        unitNumber: updatedInvoice.unitNumber || updatedInvoice.unitId?.unitNumber || existing.unitNumber,
        targetUser: updatedInvoice.targetUser || updatedInvoice.targetUserId?.name || updatedInvoice.targetUserId?.username || existing.targetUser,
        assessmentName: updatedInvoice.assessmentName || updatedInvoice.snapshot?.assessmentName || existing.assessmentName,
        date: updatedInvoice.date || existing.date,
      };
    }
  }

  // 2. Sync unitBreakdown list in activeDues
  if (state.activeDues?.unitBreakdown && Array.isArray(state.activeDues.unitBreakdown)) {
    const targetId = String(updatedInvoice._id || '');
    const targetNum = String(updatedInvoice.invoiceNumber || '');
    const unitNumber = updatedInvoice.unitNumber || updatedInvoice.unitId?.unitNumber || '—';

    const breakdownIndex = state.activeDues.unitBreakdown.findIndex(
      (item) =>
        (targetId && String(item.invoiceId || '') === targetId) ||
        (targetNum && String(item.invoiceNumber || '') === targetNum)
    );

    if (breakdownIndex !== -1) {
      if (updatedInvoice.status === 'PAID') {
        state.activeDues.unitBreakdown.splice(breakdownIndex, 1);
      } else {
        state.activeDues.unitBreakdown[breakdownIndex] = {
          ...state.activeDues.unitBreakdown[breakdownIndex],
          status: updatedInvoice.status,
          totalDue: updatedInvoice.totalDue || updatedInvoice.amount || 0,
        };
      }
    } else if (updatedInvoice.status !== 'PAID') {
      const newDue = {
        invoiceId: updatedInvoice._id,
        invoiceNumber: updatedInvoice.invoiceNumber,
        unitId: updatedInvoice.unitId?._id || updatedInvoice.unitId,
        unitNumber,
        totalDue: updatedInvoice.totalDue || updatedInvoice.amount || 0,
        billingPeriodString: updatedInvoice.billingPeriodString,
        status: updatedInvoice.status,
        dueDate: updatedInvoice.dueDate,
      };
      state.activeDues.unitBreakdown.push(newDue);
      state.activeDues.totalPortfolioDue += newDue.totalDue;
    }
  }
};

export const DEFAULT_MOCK_INVOICES: Invoice[] = [];

const initialState: BillingState = {
  kpis: {
    grossDemand: 0,
    grossDemandCount: 0,
    totalCollected: 0,
    inTransitGateway: 0,
    totalUnpaidArrears: 0,
    pendingOffline: 0,
  },
  activeDues: {
    totalPortfolioDue: 0,
    unitBreakdown: [],
    secondaryCompliance: [],
    recentInvoices: [],
  },
  invoicesList: [],
  statusCounts: {
    ALL: 0,
    VERIFICATION_PENDING: 0,
    UNPAID: 0,
    PARTIALLY_PAID: 0,
    OVERDUE: 0,
    PAID: 0,
  },
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
};

// Thunks
export const fetchAdminKPIs = createAsyncThunk(
  'billing/fetchAdminKPIs',
  async (communityId: string, { rejectWithValue }) => {
    try {
      const data = await billingService.getKPIs(communityId);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch KPIs');
    }
  }
);

export const fetchMyDues = createAsyncThunk(
  'billing/fetchMyDues',
  async (communityId: string | undefined, { rejectWithValue, getState }) => {
    try {
      const state: any = getState();
      const targetCommunityId =
        communityId ||
        state?.workspace?.activeOrganizationId ||
        state?.auth?.activeOrganizationId ||
        state?.auth?.user?.activeOrganizationId ||
        state?.auth?.user?.orgId ||
        state?.auth?.user?.communityId;
      const data = await billingService.getMyDues(targetCommunityId);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch personal dues');
    }
  }
);

export const fetchInvoicesGrid = createAsyncThunk(
  'billing/fetchInvoicesGrid',
  async ({ page, limit, filters }: { page: number; limit: number; filters?: Record<string, any> }, { rejectWithValue }) => {
    try {
      const innerData = await billingService.getInvoicesTable(page, limit, filters);
      return {
        data: Array.isArray(innerData) ? innerData : innerData?.data || [],
        statusCounts: innerData?.statusCounts,
        pagination: innerData?.pagination,
        totalRecords: innerData?.pagination?.totalRecords || innerData?.totalRecords || 0,
        currentPage: innerData?.pagination?.currentPage || page || 1,
        limit: innerData?.pagination?.limit || limit || 10,
        totalPages: innerData?.pagination?.totalPages || innerData?.totalPages || 1,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch invoices grid');
    }
  }
);

export const executeManualTrigger = createAsyncThunk(
  'billing/executeManualTrigger',
  async ({ assessmentId, billingPeriodString }: { assessmentId: string; billingPeriodString: string }, { rejectWithValue }) => {
    try {
      const data = await billingService.triggerManualBilling(assessmentId, billingPeriodString);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to trigger manual billing');
    }
  }
);

export const triggerInvoiceGenerationThunk = createAsyncThunk(
  'billing/triggerInvoiceGenerationThunk',
  async (payload: Record<string, any> | undefined, { rejectWithValue }) => {
    try {
      const data = await billingService.triggerInvoiceGeneration(payload || {});
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to trigger invoice generation');
    }
  }
);

export const submitOfflineSettlement = createAsyncThunk(
  'billing/submitOfflineSettlement',
  async (
    {
      invoiceId,
      offlineReference,
      paymentMethod,
      amount,
      paymentDate,
      paymentScreenshot,
      payerNotes,
    }: {
      invoiceId: string;
      offlineReference: string;
      paymentMethod: string;
      amount?: number;
      paymentDate?: string;
      paymentScreenshot?: string;
      payerNotes?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const data = await billingService.settleInvoiceOffline(invoiceId, {
        invoiceId,
        offlineReference,
        paymentMethod,
        offlineAmount: amount,
        amount,
        paymentDate,
        paymentScreenshot,
        payerNotes,
      });
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to record offline payment');
    }
  }
);

export const clearOfflineSettlement = createAsyncThunk(
  'billing/clearOfflineSettlement',
  async (
    payload:
      | string
      | {
          invoiceId: string;
          amount?: number;
          settlementType?: 'FULL' | 'CUSTOM';
          paymentMethod?: string;
          paymentReference?: string;
          reference?: string;
          notes?: string;
          paymentScreenshot?: string;
        },
    { rejectWithValue }
  ) => {
    try {
      const invoiceId = typeof payload === 'string' ? payload : payload.invoiceId;
      const opts =
        typeof payload === 'string'
          ? undefined
          : {
              amount: payload.amount,
              settlementType: payload.settlementType,
              paymentMethod: payload.paymentMethod,
              paymentReference: payload.paymentReference,
              reference: payload.reference,
              notes: payload.notes,
              paymentScreenshot: payload.paymentScreenshot,
            };
      const data = await billingService.approveInvoiceOffline(invoiceId, opts);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to approve offline payment');
    }
  }
);

export const rejectOfflineSettlement = createAsyncThunk(
  'billing/rejectOfflineSettlement',
  async ({ invoiceId, reason }: { invoiceId: string; reason?: string }, { rejectWithValue }) => {
    try {
      const data = await billingService.rejectInvoiceOffline(invoiceId, reason);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to reject offline payment');
    }
  }
);

export const payWithWallet = createAsyncThunk(
  'billing/payWithWallet',
  async (
    { invoiceId, amount, idempotencyKey }: { invoiceId: string; amount: number; idempotencyKey?: string },
    { rejectWithValue }
  ) => {
    try {
      const data = await billingService.payInvoiceWithWallet(invoiceId, amount, idempotencyKey);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to pay invoice with wallet');
    }
  }
);

export const createRazorpayOrder = createAsyncThunk(
  'billing/createRazorpayOrder',
  async (
    { invoiceId, amount, idempotencyKey }: { invoiceId: string; amount: number; idempotencyKey?: string },
    { rejectWithValue }
  ) => {
    try {
      const data = await billingService.createRazorpayOrder(invoiceId, amount, idempotencyKey);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create Razorpay order');
    }
  }
);

export const verifyRazorpaySignature = createAsyncThunk(
  'billing/verifyRazorpaySignature',
  async (
    payload: { verificationData?: any; idempotencyKey?: string } | any,
    { rejectWithValue }
  ) => {
    try {
      const verificationData = payload?.verificationData || payload;
      const idempotencyKey = payload?.idempotencyKey;
      const data = await billingService.verifyRazorpayPayment(verificationData, idempotencyKey);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Razorpay signature verification failed');
    }
  }
);

export const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    clearBillingError: (state) => {
      state.error = null;
    },
    syncRealtimeInvoice: (state, action: PayloadAction<any>) => {
      performInvoiceSync(state, action.payload);
    },
    clearInvoicesGrid: (state) => {
      state.invoicesList = [];
      state.pagination = { ...initialState.pagination };
      state.kpis = null;
      state.activeDues = { ...initialState.activeDues };
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchAdminKPIs
      .addCase(fetchAdminKPIs.pending, (state) => {
        state.loadingStates.fetchKPIs = true;
        state.error = null;
      })
      .addCase(fetchAdminKPIs.fulfilled, (state, action) => {
        state.loadingStates.fetchKPIs = false;
        state.kpis = action.payload || null;
      })
      .addCase(fetchAdminKPIs.rejected, (state, action) => {
        state.loadingStates.fetchKPIs = false;
        state.error = action.payload as string;
      })

      // fetchMyDues
      .addCase(fetchMyDues.pending, (state) => {
        state.loadingStates.fetchDues = true;
        state.error = null;
      })
      .addCase(fetchMyDues.fulfilled, (state, action) => {
        state.loadingStates.fetchDues = false;
        const payload = action.payload || {};
        const duesData = payload.data || payload;
        const personalDues = duesData.personalDues || (duesData.totalPortfolioDue !== undefined ? duesData : null);

        state.activeDues = {
          totalPortfolioDue: personalDues?.totalPortfolioDue || 0,
          unitBreakdown: personalDues?.unitBreakdown || [],
          secondaryCompliance: duesData.secondaryCompliance || payload.secondaryCompliance || [],
          recentInvoices: duesData.recentInvoices || payload.recentInvoices || [],
        };
      })
      .addCase(fetchMyDues.rejected, (state, action) => {
        state.loadingStates.fetchDues = false;
        state.error = action.payload as string;
      })

      // fetchInvoicesGrid
      .addCase(fetchInvoicesGrid.pending, (state) => {
        state.loadingStates.fetchGrid = true;
        state.error = null;
      })
      .addCase(fetchInvoicesGrid.fulfilled, (state, action) => {
        state.loadingStates.fetchGrid = false;
        const page = action.meta.arg?.page || 1;
        const data = action.payload?.data || [];
        if (page > 1) {
          const existingIds = new Set(state.invoicesList.map((inv: any) => inv._id));
          const newItems = data.filter((inv: any) => !existingIds.has(inv._id));
          state.invoicesList = [...state.invoicesList, ...newItems];
        } else {
          state.invoicesList = data;
        }

        if (action.payload?.statusCounts) {
          state.statusCounts = action.payload.statusCounts;
        }

        if (action.payload?.pagination) {
          state.pagination = action.payload.pagination;
        } else {
          state.pagination = {
            currentPage: action.payload?.currentPage || page,
            totalPages: action.payload?.totalPages || 1,
            totalRecords: action.payload?.totalRecords || data.length,
            limit: action.payload?.limit || 10,
          };
        }
      })
      .addCase(fetchInvoicesGrid.rejected, (state, action) => {
        state.loadingStates.fetchGrid = false;
        state.error = action.payload as string;
      })

      // executeManualTrigger
      .addCase(executeManualTrigger.pending, (state) => {
        state.loadingStates.triggerRun = true;
        state.error = null;
      })
      .addCase(executeManualTrigger.fulfilled, (state) => {
        state.loadingStates.triggerRun = false;
      })
      .addCase(executeManualTrigger.rejected, (state, action) => {
        state.loadingStates.triggerRun = false;
        state.error = action.payload as string;
      })

      // submitOfflineSettlement
      .addCase(submitOfflineSettlement.pending, (state) => {
        state.loadingStates.settleInvoice = true;
        state.error = null;
      })
      .addCase(submitOfflineSettlement.fulfilled, (state, action) => {
        state.loadingStates.settleInvoice = false;
        performInvoiceSync(state, action.payload);
      })
      .addCase(submitOfflineSettlement.rejected, (state, action) => {
        state.loadingStates.settleInvoice = false;
        state.error = action.payload as string;
      })

      // clearOfflineSettlement
      .addCase(clearOfflineSettlement.pending, (state) => {
        state.loadingStates.settleInvoice = true;
        state.error = null;
      })
      .addCase(clearOfflineSettlement.fulfilled, (state, action) => {
        state.loadingStates.settleInvoice = false;
        performInvoiceSync(state, action.payload);
      })
      .addCase(clearOfflineSettlement.rejected, (state, action) => {
        state.loadingStates.settleInvoice = false;
        state.error = action.payload as string;
      })

      // rejectOfflineSettlement
      .addCase(rejectOfflineSettlement.pending, (state) => {
        state.loadingStates.settleInvoice = true;
        state.error = null;
      })
      .addCase(rejectOfflineSettlement.fulfilled, (state, action) => {
        state.loadingStates.settleInvoice = false;
        performInvoiceSync(state, action.payload);
      })
      .addCase(rejectOfflineSettlement.rejected, (state, action) => {
        state.loadingStates.settleInvoice = false;
        state.error = action.payload as string;
      })

      // payWithWallet
      .addCase(payWithWallet.pending, (state) => {
        state.loadingStates.settleInvoice = true;
        state.error = null;
      })
      .addCase(payWithWallet.fulfilled, (state, action) => {
        state.loadingStates.settleInvoice = false;
        performInvoiceSync(state, action.payload);
      })
      .addCase(payWithWallet.rejected, (state, action) => {
        state.loadingStates.settleInvoice = false;
        state.error = action.payload as string;
      })

      // verifyRazorpaySignature
      .addCase(verifyRazorpaySignature.pending, (state) => {
        state.loadingStates.settleInvoice = true;
        state.error = null;
      })
      .addCase(verifyRazorpaySignature.fulfilled, (state, action) => {
        state.loadingStates.settleInvoice = false;
        performInvoiceSync(state, action.payload);
      })
      .addCase(verifyRazorpaySignature.rejected, (state, action) => {
        state.loadingStates.settleInvoice = false;
        state.error = action.payload as string;
      })

      // Invalidate and reset billing cache when switching community workspace
      .addCase('auth/switchWorkspaceContext/fulfilled', (state) => {
        state.invoicesList = [];
        state.pagination = { ...initialState.pagination };
        state.kpis = null;
        state.activeDues = { ...initialState.activeDues };
      });
  },
});

export const { clearBillingError, syncRealtimeInvoice, clearInvoicesGrid } = billingSlice.actions;
export default billingSlice.reducer;
