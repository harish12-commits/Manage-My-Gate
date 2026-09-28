/**
 * Pays what is still owed on a booking: from the digital wallet, or online
 * (order → checkout → verify; the server settles and returns the updated booking).
 * The amount always comes from the server's balance — residents never enter one.
 */

import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store/store';
import {
  payReservationBalanceThunk,
  createBalancePaymentOrderThunk,
  verifyReservationPaymentThunk,
} from '../store/amenityBookingSlice';
import { fetchWalletBalance } from '../../wallet/store/walletSlice';
import paymentService from '../../payment/services/paymentService';
import { RazorpayCheckoutOptions } from '../../billing/components/RazorpayCheckoutModal';
import { AmenityReservation } from '../types/amenityDomain.types';
import { useTranslation } from '@/src/utils/i18n';

export function useReservationBalancePayment(reservation: AmenityReservation | null) {
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useTranslation();
  const walletBalance = useSelector((state: RootState) => Number(state.wallet?.balance ?? 0));
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRazorpayConfigured, setIsRazorpayConfigured] = useState(false);
  const [razorpayOptions, setRazorpayOptions] = useState<RazorpayCheckoutOptions | null>(null);
  const [isRazorpayOpen, setIsRazorpayOpen] = useState(false);

  const reservationId = reservation?._id;
  const amountDue = Number(reservation?.balanceAmount || 0);
  const canPay =
    amountDue > 0 &&
    Boolean(reservation) &&
    ['CONFIRMED', 'PENDING_APPROVAL'].includes(String(reservation?.bookingStatus)) &&
    reservation?.completionStatus !== 'NO_SHOW';

  useEffect(() => {
    if (!canPay) return;
    let active = true;
    dispatch(fetchWalletBalance());
    paymentService
      .getGatewayStatus()
      .then((res: any) => {
        const data = res?.data || res;
        if (active) setIsRazorpayConfigured(Boolean(data?.isConfigured ?? data === true));
      })
      .catch(() => active && setIsRazorpayConfigured(false));
    return () => {
      active = false;
    };
  }, [canPay, dispatch]);

  const payFromWallet = useCallback(async () => {
    if (!reservationId || paying) return;
    if (walletBalance < amountDue) {
      setError(
        t('amenity_balance_err_low_wallet', 'Your wallet balance ({balance}) is less than the balance due ({due}). Top up or pay online.', {
          balance: walletBalance,
          due: amountDue,
        })
      );
      return;
    }
    setPaying(true);
    setError(null);
    try {
      await dispatch(payReservationBalanceThunk(reservationId)).unwrap();
      dispatch(fetchWalletBalance());
    } catch (err: any) {
      setError(err?.message || t('amenity_balance_err_pay', 'The balance could not be paid. Please try again.'));
    } finally {
      setPaying(false);
    }
  }, [reservationId, paying, walletBalance, amountDue, dispatch, t]);

  const payOnline = useCallback(async () => {
    if (!reservationId || paying) return;
    setPaying(true);
    setError(null);
    try {
      const order = await dispatch(createBalancePaymentOrderThunk(reservationId)).unwrap();
      if (!order?.paymentId || !order?.orderId || !order?.razorpayKeyId) {
        throw new Error(t('amenity_booking_err_gateway', 'The payment gateway did not return a valid checkout.'));
      }
      setRazorpayOptions({
        paymentId: order.paymentId,
        orderId: order.orderId,
        razorpayKeyId: order.razorpayKeyId,
        amount: Number(order.amount || 0),
        currency: order.currency || 'INR',
        description: t('amenity_balance_payment_for', 'Booking balance #{number}', {
          number: reservation?.reservationNumber || '',
        }),
      });
      setIsRazorpayOpen(true);
    } catch (err: any) {
      setError(err?.message || t('amenity_balance_err_pay', 'The balance could not be paid. Please try again.'));
    } finally {
      setPaying(false);
    }
  }, [reservationId, reservation?.reservationNumber, paying, dispatch, t]);

  const onRazorpaySuccess = useCallback(
    async (payload: any) => {
      setIsRazorpayOpen(false);
      setPaying(true);
      setError(null);
      try {
        const result = await dispatch(
          verifyReservationPaymentThunk({
            paymentId: payload?.paymentId || razorpayOptions?.paymentId || '',
            orderId: payload?.orderId || payload?.razorpayOrderId || razorpayOptions?.orderId || '',
            razorpayPaymentId: payload?.razorpayPaymentId || payload?.razorpay_payment_id,
            razorpaySignature: payload?.razorpaySignature || payload?.razorpay_signature,
          })
        ).unwrap();
        if (!result.fulfilled) {
          setError(t('amenity_balance_err_not_applied', 'The payment could not be applied to this booking and is being refunded.'));
        }
      } catch (err: any) {
        setError(err?.message || t('amenity_booking_err_verify', 'Your payment could not be verified. Check My Bookings before paying again.'));
      } finally {
        setPaying(false);
        setRazorpayOptions(null);
      }
    },
    [dispatch, razorpayOptions, t]
  );

  const onRazorpayDismiss = useCallback(() => {
    setIsRazorpayOpen(false);
    setRazorpayOptions(null);
  }, []);

  const onRazorpayError = useCallback(
    (err: { description?: string } | null) => {
      setIsRazorpayOpen(false);
      setRazorpayOptions(null);
      setError(err?.description || t('amenity_balance_err_checkout', 'The online payment was cancelled or failed.'));
    },
    [t]
  );

  return {
    canPay,
    amountDue,
    walletBalance,
    paying,
    error,
    clearError: () => setError(null),
    isRazorpayConfigured,
    razorpayOptions,
    isRazorpayOpen,
    payFromWallet,
    payOnline,
    onRazorpaySuccess,
    onRazorpayDismiss,
    onRazorpayError,
  };
}

export default useReservationBalancePayment;
