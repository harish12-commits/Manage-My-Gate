import { EventEmitter } from 'events';

export const WALLET_UPDATED = 'WALLET_UPDATED';
export const WALLET_TRANSACTION_CREATED = 'WALLET_TRANSACTION_CREATED';

export const WALLET_DEBIT_STARTED = 'WALLET_DEBIT_STARTED';
export const WALLET_DEBIT_SUCCESS = 'WALLET_DEBIT_SUCCESS';
export const WALLET_DEBIT_FAILED = 'WALLET_DEBIT_FAILED';

export const WALLET_CREDIT_STARTED = 'WALLET_CREDIT_STARTED';
export const WALLET_CREDIT_SUCCESS = 'WALLET_CREDIT_SUCCESS';
export const WALLET_CREDIT_FAILED = 'WALLET_CREDIT_FAILED';

export const walletEventEmitter = new EventEmitter();

// Load socket listeners asynchronously
import { setupWalletSocketListeners } from './wallet.socket.js';
setupWalletSocketListeners().catch((err) => {
  console.error('Failed to initialize wallet socket listeners:', err);
});

export default walletEventEmitter;
