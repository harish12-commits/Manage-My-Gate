/**
 * One booking in the staff queue: who, what, when, the money, and the actions that
 * apply to its current state — approve / reject, decide a flagged booking, record the
 * balance paid in cash, or cancel. Each action is confirmed by the screen.
 */

import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/button';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityReservation } from '../types/amenityDomain.types';
import { getBookingStatusVariant, getPaymentStatusVariant } from './ResidentReservationCard';
import {
  formatAmenityAmount,
  formatBookingStatusLabel,
  formatBookingWindow,
  formatPaymentStatusLabel,
} from '../utils/amenityStateHelpers';

export interface AdminBookingActionsSheetProps {
  reservation: AmenityReservation | null;
  visible: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDecideReview: () => void;
  onCollectCash: () => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

const REVIEW_REASONS: Record<string, [string, string]> = {
  NO_SHOW: ['amenity_admin_review_no_show', 'The resident did not check in.'],
  UNPAID_BALANCE: ['amenity_admin_review_unpaid', 'The balance was not paid before the booking started.'],
  OVERDUE_RETURN: ['amenity_admin_review_overdue', 'The item was not returned on time.'],
};

export function AdminBookingActionsSheet({
  reservation,
  visible,
  onClose,
  onApprove,
  onReject,
  onDecideReview,
  onCollectCash,
  onCancel,
  loading = false,
  error = null,
}: AdminBookingActionsSheetProps) {
  const { t } = useTranslation();
  if (!visible || !reservation) return null;

  const r = reservation;
  const balance = Number(r.balanceAmount || 0);
  const pendingApproval = r.bookingStatus === 'PENDING_APPROVAL';
  const needsDecision = r.adminReview?.status === 'PENDING';
  const active = ['CONFIRMED', 'PENDING_APPROVAL'].includes(r.bookingStatus) && r.completionStatus !== 'NO_SHOW';
  const notStarted = !['CHECKED_IN', 'CHECKED_OUT'].includes(r.accessStatus);
  const review = needsDecision ? REVIEW_REASONS[r.adminReview?.reason || ''] : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={r.facilityName || t('amenity_facility', 'Amenity Facility')}>
      <View testID="admin-booking-sheet" className="gap-3 pb-2">
        <View className="flex-row flex-wrap gap-2">
          <StatusBadge label={formatBookingStatusLabel(r.bookingStatus)} variant={getBookingStatusVariant(r.bookingStatus)} />
          <StatusBadge label={formatPaymentStatusLabel(r.paymentStatus)} variant={getPaymentStatusVariant(r.paymentStatus)} />
        </View>

        {review ? (
          <View className="bg-status-warning/10 border border-status-warning/30 p-3 rounded-2xl">
            <Text className="text-sm font-semibold text-foreground">{t('amenity_admin_review_title', 'Needs a staff decision')}</Text>
            <Text variant="muted" className="text-xs mt-0.5">{t(review[0], review[1])}</Text>
          </View>
        ) : null}

        <DetailSection title={t('amenity_admin_booking_section', 'Booking')} iconName="CalendarCheck">
          <DetailRow label={t('amenity_admin_booking_ref', 'Booking #')} value={r.reservationNumber || r._id} copyable />
          <DetailRow label={t('amenity_admin_resident', 'Resident')} value={r.userName || '—'} />
          {r.unitId ? <DetailRow label={t('amenity_admin_unit', 'Unit')} value={String(r.unitId)} /> : null}
          {r.resourceName ? <DetailRow label={t('amenity_admin_resource', 'Space / item')} value={r.resourceName} /> : null}
          <DetailRow
            label={t('amenity_admin_when', 'When')}
            value={formatBookingWindow(r.startDateTime, r.endDateTime, r.facilityTimezone || 'Asia/Kolkata')}
          />
          <DetailRow label={t('amenity_admin_party', 'Party size')} value={String(r.headcount || 1)} isLast={!r.notes} />
          {r.notes ? <DetailRow label={t('amenity_admin_notes', 'Notes')} value={r.notes} isLast /> : null}
        </DetailSection>

        <DetailSection title={t('amenity_payment_title', 'Payment')} iconName="CreditCard">
          <DetailRow label={t('amenity_payment_total', 'Total')} value={formatAmenityAmount(r.totalAmount)} />
          <DetailRow label={t('amenity_payment_paid', 'Paid')} value={formatAmenityAmount(r.paidAmount)} />
          {balance > 0 ? <DetailRow label={t('amenity_payment_balance', 'Balance due')} value={formatAmenityAmount(balance)} /> : null}
          {Number(r.refundAmount || 0) > 0 ? (
            <DetailRow label={t('amenity_payment_refunded', 'Refunded to wallet')} value={formatAmenityAmount(r.refundAmount)} />
          ) : null}
          {r.cancellationReason ? (
            <DetailRow label={t('amenity_admin_cancel_reason', 'Cancellation reason')} value={r.cancellationReason} isLast />
          ) : null}
        </DetailSection>

        {error ? <ErrorBanner title={t('amenity_admin_action_failed', 'Not completed')} message={error} /> : null}

        <View className="gap-2.5">
          {pendingApproval ? (
            <View className="flex-row gap-3">
              <Button variant="outline" className="flex-1 border-destructive/40" disabled={loading} onPress={onReject} testID="admin-booking-reject">
                <Text className="font-semibold text-sm text-destructive">{t('amenity_admin_reject', 'Reject')}</Text>
              </Button>
              <Button variant="success" className="flex-1" disabled={loading} onPress={onApprove} testID="admin-booking-approve">
                <Text className="font-bold text-sm text-primary-foreground">{t('amenity_admin_approve', 'Approve')}</Text>
              </Button>
            </View>
          ) : null}

          {needsDecision ? (
            <Button disabled={loading} onPress={onDecideReview} testID="admin-booking-decide">
              <Text className="font-bold text-sm text-primary-foreground">{t('amenity_admin_decide', 'Decide')}</Text>
            </Button>
          ) : null}

          {active && !pendingApproval && balance > 0 && !needsDecision ? (
            <Button variant="outline" disabled={loading} onPress={onCollectCash} testID="admin-booking-collect">
              <Text className="font-semibold text-sm">
                {t('amenity_admin_collect_cash', 'Record {amount} paid in cash', { amount: formatAmenityAmount(balance) })}
              </Text>
            </Button>
          ) : null}

          {active && notStarted && !needsDecision ? (
            <Button variant="outline" className="border-destructive/40" disabled={loading} onPress={onCancel} testID="admin-booking-cancel">
              <Text className="font-semibold text-sm text-destructive">{t('amenity_admin_cancel_booking', 'Cancel booking')}</Text>
            </Button>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

export default AdminBookingActionsSheet;
