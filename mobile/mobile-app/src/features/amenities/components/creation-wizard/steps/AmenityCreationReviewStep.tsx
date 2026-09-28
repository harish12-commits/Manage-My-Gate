import React from 'react';
import { View, ScrollView, Image } from 'react-native';
import { Text } from '@/components/ui/text';
import {
  Building2,
  Clock,
  Calendar,
  CircleDollarSign,
  ShieldCheck,
  Tag,
  MapPin,
  Check,
  AlertCircle,
} from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/src/utils/i18n';
import { AmenityCreationFormState } from '../../../utils/mapAmenityCreationPayloadStrategy';
import { ARCHETYPE_CATALOG_OPTIONS, DAYS_NAMES } from '../../../constants/amenityCatalogPresets';

export interface AmenityCreationReviewStepProps {
  form: AmenityCreationFormState;
  isEditing?: boolean;
  publishError?: string | null;
}

export const AmenityCreationReviewStep: React.FC<AmenityCreationReviewStepProps> = ({
  form,
  isEditing = false,
  publishError = null,
}) => {
  const archetypeMeta =
    ARCHETYPE_CATALOG_OPTIONS.find((o) => o.archetype === form.archetype) ||
    ARCHETYPE_CATALOG_OPTIONS[0];
  const IconComp = archetypeMeta.icon;
  const { t } = useTranslation();

  // How it is booked (event spaces and rooms), in words
  const bookingSummary =
    form.archetype === 'EVENT_SPACE'
      ? form.bookingMode === 'SESSION'
        ? t('amenity_review_booked_sessions', 'Booked by session: {list}', {
            list: (form.sessions || []).map((x) => `${x.name} ${x.startTime}–${x.endTime}`).join(', '),
          })
        : form.bookingMode === 'HOURLY'
        ? t('amenity_review_booked_hourly', 'Booked by the hour ({n} min slots)', { n: form.slotDurationMinutes })
        : t('amenity_review_booked_day', 'Booked for the whole day')
      : form.archetype === 'ROOM_RESOURCE'
      ? form.stayMode === 'OVERNIGHT'
        ? t('amenity_review_booked_overnight', 'Overnight stays: check-in {in}, check-out {out}, up to {n} nights', {
            in: form.checkInTime,
            out: form.checkOutTime,
            n: form.maxNights,
          })
        : t('amenity_review_booked_hourly', 'Booked by the hour ({n} min slots)', { n: form.slotDurationMinutes })
      : null;

  const paymentSummary =
    form.pricingType === 'FREE'
      ? null
      : form.paymentMode === 'ADVANCE'
      ? t('amenity_review_pay_advance', 'Advance {value} when booking, balance later', {
          value: form.advanceType === 'FIXED' ? `₹${form.advanceValue}` : `${form.advanceValue}%`,
        })
      : form.paymentMode === 'PAY_AT_GATE'
      ? t('amenity_review_pay_gate', 'Paid at the gate before entry')
      : t('amenity_review_pay_full', 'Paid in full when booking');

  const activeDayNames = form.openDays
    .map((idx) => DAYS_NAMES[idx])
    .join(', ');

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 gap-4 pb-8"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-1">
        <Text variant="large" className="font-bold text-foreground">
          {isEditing ? 'Review Updated Specifications' : 'Review & Publish Facility'}
        </Text>
        <Text variant="muted" className="text-xs">
          Verify all facility settings and policies before activating for residents.
        </Text>
      </View>

      {/* Prominent Publish Error Banner */}
      {publishError ? (
        <View className="bg-destructive/15 border border-destructive/40 rounded-2xl p-4 flex-row items-start gap-3 shadow-xs">
          <AlertCircle size={20} className="text-destructive shrink-0 mt-0.5" />
          <View className="flex-1 gap-1">
            <Text className="text-sm font-bold text-destructive">
              Unable to Publish Facility
            </Text>
            <Text className="text-xs text-destructive font-medium leading-relaxed">
              {publishError}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Warning Banner if Location is missing */}
      {!form.location?.trim() && (
        <View className="bg-destructive/10 border border-destructive/30 rounded-2xl p-3.5 flex-row items-center gap-2.5">
          <AlertCircle size={18} className="text-destructive shrink-0" />
          <Text className="text-xs text-destructive font-semibold flex-1">
            Location / Zone is required to publish this facility. Return to Basic Information to enter location.
          </Text>
        </View>
      )}

      {/* Main Review Card */}
      <View className="bg-card rounded-3xl border border-border overflow-hidden shadow-xs">
        {/* Cover Photo / Header Banner */}
        {form.imageUrl ? (
          <View className="h-36 w-full relative">
            <Image
              source={{ uri: form.imageUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
            <View className="absolute inset-0 bg-black/40" />
            <View className="absolute bottom-3 start-4 end-4 flex-row items-center justify-between">
              <View className="gap-0.5">
                <Text className="text-lg font-bold text-white shadow-xs">
                  {form.name || 'Unnamed Facility'}
                </Text>
                <Text className="text-xs text-white/90">
                  {form.code || 'NO-CODE'}
                </Text>
              </View>

              <View className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground">
                <IconComp size={12} color="#fff" />
                <Text className="text-xs font-bold text-white">
                  {archetypeMeta.label}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="p-4 pb-2 flex-row items-start justify-between border-b border-border/60">
            <View className="gap-1 flex-1">
              <Text className="text-xl font-bold text-foreground">
                {form.name || 'Unnamed Facility'}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-xs font-semibold text-primary">
                  {form.code || 'NO-CODE'}
                </Text>
                <Text variant="muted" className="text-xs">•</Text>
                <Text variant="muted" className="text-xs">
                  {form.category || 'General'}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <IconComp size={13} className="text-primary" />
              <Text className="text-xs font-bold text-primary">
                {archetypeMeta.label}
              </Text>
            </View>
          </View>
        )}

        <View className="p-4 gap-4">
          {/* Location & Status Row */}
          <View className="flex-row items-center justify-between py-2 border-b border-border/60">
            <View className="flex-row items-center gap-2">
              <MapPin
                size={16}
                className={form.location?.trim() ? 'text-muted-foreground' : 'text-destructive'}
              />
              <Text
                className={cn(
                  'text-xs font-semibold',
                  form.location?.trim() ? 'text-foreground' : 'text-destructive font-bold'
                )}
              >
                {form.location?.trim() || 'Location / Zone Required *'}
              </Text>
            </View>

            <View className="px-2.5 py-0.5 rounded-full bg-muted border border-border">
              <Text className="text-[11px] font-bold text-foreground capitalize">
                {form.status}
              </Text>
            </View>
          </View>

          {/* Operating Hours */}
          <View className="flex-row items-start gap-3">
            <Clock size={18} className="text-primary mt-0.5 shrink-0" />
            <View className="flex-1 gap-0.5">
              <Text className="text-xs font-bold text-foreground">
                Operating Schedule
              </Text>
              <Text className="text-xs text-muted-foreground">
                {form.openTime || '06:00'} to {form.closeTime || '22:00'}
              </Text>
              <Text className="text-[11px] text-primary/80 font-medium">
                Active on: {activeDayNames || 'All Days'}
              </Text>
            </View>
          </View>

          {/* Archetype Specific Attributes */}
          {form.archetype === 'SHARED_CAPACITY' && (
            <View className="flex-row items-start gap-3">
              <Building2 size={18} className="text-primary mt-0.5 shrink-0" />
              <View className="flex-1 gap-0.5">
                <Text className="text-xs font-bold text-foreground">
                  Capacity & Quotas
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Max Capacity: {form.maxCapacity || 50} concurrent people
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Quota Limit: Up to {form.maxHeadcountPerReservation || 2} guests per resident booking
                </Text>
              </View>
            </View>
          )}

          {form.archetype === 'EXCLUSIVE_HOURLY' && (
            <View className="flex-row items-start gap-3">
              <Clock size={18} className="text-primary mt-0.5 shrink-0" />
              <View className="flex-1 gap-0.5">
                <Text className="text-xs font-bold text-foreground">
                  Slots & Turnaround
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Slot Duration: {form.slotDurationMinutes || 60} Minutes
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Setup Buffer: {form.bufferTimeMinutes || 0} Minutes downtime
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Booking Horizon: Up to {form.advanceBookingDays || 7} days in advance
                </Text>
              </View>
            </View>
          )}

          {form.archetype === 'EVENT_SPACE' && (
            <View className="flex-row items-start gap-3">
              <ShieldCheck size={18} className="text-primary mt-0.5 shrink-0" />
              <View className="flex-1 gap-0.5">
                <Text className="text-xs font-bold text-foreground">
                  Event Policies
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Hall Capacity: Up to {form.maxCapacity || 100} guests
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Admin Approval: {form.requiresApproval ? 'Mandatory Admin Review' : 'Auto-confirmed'}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Advance Notice: {form.advanceNoticeHours || 72} Hours required
                </Text>
              </View>
            </View>
          )}

          {form.archetype === 'ROOM_RESOURCE' && (
            <View className="flex-row items-start gap-3">
              <Building2 size={18} className="text-primary mt-0.5 shrink-0" />
              <View className="flex-1 gap-0.5">
                <Text className="text-xs font-bold text-foreground">
                  Sub-Room Resources
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Configured Units: {form.subRooms?.length || 1} independent rooms
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Amenities: {form.roomAmenities?.join(', ') || 'Standard setup'}
                </Text>
              </View>
            </View>
          )}

          {form.archetype === 'INVENTORY_TOOLS' && (
            <View className="flex-row items-start gap-3">
              <ShieldCheck size={18} className="text-primary mt-0.5 shrink-0" />
              <View className="flex-1 gap-0.5">
                <Text className="text-xs font-bold text-foreground">
                  Inventory Controls
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Physical Stock: {form.availableStock || 1} units available
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Max Loan: {form.maxLoanHours || 24} hours checkout limit
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Return Inspection: {form.requiresInspection ? 'Mandatory Guard Check' : 'Optional'}
                </Text>
              </View>
            </View>
          )}

          {/* Pricing & Deposit */}
          <View className="flex-row items-start gap-3 pt-2 border-t border-border/60">
            <CircleDollarSign size={18} className="text-primary mt-0.5 shrink-0" />
            <View className="flex-1 gap-0.5">
              <Text className="text-xs font-bold text-foreground">
                Pricing & Security Deposit
              </Text>
              <Text className="text-xs text-muted-foreground">
                Pricing Model: {form.pricingType}
              </Text>
              {form.pricingType !== 'FREE' && (
                <Text className="text-xs text-foreground font-semibold">
                  Rate: ₹{form.baseRate || 0}
                </Text>
              )}
              {Number(form.securityDeposit) > 0 && (
                <Text className="text-xs text-foreground font-semibold">
                  Refundable Deposit: ₹{form.securityDeposit}
                </Text>
              )}
              {paymentSummary ? (
                <Text testID="review-payment-summary" className="text-xs text-foreground">
                  {paymentSummary}
                </Text>
              ) : null}
              {bookingSummary ? (
                <Text testID="review-booking-summary" className="text-xs text-foreground">
                  {bookingSummary}
                </Text>
              ) : null}
              <Text className="text-xs text-muted-foreground">
                {form.isCancellationAllowed
                  ? t('amenity_review_refund', '{pct}% refunded when cancelled {h}h or more ahead', {
                      pct: form.refundPercentage,
                      h: form.refundCutoffHours,
                    })
                  : t('amenity_review_no_cancel', 'Residents cannot cancel')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Confirmation Readiness Note */}
      <View className="bg-emerald-500/10 p-4 rounded-3xl border border-emerald-500/20 flex-row gap-3 items-center">
        <Check size={20} className="text-emerald-600 shrink-0" />
        <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex-1 leading-4">
          All specifications validated. Tap 'Publish Facility' to make this amenity live in the resident catalog.
        </Text>
      </View>
    </ScrollView>
  );
};

export default AmenityCreationReviewStep;
