/**
 * NAHOM / Connect Harmony - Deterministic Operation-Level Idempotency Utilities
 *
 * Provides standardized idempotency keys for financial mutations across Billing,
 * Amenity Booking, and Digital Wallet domains.
 *
 * Rule:
 * An operation ID is created once when a resident initiates an action (e.g., checkout tap),
 * retained across retry attempts of that exact action, and cleared on terminal success or dismissal.
 */

/**
 * Generate a random unique operation ID.
 */
export const createOperationId = (): string => {
  const rand = Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(36);
  return `op_${rand}_${time}`;
};

/**
 * Invoice Online Payment Order Key: inv-ord-<invoiceId>-<amount>[-<opId>]
 */
export const buildInvoiceOrderKey = (
  invoiceId: string,
  amount: number,
  operationId?: string
): string => {
  const base = `inv-ord-${invoiceId}-${amount}`;
  return operationId ? `${base}-${operationId}` : base;
};

/**
 * Invoice Gateway Verification Key: inv-vfy-<paymentId>-<orderId>
 */
export const buildInvoiceVerifyKey = (paymentId: string, orderId: string): string => {
  return `inv-vfy-${paymentId}-${orderId}`;
};

/**
 * Invoice Wallet Settlement Key: inv-wlt-<invoiceId>-<amount>[-<opId>]
 */
export const buildInvoiceWalletKey = (
  invoiceId: string,
  amount: number,
  operationId?: string
): string => {
  const base = `inv-wlt-${invoiceId}-${amount}`;
  return operationId ? `${base}-${operationId}` : base;
};

/**
 * Invoice Offline Payment Key: invoice-offline-${invoiceId}-${operationId}
 */
export const buildInvoiceOfflineKey = (
  invoiceId: string,
  operationId: string
): string => {
  return `invoice-offline-${invoiceId}-${operationId}`;
};

/**
 * Amenity Pay-at-Gate Idempotency Key: amenity-pay-at-gate-${operationId}
 */
export const buildAmenityPayAtGateKey = (operationId: string): string => {
  return `amenity-pay-at-gate-${operationId}`;
};

/**
 * Amenity Hold Key: amenity-hold-<facilityId>-<slotId>-<opId>
 */
export const buildAmenityHoldKey = (
  facilityId: string,
  slotId: string,
  operationId?: string
): string => {
  return `amenity-hold-${facilityId}-${slotId}-${operationId || 'hold'}`;
};

/**
 * Amenity Booking Creation Key: amenity-booking-<amenityId>-<date>-<slot/time>[-<opId>]
 */
export const buildAmenityBookingKey = (
  amenityId: string,
  date: string,
  startTime: string,
  operationId?: string
): string => {
  const cleanDate = date.replace(/[^a-zA-Z0-9]/g, '');
  const cleanTime = startTime.replace(/[^a-zA-Z0-9]/g, '');
  const base = `amenity-bk-${amenityId}-${cleanDate}-${cleanTime}`;
  return operationId ? `${base}-${operationId}` : base;
};

/**
 * Amenity Online Payment Order Key: amenity-ord-<referenceId>-<amount>[-<opId>]
 */
export const buildAmenityOrderKey = (
  referenceId: string,
  amount: number,
  operationId?: string
): string => {
  const base = `amenity-ord-${referenceId}-${amount}`;
  return operationId ? `${base}-${operationId}` : base;
};

/**
 * Amenity Payment Signature Verification Key: amenity-vfy-<paymentId>-<orderId>
 */
export const buildAmenityVerifyKey = (paymentId: string, orderId: string): string => {
  return `amenity-vfy-${paymentId}-${orderId}`;
};

/**
 * Amenity Reservation Confirmation Key: amenity-cfm-<holdId>
 */
export const buildAmenityConfirmKey = (holdId: string): string => {
  return `amenity-cfm-${holdId}`;
};

/**
 * Wallet Top-Up / Recharge Order Key: wlt-ord-<userId>-<amount>-<opId>
 */
export const buildWalletOrderKey = (
  userId: string,
  amount: number,
  operationId?: string
): string => {
  return `wlt-ord-${userId || 'user'}-${amount}-${operationId || Date.now()}`;
};

/**
 * Wallet Top-Up Verification Key: wlt-vfy-<paymentId>-<orderId>
 */
export const buildWalletVerifyKey = (paymentId: string, orderId: string): string => {
  return `wlt-vfy-${paymentId}-${orderId}`;
};

/**
 * Standard HTTP headers generator for idempotency keys.
 */
export const getIdempotencyHeaders = (
  idempotencyKey?: string
): Record<string, string> => {
  if (!idempotencyKey) return {};
  return {
    'X-Idempotency-Key': idempotencyKey,
    'Idempotency-Key': idempotencyKey,
  };
};

export default {
  createOperationId,
  buildInvoiceOrderKey,
  buildInvoiceVerifyKey,
  buildInvoiceWalletKey,
  buildAmenityHoldKey,
  buildAmenityBookingKey,
  buildAmenityOrderKey,
  buildAmenityVerifyKey,
  buildAmenityConfirmKey,
  buildWalletOrderKey,
  buildWalletVerifyKey,
  getIdempotencyHeaders,
};
