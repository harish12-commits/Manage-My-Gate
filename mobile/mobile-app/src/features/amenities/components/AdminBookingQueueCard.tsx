/**
 * Staff booking queue row: facility, resident and unit, booking window, booking status,
 * and what needs attention (approval, a staff decision, or a balance still due).
 */

import React from 'react';
import { ListCard } from '@/components/ui/ListCard';
import type { StatusVariant } from '@/components/ui/StatusBadge';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityReservation } from '../types/amenityDomain.types';
import { getBookingStatusVariant } from './ResidentReservationCard';
import { formatAmenityAmount, formatBookingStatusLabel, formatBookingWindow } from '../utils/amenityStateHelpers';

export interface AdminBookingQueueCardProps {
  reservation: AmenityReservation;
  onPress: (reservation: AmenityReservation) => void;
}

const REVIEW_LABELS: Record<string, [string, string]> = {
  NO_SHOW: ['amenity_admin_flag_no_show', 'No-show'],
  UNPAID_BALANCE: ['amenity_admin_flag_unpaid', 'Unpaid balance'],
  OVERDUE_RETURN: ['amenity_admin_flag_overdue', 'Not returned'],
};

export function AdminBookingQueueCard({ reservation, onPress }: AdminBookingQueueCardProps) {
  const { t } = useTranslation();
  const r = reservation;
  const who = [r.userName, r.unitId].filter(Boolean).join(' · ');
  const window = formatBookingWindow(r.startDateTime, r.endDateTime, r.facilityTimezone || 'Asia/Kolkata');
  const balance = Number(r.balanceAmount || 0);
  const active = ['CONFIRMED', 'PENDING_APPROVAL'].includes(r.bookingStatus);

  let attention: { label: string; variant: StatusVariant } | undefined;
  if (r.adminReview?.status === 'PENDING') {
    const [key, fallback] = REVIEW_LABELS[r.adminReview.reason || ''] || ['amenity_admin_flag_review', 'Needs decision'];
    attention = { label: t(key, fallback), variant: 'danger' };
  } else if (r.bookingStatus === 'PENDING_APPROVAL') {
    attention = { label: t('amenity_admin_flag_approval', 'Awaiting approval'), variant: 'warning' };
  } else if (active && balance > 0) {
    attention = { label: t('amenity_card_balance_due', 'Balance {amount} due', { amount: formatAmenityAmount(balance) }), variant: 'warning' };
  }

  return (
    <ListCard
      testID={`admin-booking-${r._id}`}
      title={r.facilityName || t('amenity_facility', 'Amenity Facility')}
      subtitle={[`#${r.reservationNumber || r._id.slice(-6)}`, who, window].filter(Boolean).join(' · ')}
      subtitleLines={2}
      leftIcon="CalendarCheck"
      status={{ label: formatBookingStatusLabel(r.bookingStatus), variant: getBookingStatusVariant(r.bookingStatus) }}
      secondaryBadge={attention}
      showChevron
      onPress={() => onPress(r)}
      accessibilityRole="button"
      accessibilityLabel={`${r.facilityName || ''} ${r.reservationNumber || ''}`}
    />
  );
}

export default AdminBookingQueueCard;
