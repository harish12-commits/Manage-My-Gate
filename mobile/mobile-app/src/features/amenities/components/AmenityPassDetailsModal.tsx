import React, { useState } from 'react';
import { View, Share, ActivityIndicator, Linking, Alert, Platform, Clipboard } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { StatusBadge, StatusVariant } from '@/components/ui/StatusBadge';
import { DetailRow } from '@/components/ui/DetailRow';
import { QRCodeView } from '@/components/ui/QRCodeView';
import { QrCode, ShieldAlert, Copy, Check, Share2, MessageCircle } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';
import { shareQrImage } from '@/src/utils/qrPngGenerator';
import { buildAmenityPassShareMessage } from '@/src/utils/appBarcodeProtocol';
import { AmenityReservation, AmenityAccessPass } from '../types/amenityDomain.types';
import { AmenityBooking } from '../store/amenityBookingSlice';
import {
  formatUtcToLocalDisplay,
  formatReservationDate,
  formatReservationTimeRange,
  formatTimeRange12Hour,
  formatAmenityPassCode,
} from '../utils/amenityStateHelpers';

export interface AmenityPassDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  reservation?: AmenityReservation | null;
  booking?: AmenityBooking | null;
  accessPass?: AmenityAccessPass | null;
  onCancelPress?: (target: AmenityReservation | AmenityBooking) => void;
}

const mapAmenityStatusVariant = (status?: string): StatusVariant => {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'CONFIRMED':
    case 'PAID':
    case 'ACTIVE':
      return 'success';
    case 'PENDING':
    case 'PENDING_APPROVAL':
    case 'PENDING_REVIEW':
      return 'warning';
    case 'CHECKED_IN':
    case 'CHECKED-IN':
      return 'info';
    case 'CANCELLED':
    case 'REJECTED':
      return 'danger';
    case 'EXPIRED':
    case 'COMPLETED':
    default:
      return 'neutral';
  }
};

