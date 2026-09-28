import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import walletService from '../services/walletService';
import { WalletState, WalletTransaction } from '../types';

export type { WalletState, WalletTransaction };

export const fetchWalletBalance = createAsyncThunk<any, { page?: number; limit?: number } | void>(
  'wallet/fetchWalletBalance',
  async (params: { page?: number; limit?: number } | void = {}, { rejectWithValue }) => {
    try {
      const queryParams = params || {};
      const data = await walletService.getWalletBalance(queryParams);
      return { ...data, requestedParams: queryParams };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch wallet balance'
      );
    }
  }
);

export const createWalletRazorpayOrder = createAsyncThunk(
  'wallet/createWalletRazorpayOrder',
  async (
    payload: { amount: number; idempotencyKey?: string } | number,
    { rejectWithValue }
  ) => {
    try {
      const amount = typeof payload === 'number' ? payload : payload.amount;
      const idempotencyKey = typeof payload === 'number' ? undefined : payload.idempotencyKey;
      const data = await walletService.createWalletOrder(amount, idempotencyKey);
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to create order'
      );
    }
  }
);

export const verifyWalletPayment = createAsyncThunk(
  'wallet/verifyWalletPayment',
  async (
    payload: { paymentData?: any; idempotencyKey?: string } | any,
    { rejectWithValue, dispatch }
  ) => {
    try {
      const paymentData = payload?.paymentData || payload;
      const idempotencyKey = payload?.idempotencyKey;
      const data = await walletService.verifyWalletPayment(paymentData, idempotencyKey);
      dispatch(fetchWalletBalance());
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Payment verification failed'
      );
    }
  }
);

export const refundWalletToOriginalPayment = createAsyncThunk(
  'wallet/refundWalletToOriginalPayment',
  async ({ paymentId, amount }: { paymentId: string; amount: number }, { rejectWithValue, dispatch }) => {
    try {
      const data = await walletService.refundWalletToOriginalPayment(paymentId, amount);
      dispatch(fetchWalletBalance());
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Unable to refund wallet balance'
      );
    }
  }
);

export const topUpWalletDirect = createAsyncThunk(
  'wallet/topUpWalletDirect',
  async ({ amount }: { amount: number }, { rejectWithValue, dispatch }) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return rejectWithValue(
          'Direct wallet top-up is disabled in production. Please top up using Razorpay via the Digital Wallet screen.'
        );
      }
      const response: any = await walletService.topUpWalletDirect(amount);
      dispatch(fetchWalletBalance());
      return response?.data || response;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to add funds to digital wallet'
      );
    }
  }
);

// Backward-compatible alias thunks previously exposed via amenities/store/walletSlice
export const fetchWalletThunk = fetchWalletBalance;
export const topUpWalletThunk = createAsyncThunk(
  'wallet/topUpWalletThunk',
  async (amount: number, { dispatch, rejectWithValue }) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return rejectWithValue(
          'Direct wallet top-up is disabled in production. Please top up using Razorpay via the Digital Wallet screen.'
        );
      }
      const result = await dispatch(topUpWalletDirect({ amount })).unwrap();
      return result;
    } catch (err: any) {
      return rejectWithValue(err?.message || err || 'Failed to top up wallet');
    }
  }
);

const initialState: WalletState = {
  balance: 0,
  transactions: [],
  transactionHistory: [],
  isPaymentGatewayConfigured: false,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10,
  },
  isLoading: false,
  loading: false,
  error: null,
};

