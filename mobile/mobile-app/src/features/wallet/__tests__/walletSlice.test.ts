import walletReducer, {
  syncWalletBalance,
  clearWalletError,
  fetchWalletBalance,
  topUpWalletDirect,
  WalletState,
} from '../store/walletSlice';

describe('features/wallet: walletSlice unit tests', () => {
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

  it('1. should return the initial state by default', () => {
    expect(walletReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('2. should handle syncWalletBalance with numeric payload', () => {
    const nextState = walletReducer(initialState, syncWalletBalance(1500));
    expect(nextState.balance).toBe(1500);
  });

  it('3. should handle syncWalletBalance with object payload { balance: 2200 }', () => {
    const nextState = walletReducer(initialState, syncWalletBalance({ balance: 2200 }));
    expect(nextState.balance).toBe(2200);
  });

  it('4. should handle clearWalletError', () => {
    const stateWithError: WalletState = {
      ...initialState,
      error: 'Network timeout',
    };
    const nextState = walletReducer(stateWithError, clearWalletError());
    expect(nextState.error).toBeNull();
  });

  it('5. should handle fetchWalletBalance.fulfilled and set balance and history', () => {
    const mockApiResponse = {
      balance: 3500,
      transactionHistory: [
        {
          _id: 'txn-1',
          type: 'Credit',
          amount: 1000,
          description: 'Recharge',
          createdAt: '2026-09-25T00:00:00.000Z',
        },
      ],
      isPaymentGatewayConfigured: true,
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalRecords: 15,
        limit: 10,
      },
    };

    const action = {
      type: fetchWalletBalance.fulfilled.type,
      payload: mockApiResponse,
    };

    const nextState = walletReducer(initialState, action);
    expect(nextState.balance).toBe(3500);
    expect(nextState.isPaymentGatewayConfigured).toBe(true);
    expect(nextState.transactionHistory).toHaveLength(1);
    expect(nextState.transactionHistory?.[0]._id).toBe('txn-1');
    expect(nextState.isLoading).toBe(false);
  });

  it('6. should handle topUpWalletDirect.fulfilled and update balance and transaction history', () => {
    const topUpPayload = {
      data: {
        balance: 4500,
        transaction: {
          _id: 'txn-topup-99',
          type: 'Credit',
          amount: 1000,
          description: 'Direct Top-Up',
          createdAt: '2026-09-25T01:00:00.000Z',
        },
      },
    };

    const action = {
      type: topUpWalletDirect.fulfilled.type,
      payload: topUpPayload,
    };

    const nextState = walletReducer(initialState, action);
    expect(nextState.balance).toBe(4500);
    expect(nextState.transactionHistory?.[0]._id).toBe('txn-topup-99');
  });
});