export const AmenityPassDetailsModal: React.FC<AmenityPassDetailsModalProps> = ({
  visible,
  onClose,
  reservation,
  booking,
  accessPass,
  onCancelPress,
}) => {
  const { t, translateText } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(true);
  const [sharingImage, setSharingImage] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  if (!visible || (!reservation && !booking)) return null;

  // Polymorphic extraction for V2 AmenityReservation or V1 AmenityBooking
  const isV2Reservation = Boolean(reservation);

  const facilityName = isV2Reservation
    ? reservation?.facilityName || 'Amenity Facility'
    : (typeof booking?.amenityId === 'object' && booking?.amenityId
        ? booking.amenityId.name
        : booking?.amenityName || 'Amenity Facility');

  const rawCandidate =
    (reservation as any)?.reservationNumber ||
    (booking as any)?.bookingId ||
    (reservation as any)?.passCode ||
    (booking as any)?.passCode ||
    (accessPass as any)?.passCode ||
    reservation?._id ||
    booking?._id;

  const rawId = rawCandidate;
  const passCode = formatAmenityPassCode(rawCandidate, facilityName);

  const resourceName = isV2Reservation ? reservation?.resourceName : null;

  const location = isV2Reservation
    ? null
    : (typeof booking?.amenityId === 'object' && booking?.amenityId
        ? booking.amenityId.location
        : booking?.amenityLocation || null);

  const rawStatus = isV2Reservation
    ? reservation?.bookingStatus || 'CONFIRMED'
    : booking?.status || 'CONFIRMED';

  const statusLabel = translateText(rawStatus);
  const statusVariant = mapAmenityStatusVariant(rawStatus);

  // Time & Date resolution
  const tz = reservation?.facilityTimezone || 'Asia/Kolkata';
  let formattedDate = '';
  let formattedTime = '';

  if (isV2Reservation && reservation) {
    const rawStart =
      reservation.startDateTime ||
      (reservation as any).effectiveStartDateTime ||
      (reservation as any).requestedStartDateTime;
    const rawEnd =
      reservation.endDateTime ||
      (reservation as any).effectiveEndDateTime ||
      (reservation as any).requestedEndDateTime;

    formattedDate = formatReservationDate(rawStart, tz) || (reservation as any).date || '';
    formattedTime = formatReservationTimeRange(rawStart, rawEnd, tz) || '';
  } else if (booking) {
    formattedDate = booking.date || (booking as any).bookingDate || '';
    formattedTime =
      booking.startTime && booking.endTime
        ? formatTimeRange12Hour(booking.startTime, booking.endTime)
        : booking.startTime || booking.endTime
        ? formatTimeRange12Hour(booking.startTime || booking.endTime)
        : 'Full Day';
  }

  const destinationUnit = isV2Reservation
    ? (reservation?.unitId as any)?.unitNumber || (reservation?.unitId as any)?.name || null
    : (booking as any)?.unit || (booking as any)?.villaNumber || null;

  const headcount = isV2Reservation
    ? reservation?.headcount
    : booking?.numberOfPersons || booking?.guestsCount;

  // Token & QR Resolution (Canonical MMG:AMENITY:<token>)
  const directToken = accessPass?.qrData || accessPass?.passCode;
  const qrString = directToken && String(directToken).startsWith('MMG:AMENITY:')
    ? String(directToken)
    : directToken && !String(directToken).startsWith('data:')
    ? `MMG:AMENITY:${directToken}`
    : null;
  const hasIssuedPass = Boolean(accessPass?._id && qrString);

  const isCancellable =
    rawStatus !== 'CANCELLED' &&
    rawStatus !== 'REJECTED' &&
    rawStatus !== 'COMPLETED' &&
    (reservation as any)?.accessStatus !== 'CHECKED_OUT' &&
    Boolean(onCancelPress);

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(passCode);
    } else if (Clipboard && typeof Clipboard.setString === 'function') {
      Clipboard.setString(passCode);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildShareText = () => {
    return buildAmenityPassShareMessage({
      passCode,
      facilityName,
      date: formattedDate,
      timeWindow: formattedTime,
      location: location || resourceName || undefined,
      destinationUnit: destinationUnit || undefined,
      barcodePayload: qrString || '',
      validUntil: accessPass?.validUntil ? String(accessPass.validUntil) : undefined,
    });
  };

  const handleSendWhatsAppMessage = async () => {
    const text = buildShareText();
    const nativeWhatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;

    if (Platform.OS !== 'web') {
      try {
        await Linking.openURL(nativeWhatsappUrl);
        return;
      } catch (err) {
        console.log('Could not open WhatsApp directly:', err);
      }

      // WhatsApp not installed: fallback to native OS share sheet
      try {
        await Share.share({
          title: `Amenity Pass - ${facilityName} (${passCode})`,
          message: text,
        });
        return;
      } catch (shareErr) {
        console.log('Error opening native share sheet:', shareErr);
      }
    }

    // Web browser environment
    const webWhatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    try {
      if (typeof window !== 'undefined') {
        window.open(webWhatsAppUrl, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(webWhatsAppUrl);
      }
    } catch {
      handleCopyCode();
      Alert.alert('Pass Copied', 'Pass details copied to clipboard.');
    }
  };

  const handleShareBarcodeToWhatsApp = async () => {
    if (!qrString) {
      Alert.alert('Pass Pending', 'Your access pass will appear once this booking is confirmed.');
      return;
    }
    if (sharingImage) return;
    setSharingImage(true);
    try {
      const shared = await shareQrImage(
        qrString,
        passCode,
        `Amenity Pass - ${facilityName} (${passCode})`
      );
      if (!shared) {
        await handleSendWhatsAppMessage();
      }
    } catch (e) {
      console.log('Error sharing QR image:', e);
      await handleSendWhatsAppMessage();
    } finally {
      setSharingImage(false);
    }
  };

  const handleSharePassText = async () => {
    const text = buildShareText();

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: `Amenity Pass - ${facilityName} (${passCode})`,
            text,
          });
          return;
        } catch (e: any) {
          if (e.name === 'AbortError') return;
        }
      }
      handleCopyCode();
      Alert.alert('Pass Copied', 'Amenity pass details copied to clipboard!');
      return;
    }

    try {
      await Share.share({
        title: `Amenity Pass - ${facilityName} (${passCode})`,
        message: text,
      });
    } catch (err) {
      console.log('Error sharing pass', err);
    }
  };

  const handleConfirmCancel = () => {
    setCancelConfirm(false);
    onClose();
    if (reservation) {
      onCancelPress?.(reservation);
    } else if (booking) {
      onCancelPress?.(booking);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('amenity_pass_details', 'Amenity Pass Details')}>
      <View className="gap-4 p-2 pb-6">
        {/* Top Keycode Badge: Exactly matches Visitor Pass Keycode header */}
        <View className="bg-primary/10 border border-primary/20 rounded-2xl p-4 items-center justify-center gap-2">
          <Text variant="muted" className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
            {t('amenity_pass_keycode', 'AMENITY PASSKEYCODE')}
          </Text>
          <Text className="text-3xl font-extrabold text-primary tracking-widest font-mono">
            {passCode}
          </Text>
        </View>

        {/* Action Controls */}
        <View className="gap-2.5">
          {/* Primary Action: Send Barcode & Pass to WhatsApp */}
          <Button
            onPress={handleShareBarcodeToWhatsApp}
            disabled={sharingImage || !hasIssuedPass}
            className="w-full h-12 rounded-xl bg-[#25D366] active:bg-[#1EBE5D] flex-row items-center justify-center gap-2.5 shadow-sm"
            accessibilityLabel="Share Amenity Pass Barcode and Code on WhatsApp"
          >
            {sharingImage ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MessageCircle size={19} color="#FFFFFF" strokeWidth={2.5} />
                <Text className="font-bold text-white text-sm">
                  {t('share_barcode_pass_to_whatsapp', 'Share Barcode & Pass to WhatsApp')}
                </Text>
              </>
            )}
          </Button>

          {/* Secondary Action Row: Copy Code, Share Pass, Toggle QR */}
          <View className="flex-row gap-2">
            <Button
              variant="outline"
              onPress={handleCopyCode}
              className="flex-1 h-10 rounded-xl border-border bg-card active:bg-muted flex-row items-center justify-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check size={15} className="text-emerald-600" />
                  <Text className="font-bold text-emerald-600 text-xs">{t('copied', 'Copied')}</Text>
                </>
              ) : (
                <>
                  <Copy size={15} className="text-foreground" />
                  <Text className="font-bold text-foreground text-xs">{t('copy_code', 'Copy Code')}</Text>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onPress={handleSharePassText}
              className="flex-1 h-10 rounded-xl border-blue-500/30 bg-blue-500/10 active:bg-blue-500/20 flex-row items-center justify-center gap-1.5"
              accessibilityLabel="Share Amenity Pass"
            >
              <Share2 size={15} className="text-blue-600 dark:text-blue-400" />
              <Text className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                {t('share_pass', 'Share Pass')}
              </Text>
            </Button>

            <Button
              variant="outline"
              onPress={() => setShowQR(!showQR)}
              disabled={!hasIssuedPass}
              className="h-10 px-3.5 rounded-xl border-border bg-card active:bg-muted flex-row items-center justify-center gap-1.5"
            >
              <QrCode size={15} className="text-foreground" />
              <Text className="font-bold text-foreground text-xs">
                {showQR ? t('hide', 'Hide') : t('qr_view', 'QR View')}
              </Text>
            </Button>
          </View>
        </View>

        {/* QR Code Presentation Container */}
        {showQR && hasIssuedPass && qrString && (
          <View className="items-center justify-center bg-card border border-border rounded-2xl p-4 gap-2">
            <QRCodeView
              value={qrString}
              size={170}
              caption={t('valid_for_amenity', `Valid for ${facilityName}`)}
            />
          </View>
        )}
        {showQR && !hasIssuedPass && (
          <View className="items-center justify-center bg-muted/40 border border-border rounded-2xl p-4 gap-1">
            <Text className="text-sm font-bold text-foreground">Access pass not issued yet</Text>
            <Text className="text-xs text-muted-foreground text-center">
              The barcode is available after payment and any required approval are complete.
            </Text>
          </View>
        )}

        {/* Pass Status Pill Row */}
        <View className="flex-row items-center justify-between bg-card border border-border rounded-xl p-3">
          <Text variant="small" className="font-semibold text-foreground">
            {t('pass_status', 'Pass Status')}
          </Text>
          <StatusBadge label={statusLabel} variant={statusVariant} dot />
        </View>

        {/* Detailed Attribute Rows */}
        <View className="bg-card border border-border rounded-xl p-3 gap-2">
          <DetailRow label={t('facility', 'Facility')} value={facilityName} />
          {resourceName ? <DetailRow label={t('court_resource', 'Court / Resource')} value={resourceName} /> : null}
          {location ? <DetailRow label={t('location', 'Location')} value={location} /> : null}
          <DetailRow label={t('booking_code', 'Booking Code')} value={passCode} copyable />
          {formattedDate ? <DetailRow label={t('reservation_date', 'Reservation Date')} value={formattedDate} /> : null}
          {formattedTime ? <DetailRow label={t('time_window', 'Time Window')} value={formattedTime} /> : null}
          {destinationUnit ? <DetailRow label={t('unit_villa', 'Unit / Villa')} value={destinationUnit} /> : null}
          {headcount ? (
            <DetailRow
              label={t('attendees', 'Attendees')}
              value={`${headcount} ${t('persons_count', 'Person(s)')}`}
            />
          ) : null}
          {accessPass?.validFrom ? (
            <DetailRow
              label={t('valid_from', 'Valid From')}
              value={new Date(accessPass.validFrom).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            />
          ) : null}
          {accessPass?.validUntil ? (
            <DetailRow
              label={t('valid_until', 'Valid Until')}
              value={new Date(accessPass.validUntil).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            />
          ) : null}
        </View>

        {/* Cancel / Revoke Action */}
        {isCancellable && (
          cancelConfirm ? (
            <View className="mt-1 p-4 bg-destructive/10 border border-destructive/30 rounded-2xl gap-3">
              <View className="flex-row items-center gap-2">
                <ShieldAlert size={20} className="text-destructive" />
                <Text className="text-sm font-bold text-destructive">
                  {t('cancel_booking_question', 'Cancel Amenity Booking?')}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                {t('cancel_booking_warning', `This will cancel your reservation for ${facilityName} and release your slot.`)}
              </Text>
              <View className="flex-row gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setCancelConfirm(false)}
                  className="flex-1"
                >
                  <Text>{t('back', 'Back')}</Text>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onPress={handleConfirmCancel}
                  className="flex-1 flex-row items-center justify-center gap-2"
                >
                  <Text className="text-white font-bold">{t('confirm_cancel', 'Confirm Cancel')}</Text>
                </Button>
              </View>
            </View>
          ) : (
            <Button
              variant="outline"
              onPress={() => setCancelConfirm(true)}
              className="mt-1 h-11 rounded-xl border-destructive/40 active:bg-destructive/10 flex-row items-center justify-center gap-2"
            >
              <Text className="text-destructive font-semibold text-xs">
                {t('cancel_booking', 'Cancel Booking')}
              </Text>
            </Button>
          )
        )}
      </View>
    </BottomSheet>
  );
};

export default AmenityPassDetailsModal;
