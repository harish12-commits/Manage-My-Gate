/**
 * NAHOM / Connect Harmony - Financial Module Consolidation & All Features Integration Test Suite
 *
 * Verifies:
 * 1. Single Reusable Central Financial Module (Wallet, Invoices, Payment, History).
 * 2. All Features catalog registration for financial capabilities (Wallet, Dues, History, Billing Hub).
 * 3. Role-based access control (RBAC): Resident self-service vs Admin audit vs Guard exclusion.
 * 4. Decommissioning of unsafe direct wallet balance mutations (POST /wallet/add-money) in production.
 * 5. Strict adherence to canonical Razorpay order/verification flows and backend-authoritative balances.
 */

import { ALL_AVAILABLE_FEATURES } from '../../dashboard/dashboardCatalog';
import { isFeatureAllowedForUser, RESIDENT_ONLY_FEATURE_IDS } from '../../../utils/rbac';
import walletService from '../../wallet/services/walletService';
import walletReducer, {
  fetchWalletBalance,
  verifyWalletPayment,
  topUpWalletDirect,
  topUpWalletThunk,
  syncWalletBalance,
} from '../../wallet/store/walletSlice';
import apiClient from '../../../services/apiClient';

jest.mock('../../../services/apiClient');

describe('Financial Module Consolidation & All Features Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. All Features Catalog Registration
  // =========================================================================
  describe('1. All Features Catalog Financial Capabilities', () => {
    it('registers canonical billing_wallet in ALL_AVAILABLE_FEATURES', () => {
      const walletFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_wallet');
      expect(walletFeature).toBeDefined();
      expect(walletFeature?.name).toBe('Digital Wallet');
      expect(walletFeature?.route).toBe('/(resident)/billing/wallet');
      expect(walletFeature?.categoryKey).toBe('digital_wallet');
      expect(walletFeature?.permission).toBe('billing:action_center');
    });

    it('registers canonical financial_history in ALL_AVAILABLE_FEATURES', () => {
      const historyFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'financial_history');
      expect(historyFeature).toBeDefined();
      expect(historyFeature?.name).toBe('Financial History');
      expect(historyFeature?.subtitle).toBe('Receipts & Transactions');
      expect(historyFeature?.route).toBe('/(resident)/billing/history');
      expect(historyFeature?.iconName).toBe('Receipt');
      expect(historyFeature?.categoryKey).toBe('digital_wallet');
      expect(historyFeature?.permission).toBe('billing:action_center');
    });

    it('registers billing_my_dues and billing_dashboard under financial_billing', () => {
      const duesFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_my_dues');
      expect(duesFeature).toBeDefined();
      expect(duesFeature?.route).toBe('/(resident)/billing/my-dues');

      const hubFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_dashboard');
      expect(hubFeature).toBeDefined();
      expect(hubFeature?.route).toBe('/(resident)/billing');
    });

    it('asserts amenities_wallet is not exposed as a duplicate feature in ALL_AVAILABLE_FEATURES', () => {
      const amenityWallet = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'amenities_wallet');
      expect(amenityWallet).toBeUndefined();
    });

    it('asserts exactly ONE user-facing Wallet feature exists in ALL_AVAILABLE_FEATURES', () => {
      const walletFeatures = ALL_AVAILABLE_FEATURES.filter((f) =>
        f.id.includes('wallet') || f.name.toLowerCase().includes('wallet')
      );
      expect(walletFeatures).toHaveLength(1);
      expect(walletFeatures[0].id).toBe('billing_wallet');
      expect(walletFeatures[0].route).toBe('/(resident)/billing/wallet');
    });
  });

  // =========================================================================
  // 2. RBAC Persona Isolation
  // =========================================================================
  describe('2. RBAC Persona Isolation for Financial Features', () => {
    const residentUser = {
      id: 'res-1',
      role: 'Resident',
      permissions: ['billing:action_center', 'visitor:resident'],
    };

    const adminUser = {
      id: 'adm-1',
      role: 'Community Admin',
      permissions: ['billing:dashboard', 'billing:assessment_manager', 'admin:*'],
    };

    const guardUser = {
      id: 'grd-1',
      role: 'Security Guard',
      permissions: ['visitor:guard', 'amenities:scanner'],
    };

    it('grants Resident persona access to personal financial capabilities', () => {
      const walletFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_wallet')!;
      const historyFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'financial_history')!;
      const duesFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_my_dues')!;
      const hubFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_dashboard')!;

      expect(isFeatureAllowedForUser(walletFeature, residentUser)).toBe(true);
      expect(isFeatureAllowedForUser(historyFeature, residentUser)).toBe(true);
      expect(isFeatureAllowedForUser(duesFeature, residentUser)).toBe(true);
      expect(isFeatureAllowedForUser(hubFeature, residentUser)).toBe(true);
    });

    it('grants seeded Resident Owner (amenities:wallet only) access to the Digital Wallet', () => {
      const ownerUser = {
        id: 'own-1',
        role: 'Resident Owner',
        permissions: ['villas:read', 'amenities:discover', 'amenities:my_booking', 'amenities:wallet', 'notices:read'],
      };
      const walletFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_wallet')!;
      const historyFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'financial_history')!;
      const duesFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_my_dues')!;

      expect(isFeatureAllowedForUser(walletFeature, ownerUser)).toBe(true);
      expect(isFeatureAllowedForUser(historyFeature, ownerUser)).toBe(true);
      // amenities:wallet must not leak into billing dues
      expect(isFeatureAllowedForUser(duesFeature, ownerUser)).toBe(false);
    });

    it('denies Community Admin the Digital Wallet when Role Builder does not grant billing:action_center', () => {
      const walletFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_wallet')!;
      const historyFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'financial_history')!;
      const duesFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_my_dues')!;

      // Not granted in Role Builder => hidden, even for admins
      expect(isFeatureAllowedForUser(walletFeature, adminUser)).toBe(false);
      expect(isFeatureAllowedForUser(historyFeature, adminUser)).toBe(false);
      expect(isFeatureAllowedForUser(duesFeature, adminUser)).toBe(false);

      // But Admin maintains access to admin financial consoles
      const ledgerFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_action_center')!;
      const assessmentFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_assessment_manager')!;
      expect(isFeatureAllowedForUser(ledgerFeature, adminUser)).toBe(true);
      expect(isFeatureAllowedForUser(assessmentFeature, adminUser)).toBe(true);
    });

    it('strictly denies Security Guard access to all billing and personal financial capabilities', () => {
      const walletFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_wallet')!;
      const historyFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'financial_history')!;
      const duesFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_my_dues')!;
      const hubFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_dashboard')!;
      const ledgerFeature = ALL_AVAILABLE_FEATURES.find((f) => f.id === 'billing_action_center')!;

      expect(isFeatureAllowedForUser(walletFeature, guardUser)).toBe(false);
      expect(isFeatureAllowedForUser(historyFeature, guardUser)).toBe(false);
      expect(isFeatureAllowedForUser(duesFeature, guardUser)).toBe(false);
      expect(isFeatureAllowedForUser(hubFeature, guardUser)).toBe(false);
      expect(isFeatureAllowedForUser(ledgerFeature, guardUser)).toBe(false);
    });

    it('grants Digital Wallet & Ledger to ANY role granted billing:action_center in Role Builder', () => {
      const actionCenterIds = ['billing_wallet', 'financial_history', 'billing_my_dues'];
      const grantedAdmin = { ...adminUser, permissions: [...adminUser.permissions, 'billing:action_center'] };
      const grantedGuard = { ...guardUser, permissions: [...guardUser.permissions, 'billing:action_center'] };

      actionCenterIds.forEach((id) => {
        const feature = ALL_AVAILABLE_FEATURES.find((f) => f.id === id)!;
        expect(isFeatureAllowedForUser(feature, grantedAdmin)).toBe(true);
        expect(isFeatureAllowedForUser(feature, grantedGuard)).toBe(true);
        expect(isFeatureAllowedForUser(feature, residentUser)).toBe(true);
      });
    });

    it('keeps Digital Wallet & Ledger features out of RESIDENT_ONLY_FEATURE_IDS', () => {
      expect(RESIDENT_ONLY_FEATURE_IDS.has('billing_wallet')).toBe(false);
      expect(RESIDENT_ONLY_FEATURE_IDS.has('financial_history')).toBe(false);
      expect(RESIDENT_ONLY_FEATURE_IDS.has('billing_my_dues')).toBe(false);
    });
  });

  // =========================================================================
  // 3. Decommissioning Direct Top-Up Mutations
  // =========================================================================
  describe('3. Obsolete Direct Wallet Mutation Disabled in Production', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      (process.env as any).NODE_ENV = originalEnv;
    });

    it('walletService.topUpWalletDirect throws an error in production environment', async () => {
      (process.env as any).NODE_ENV = 'production';

      await expect(walletService.topUpWalletDirect(500)).rejects.toThrow(
        /Direct wallet mutation is deprecated and disabled in production/i
      );
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('topUpWalletDirect thunk rejects in production environment', async () => {
      (process.env as any).NODE_ENV = 'production';

      const dispatch = jest.fn();
      const getState = jest.fn();
      const thunk = topUpWalletDirect({ amount: 1000 });

      const result = await thunk(dispatch, getState, undefined);
      expect(result.type).toBe('wallet/topUpWalletDirect/rejected');
      expect(result.payload).toContain('Direct wallet top-up is disabled in production');
    });

    it('topUpWalletThunk alias thunk rejects in production environment', async () => {
      (process.env as any).NODE_ENV = 'production';

      const dispatch = jest.fn();
      const getState = jest.fn();
      const thunk = topUpWalletThunk(750);

      const result = await thunk(dispatch, getState, undefined);
      expect(result.type).toBe('wallet/topUpWalletThunk/rejected');
      expect(result.payload).toContain('Direct wallet top-up is disabled in production');
    });
  });

  // =========================================================================
  // 4. Canonical Order / Verification Flow Delegation
  // =========================================================================
  describe('4. Canonical Razorpay Top-Up Flow Integrity', () => {
    it('walletService.createWalletOrder dispatches to /wallet/create-order with idempotency header', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: {
          orderId: 'order_wlt_123',
          amount: 1500,
          currency: 'INR',
          razorpayKeyId: 'rzp_test_key',
        },
      });

      const result = await walletService.createWalletOrder(1500, 'idem-wlt-order-1');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/wallet/create-order',
        { amount: 1500 },
        expect.objectContaining({
          headers: expect.objectContaining({ 'Idempotency-Key': 'idem-wlt-order-1' }),
        })
      );
      expect(result.orderId).toBe('order_wlt_123');
    });

    it('walletService.verifyWalletPayment dispatches signature to /wallet/verify-payment', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: {
          walletBalance: 2500,
          transaction: {
            transactionId: 'txn_rec_999',
            amount: 1000,
            type: 'credit',
          },
        },
      });

      const verifyPayload = {
        paymentId: 'pay_999',
        orderId: 'order_wlt_123',
        razorpay_payment_id: 'pay_999',
        razorpay_order_id: 'order_wlt_123',
        razorpay_signature: 'sig_valid_hash',
      };

      const result = await walletService.verifyWalletPayment(verifyPayload, 'idem-wlt-verify-1');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/wallet/verify-payment',
        expect.objectContaining({
          paymentId: 'pay_999',
          razorpay_order_id: 'order_wlt_123',
          razorpay_signature: 'sig_valid_hash',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Idempotency-Key': 'idem-wlt-verify-1' }),
        })
      );
      expect(result.walletBalance).toBe(2500);
    });
  });

  // =========================================================================
  // 5. Zero Client-Side Arithmetic & State Integrity
  // =========================================================================
  describe('5. Authoritative Balance Synchronization (Zero Client Arithmetic)', () => {
    it('updates wallet balance strictly from backend payload on verifyWalletPayment.fulfilled', () => {
      const initialState = {
        balance: 500,
        transactions: [],
        transactionHistory: [],
        isPaymentGatewayConfigured: false,
        pagination: { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 },
        isLoading: false,
        loading: false,
        error: null,
      };

      const action = {
        type: verifyWalletPayment.fulfilled.type,
        payload: {
          walletBalance: 1500, // Explicit server authoritative balance
          transaction: {
            _id: 'txn_server_1',
            amount: 1000,
            type: 'CREDIT',
          },
        },
      };

      const state = walletReducer(initialState, action);
      expect(state.balance).toBe(1500); // Set directly from server, not 500 + 1000 client arithmetic
      expect(state.transactionHistory).toHaveLength(1);
    });

    it('updates wallet balance strictly from backend payload on fetchWalletBalance.fulfilled', () => {
      const initialState = {
        balance: 100,
        transactions: [],
        transactionHistory: [],
        isPaymentGatewayConfigured: false,
        pagination: { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 },
        isLoading: false,
        loading: false,
        error: null,
      };

      const action = {
        type: fetchWalletBalance.fulfilled.type,
        payload: {
          balance: 3200,
          transactionHistory: [{ _id: 't1', amount: 50 }],
          isPaymentGatewayConfigured: true,
        },
      };

      const state = walletReducer(initialState, action);
      expect(state.balance).toBe(3200);
      expect(state.isPaymentGatewayConfigured).toBe(true);
    });

    it('syncWalletBalance replaces balance directly with server value without mutation', () => {
      const initialState = {
        balance: 1000,
        transactions: [],
        transactionHistory: [],
        isPaymentGatewayConfigured: false,
        pagination: { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 },
        isLoading: false,
        loading: false,
        error: null,
      };

      const state = walletReducer(initialState, syncWalletBalance(750));
      expect(state.balance).toBe(750);
    });
  });
});
