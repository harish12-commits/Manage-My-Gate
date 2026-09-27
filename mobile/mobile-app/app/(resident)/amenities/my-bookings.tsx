/**
 * My Bookings Screen - Phase 6C.2 Modernization
 * Resident Amenity Reservation Management List UI.
 * Consumes Phase 6C.1 useResidentReservations foundation and preserves the five orthogonal backend status dimensions.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { SearchFilterBar, SortOption } from '@/components/ui/SearchFilterBar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  useResidentReservations,
  ReservationFilterTab,
} from '@/src/features/amenities/hooks/useResidentReservations';
import { ResidentReservationCard } from '@/src/features/amenities/components/ResidentReservationCard';
import { ResidentCancelModal } from '@/src/features/amenities/components/ResidentCancelModal';
import { AmenityPassDetailsModal } from '@/src/features/amenities/components/AmenityPassDetailsModal';
import { AmenityAccessPass, AmenityReservation } from '@/src/features/amenities/types/amenityDomain.types';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';
import { useTranslation } from '@/src/utils/i18n';

export default function MyBookingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, language } = useTranslation();

  // Guard: Users without resident booking permissions are redirected
  const hasBookingsAccess =
    isFeatureAllowedForUser({ id: 'amenities_my_booking', permission: 'amenities:my_booking' }, user) ||
    isFeatureAllowedForUser({ id: 'amenities_dashboard', permission: 'amenities:dashboard' }, user) ||
    isFeatureAllowedForUser({ id: 'amenities_master', permission: 'amenities:amenities' }, user);

  if (user && !hasBookingsAccess) {
    if (isFeatureAllowedForUser({ id: 'amenities_scanner', permission: 'amenities:scanner' }, user)) {
      return <Redirect href="/(resident)/amenities/scanner" />;
    }
    return <Redirect href="/(resident)/dashboard" />;
  }

  const {
    reservations,
    filteredReservations,
    loading,
    isRefreshing,
    isCancelling,
    error,
    pagination,
    selectedTab,
    setSelectedTab,
    searchQuery,
    setSearchQuery,
    cancelTarget,
    setCancelTarget,
    cancelReservation,
    fetchPassesByReservation,
    refresh,
    loadMore,
  } = useResidentReservations();

  const [selectedPassReservation, setSelectedPassReservation] = React.useState<AmenityReservation | null>(null);
  const [selectedAccessPass, setSelectedAccessPass] = React.useState<AmenityAccessPass | null>(null);
  const [passModalOpen, setPassModalOpen] = React.useState(false);

  // Canonical presentation category tabs
  const sortOptions: SortOption[] = useMemo(
    () => [
      { label: t('all', 'All'), value: 'All' },
      { label: t('upcoming', 'Upcoming'), value: 'Upcoming' },
      { label: t('awaiting_approval', 'Awaiting Approval'), value: 'Awaiting Approval' },
      { label: t('past', 'Past'), value: 'Past' },
      { label: t('cancelled', 'Cancelled'), value: 'Cancelled' },
    ],
    [t]
  );

  const handleCardPress = (reservation: AmenityReservation) => {
    router.push(`/(resident)/amenities/reservations/${reservation._id}` as any);
  };

  const handleConfirmCancel = async (reason?: string) => {
    if (!cancelTarget) return;
    try {
      await cancelReservation(cancelTarget._id, reason);
    } catch {
      // Error is caught and surfaced in state error
    }
  };

  const handleShowPass = async (reservation: AmenityReservation) => {
    setSelectedPassReservation(reservation);
    setSelectedAccessPass(null);
    setPassModalOpen(true);

    try {
      // A pass is an authoritative, server-issued credential.  Never render a
      // locally invented barcode when the booking is still awaiting approval.
      const passes = await fetchPassesByReservation(reservation._id);
      const pass = passes.find((item: AmenityAccessPass) => String(item.reservationId) === String(reservation._id)) || passes[0] || null;
      setSelectedAccessPass(pass);
    } catch {
      // The sheet explains that an access pass has not yet been issued.
      setSelectedAccessPass(null);
    }
  };

  const renderReservationItem = (item: AmenityReservation) => (
    <ResidentReservationCard
      key={`${item._id}-${language}`}
      reservation={item}
      onPress={handleCardPress}
      onShowQR={handleShowPass}
      onCancelPress={setCancelTarget}
      testID={`reservation-card-${item._id}`}
    />
  );

  const renderHeader = () => (
    <View className="gap-3 mb-3">
      {/* Real-Time Keyword Search Bar & Moveable Slide Status Filter */}
      <SearchFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t('search_facility_reservation', 'Search by facility name or reservation number...')}
        sortOptions={sortOptions}
        currentSort={selectedTab}
        onSortChange={(value) => setSelectedTab(value as ReservationFilterTab)}
        variant="default"
        className="px-0 py-0 border-0"
      />
    </View>
  );

  return (
    <ScreenShell
      title={t('my_amenity_bookings', 'My Amenity Bookings')}
      subtitle={t('my_amenity_bookings_sub', 'View, manage & access your digital reservation passes')}
      iconName="CalendarCheck"
      loading={loading && reservations.length === 0}
      error={error?.message || null}
      onRetry={refresh}
      headerRight={
        <Button
          variant="default"
          size="sm"
          onPress={() => router.push('/(resident)/amenities/discover' as any)}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
          accessibilityRole="button"
          accessibilityLabel="Book Amenity"
        >
          <Plus size={15} color="#ffffff" />
          <Text className="text-xs font-bold text-primary-foreground">{t('book_amenity', 'Book Amenity')}</Text>
        </Button>
      }
    >
      <View className="flex-1 bg-background">
        {/* Paginated List of Reservations */}
        <PaginatedList
          data={filteredReservations}
          renderItem={renderReservationItem}
          extraData={language}
          keyExtractor={(item) => `${item._id}-${language}`}
          pagination={pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 }}
          onLoadMore={loadMore}
          onRefresh={refresh}
          loading={loading}
          refreshing={isRefreshing}
          paginationSummary
          ListHeaderComponent={renderHeader()}
          emptyIcon="CalendarX"
          emptyTitle={t('no_bookings_found', 'No Bookings Found')}
          emptySubtitle={t('no_bookings_matching_filter', 'You have no reservations matching this filter.')}
          contentContainerClassName="px-4 pt-3 pb-28"
        />
      </View>

      {/* Visitor-Management-Aligned Pass Details Modal */}
      <AmenityPassDetailsModal
        visible={passModalOpen}
        reservation={selectedPassReservation}
        accessPass={selectedAccessPass}
        onClose={() => {
          setPassModalOpen(false);
          setSelectedPassReservation(null);
          setSelectedAccessPass(null);
        }}
        onCancelPress={(target) => {
          setPassModalOpen(false);
          setCancelTarget(target as AmenityReservation);
        }}
      />

      {/* Cancel Confirmation Modal */}
      <ResidentCancelModal
        visible={!!cancelTarget}
        reservation={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        loading={isCancelling}
        testID="resident-cancel-modal"
      />
    </ScreenShell>
  );
}