export const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    syncWalletBalance: (state, action: PayloadAction<any>) => {
      if (typeof action.payload === 'number') {
        state.balance = action.payload;
      } else if (action.payload && typeof action.payload.balance === 'number') {
        state.balance = action.payload.balance;
      }
    },
    clearWalletError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Balance & History
      .addCase(fetchWalletBalance.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWalletBalance.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        if (action.payload) {
          state.balance =
            action.payload.balance !== undefined
              ? action.payload.balance
              : typeof action.payload === 'number'
              ? action.payload
              : state.balance;
          const history = action.payload.transactionHistory || action.payload.transactions || state.transactionHistory || [];
          state.activePasses = action.payload.activePasses || state.activePasses;
          const newHistory = action.payload.transactionHistory || action.payload.transactions || [];
          const isAppend = (action.payload.requestedParams?.page || 1) > 1;

          if (isAppend) {
            const seen = new Set(
              (state.transactionHistory || []).map((transaction: any) =>
                String(transaction._id || transaction.id || transaction.transactionId || '')
              )
            );
            state.transactionHistory = [
              ...(state.transactionHistory || []),
              ...newHistory.filter((transaction: any) => {
                const id = String(transaction._id || transaction.id || transaction.transactionId || '');
                if (!id || seen.has(id)) return false;
                seen.add(id);
                return true;
              }),
            ];
          } else {
            state.transactionHistory = newHistory.length > 0 ? newHistory : history;
          }
          state.transactions = state.transactionHistory;

          if (action.payload.isPaymentGatewayConfigured !== undefined) {
            state.isPaymentGatewayConfigured = action.payload.isPaymentGatewayConfigured;
          }
          state.minimumRefundAmount = action.payload.minimumRefundAmount || 10;
          state.refundEligibleBalance = action.payload.refundEligibleBalance || 0;
          state.refundableSources = action.payload.refundableSources || [];

          if (action.payload.pagination) {
            state.pagination = action.payload.pagination;
          } else {
            state.pagination = {
              currentPage: action.payload.requestedParams?.page || 1,
              totalPages: action.payload.totalPages || 1,
              totalRecords: action.payload.totalRecords || (state.transactionHistory || []).length,
              limit: action.payload.requestedParams?.limit || 10,
            };
          }
        }
      })
      .addCase(fetchWalletBalance.rejected, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create Order
      .addCase(createWalletRazorpayOrder.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
      })
      .addCase(createWalletRazorpayOrder.fulfilled, (state) => {
        state.isLoading = false;
        state.loading = false;
      })
      .addCase(createWalletRazorpayOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.error = action.payload as string;
      })
      // Verify Payment
      .addCase(verifyWalletPayment.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyWalletPayment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        const payload = action.payload?.data || action.payload;
        const updatedBalance = payload?.balance ?? payload?.walletBalance;
        if (updatedBalance !== undefined && typeof updatedBalance === 'number') {
          state.balance = updatedBalance;
        }
        if (payload) {
          const newTxn = payload.transaction || payload;
          if (newTxn && (newTxn._id || newTxn.transactionId)) {
            state.transactionHistory = [newTxn, ...(state.transactionHistory || [])];
            state.transactions = state.transactionHistory;
          }
        }
      })
      .addCase(verifyWalletPayment.rejected, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.error = action.payload as string;
      })
      // Refund back to original UPI/card account
      .addCase(refundWalletToOriginalPayment.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
        state.error = null;
      })
      .addCase(refundWalletToOriginalPayment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        const payload = action.payload?.data || action.payload;
        const updatedBalance = payload?.balance ?? payload?.walletBalance;
        if (updatedBalance !== undefined && typeof updatedBalance === 'number') {
          state.balance = updatedBalance;
        }
        const transaction = payload?.transaction;
        if (transaction && (transaction._id || transaction.transactionId)) {
          state.transactionHistory = [transaction, ...(state.transactionHistory || [])];
          state.transactions = state.transactionHistory;
        }
      })
      .addCase(refundWalletToOriginalPayment.rejected, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.error = action.payload as string;
      })
      // Direct Top-up
      .addCase(topUpWalletDirect.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
        state.error = null;
      })
      .addCase(topUpWalletDirect.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        const payload = action.payload?.data || action.payload;
        const updatedBalance = payload?.balance ?? payload?.walletBalance;
        if (updatedBalance !== undefined && typeof updatedBalance === 'number') {
          state.balance = updatedBalance;
        }
        if (payload) {
          const newTxn = payload.transaction || payload;
          if (newTxn && (newTxn._id || newTxn.transactionId)) {
            state.transactionHistory = [newTxn, ...(state.transactionHistory || [])];
            state.transactions = state.transactionHistory;
          }
        }
      })
      .addCase(topUpWalletDirect.rejected, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const clearWalletStatus = walletSlice.actions.clearWalletError;
export const { syncWalletBalance, clearWalletError } = walletSlice.actions;
export default walletSlice.reducer;
