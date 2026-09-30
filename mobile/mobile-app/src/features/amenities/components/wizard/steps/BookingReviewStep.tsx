/**
 * Amenity Management Phase 6B.2 - Step: Booking Review & Authoritative Quote
 * Summarizes reservation specifications and presents the authoritative server quote.
 * ZERO client-side price formulas.
 */

import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { AmenityFacility, AmenityResource, AmenityPricingSnapshot } from '../../../types/amenityDomain.types';
import { getArchetypeMeta } from '../../../utils/amenityPresentation';
import { ShieldCheck, Sparkles, AlertCircle } from 'lucide-react-native';
import { AppLoader } from '@/components/ui/AppLoader';

export interface BookingReviewStepProps {
  facility: AmenityFacility;
  selectedResource: AmenityResource | null;
  /** The requested window, already formatted in the facility timezone. */
  windowLabel: string;
  headcount: number;
  quantity: number;
  pricingSnapshot: AmenityPricingSnapshot | null;
  calculatingPricing?: boolean;
  notes?: string;
  error?: string | null;
}

export function BookingReviewStep({
  facility,
  selectedResource,
  windowLabel,
  headcount,
  quantity,
  pricingSnapshot,
  calculatingPricing = false,
  notes,
  error,
}: BookingReviewStepProps) {
  const archetypeMeta = getArchetypeMeta(facility.archetype);
  const isTool = facility.archetype === 'INVENTORY_TOOLS';
  const requiresApproval = facility.bookingRules?.requiresApproval;

  return (
    <View className="gap-4">
      {/* Header Description */}
      <View>
        <Text variant="large" className="font-bold text-foreground">
          Review Booking Details
        </Text>
        <Text variant="muted" className="text-xs text-muted-foreground mt-0.5">
          Verify your reservation specifics and authoritative pricing quote before creating a hold.
        </Text>
      </View>

      {/* Facility & Schedule Summary */}
      <DetailSection title="Reservation Overview" className="bg-card border border-border">
        <DetailRow label="Facility" value={facility.name} />
        <DetailRow label="Archetype" value={archetypeMeta.label} />

        {selectedResource ? (
          <DetailRow
            label={isTool ? 'Equipment Asset' : 'Room / Space'}
            value={`${selectedResource.name} (${selectedResource.identifier || 'Active'})`}
          />
        ) : null}

        <DetailRow label="When" value={windowLabel} />

        <DetailRow
          label={isTool ? 'Quantity' : 'Total Participants'}
          value={String(isTool ? quantity : headcount)}
        />

        {notes ? <DetailRow label="Special Requests" value={notes} /> : null}
      </DetailSection>

      {/* Authoritative Server Pricing Quote */}
      <DetailSection title="Pricing Quote (Server-Calculated)" className="bg-card border border-border">
        {calculatingPricing ? (
          <View className="py-6 items-center justify-center">
            <AppLoader variant="inline" />
            <Text variant="muted" className="text-xs mt-2">Retrieving authoritative server quote...</Text>
          </View>
        ) : pricingSnapshot ? (
          <>
            <DetailRow
              label="Base Fee"
              value={`${pricingSnapshot.baseAmount} ${pricingSnapshot.currency || 'INR'}`}
            />
            {pricingSnapshot.taxAmount > 0 ? (
              <DetailRow
                label="VAT / Tax"
                value={`${pricingSnapshot.taxAmount} ${pricingSnapshot.currency || 'INR'}`}
              />
            ) : null}
            {pricingSnapshot.depositAmount > 0 ? (
              <DetailRow
                label="Refundable Security Deposit"
                value={`${pricingSnapshot.depositAmount} ${pricingSnapshot.currency || 'INR'}`}
              />
            ) : null}

            <View className="pt-3 mt-1 border-t border-border flex-row items-center justify-between">
              <Text className="font-bold text-sm text-foreground">Total Booking Amount</Text>
              <Text className="font-bold text-base text-primary">
                {pricingSnapshot.totalAmount === 0
                  ? 'Free Access'
                  : `${pricingSnapshot.totalAmount} ${pricingSnapshot.currency || 'INR'}`}
              </Text>
            </View>
          </>
        ) : (
          <View className="p-3">
            <Text variant="muted" className="text-xs">Pricing calculated upon submission.</Text>
          </View>
        )}
      </DetailSection>

      {/* Maker-Checker / Approval Notice */}
      {requiresApproval ? (
        <View className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex-row items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5" />
          <View className="flex-1">
            <Text className="font-bold text-xs text-amber-800 dark:text-amber-200">
              Administrative Approval Required
            </Text>
            <Text className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
              This facility enforces maker-checker governance. After hold creation and confirmation, your request will be placed in PENDING_APPROVAL status for estate management review.
            </Text>
          </View>
        </View>
      ) : (
        <View className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex-row items-center gap-2.5">
          <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
          <Text className="text-xs text-emerald-800 dark:text-emerald-200 font-medium flex-1">
            Instant Confirmation: Your booking will be automatically confirmed upon successful hold.
          </Text>
        </View>
      )}

      {/* Pre-Hold Notice */}
      <View className="p-3 rounded-xl bg-muted/40 border border-border/60 flex-row items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <Text variant="muted" className="text-[11px] text-muted-foreground flex-1">
          Tapping 'Create Hold & Proceed' will place a temporary lock on the selected slot.
        </Text>
      </View>

      {/* Step Error */}
      {error ? (
        <View className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <Text className="text-xs text-destructive font-medium">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default BookingReviewStep;
