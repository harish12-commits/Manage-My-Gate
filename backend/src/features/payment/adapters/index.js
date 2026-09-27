import { BillingPaymentAdapter, billingPaymentAdapter } from './BillingPaymentAdapter.js';
import { AmenityPaymentAdapter, amenityPaymentAdapter } from './AmenityPaymentAdapter.js';
import { WalletPaymentAdapter, walletPaymentAdapter } from './WalletPaymentAdapter.js';

export {
  BillingPaymentAdapter,
  billingPaymentAdapter,
  AmenityPaymentAdapter,
  amenityPaymentAdapter,
  WalletPaymentAdapter,
  walletPaymentAdapter,
};

export default {
  billing: billingPaymentAdapter,
  amenity: amenityPaymentAdapter,
  wallet: walletPaymentAdapter,
};
