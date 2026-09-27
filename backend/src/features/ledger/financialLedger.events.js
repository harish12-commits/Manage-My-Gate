import { EventEmitter } from 'events';

export const LEDGER_TRANSACTION_CREATED = 'ledger.transaction.created';
export const LEDGER_TRANSACTION_DUPLICATE = 'ledger.transaction.duplicate';
export const LEDGER_TRANSACTION_FAILED = 'ledger.transaction.failed';

class FinancialLedgerEventEmitter extends EventEmitter {}

export const financialLedgerEventEmitter = new FinancialLedgerEventEmitter();
export default financialLedgerEventEmitter;
