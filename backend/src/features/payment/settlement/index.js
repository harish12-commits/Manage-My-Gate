import invoiceSettlementHandler, { InvoiceSettlementHandler } from './InvoiceSettlementHandler.js';
import amenitySettlementHandler, { AmenitySettlementHandler } from './AmenitySettlementHandler.js';
import walletRechargeSettlementHandler, { WalletRechargeSettlementHandler } from './WalletRechargeSettlementHandler.js';
import { PAYMENT_DOMAINS } from '../payment.constants.js';
import HttpError from '../../../utils/httpError.utils.js';

export class SettlementHandlerRegistry {
  constructor() {
    this._handlers = new Map();
    this.registerHandler(PAYMENT_DOMAINS.INVOICE, invoiceSettlementHandler);
    this.registerHandler(PAYMENT_DOMAINS.AMENITY, amenitySettlementHandler);
    this.registerHandler(PAYMENT_DOMAINS.WALLET, walletRechargeSettlementHandler);
  }

  registerHandler(domain, handler) {
    if (!domain || !handler) {
      throw new HttpError(500, 'Domain and handler are required to register settlement handler.');
    }
    this._handlers.set(domain.toUpperCase(), handler);
  }

  getHandler(domain) {
    const key = (domain || '').toUpperCase();
    const handler = this._handlers.get(key);
    if (!handler) {
      throw new HttpError(400, `No settlement handler registered for domain '${domain}'.`);
    }
    return handler;
  }
}

export const settlementHandlerRegistry = new SettlementHandlerRegistry();

export {
  DomainSettlementInterface,
} from './DomainSettlementInterface.js';

export {
  InvoiceSettlementHandler,
  invoiceSettlementHandler,
  AmenitySettlementHandler,
  amenitySettlementHandler,
  WalletRechargeSettlementHandler,
  walletRechargeSettlementHandler,
};

export default settlementHandlerRegistry;
