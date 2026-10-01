import React, { useState, useMemo } from 'react';
import { View } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { SearchFilterBar, SortOption } from '@/components/ui/SearchFilterBar';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CalendarCheck } from 'lucide-react-native';

import { useResidentAmenities } from '../../../src/features/amenities/hooks/useResidentAmenities';
import { ResidentAmenityDetailSheet } from '../../../src/features/amenities/components/ResidentAmenityDetailSheet';
import { AmenityCatalogCard } from '../../../src/features/amenities/components/AmenityCatalogCard';
import { AmenityFacility, AmenityArchetype } from '../../../src/features/amenities/types/amenityDomain.types';
import { useAuth } from '../../../src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser } from '../../../src/utils/rbac';

const ARCHETYPE_FILTER_OPTIONS: SortOption[] = [
  { label: 'All Facilities', value: 'All' },
  { label: 'Shared Capacity', value: 'SHARED_CAPACITY' },
  { label: 'Exclusive Hourly', value: 'EXCLUSIVE_HOURLY' },
  { label: 'Event Space', value: 'EVENT_SPACE' },
  { label: 'Room Resource', value: 'ROOM_RESOURCE' },
  { label: 'Inventory & Tools', value: 'INVENTORY_TOOLS' },
];

import { useTranslation } from '@/src/utils/i18n';

export default function DiscoverAmenitiesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, translateText, language } = useTranslation();

  // Guard: Users without discover/resident amenity permissions are redirected
  const hasDiscoverAccess =
    isFeatureAllowedForUser({ id: 'amenities_discover', permission: 'amenities:discover' }, user) ||
    isFeatureAllowedForUser({ id: 'amenities_dashboard', permission: 'amenities:dashboard' }, user) ||
    isFeatureAllowedForUser({ id: 'amenities_master', permission: 'amenities:amenities' }, user);

  if (user && !hasDiscoverAccess) {
    if (isFeatureAllowedForUser({ id: 'amenities_scanner', permission: 'amenities:scanner' }, user)) {
      return <Redirect href="/(resident)/amenities/scanner" />;
    }
    return <Redirect href="/(resident)/dashboard" />;
  }

  const {
    facilities,
    selectedFacility,
    resources,
    selectedArchetype,
    searchQuery,
    pagination,
    loading,
    error,
    setSelectedArchetype,
    setSearchQuery,
    selectFacility,
    handleLoadMore,
    handleRefresh,
    clearError,
  } = useResidentAmenities();

  const [previewFacility, setPreviewFacility] = useState<AmenityFacility | null>(null);

  const stats = useMemo(() => {
    let activeCount = 0;
    let maintenanceCount = 0;

    facilities.forEach((f) => {
      if (f.status === 'ACTIVE') {
        activeCount++;
      } else if (f.status === 'MAINTENANCE') {
        maintenanceCount++;
      }
    });

    return {
      totalCount: pagination.totalRecords || facilities.length,
      activeCount,
      maintenanceCount,
    };
  }, [facilities, pagination.totalRecords]);

  const handleArchetypeChange = (value: string) => {
    if (value === 'All') {
      setSelectedArchetype(undefined);
    } else {
      setSelectedArchetype(value as AmenityArchetype);
    }
  };

  const handleCardPress = async (facility: AmenityFacility) => {
    setPreviewFacility(facility);
    const targetId = facility?._id || (facility as any)?.id;
    try {
      if (targetId) {
        await selectFacility(String(targetId));
      }
    } catch (e) {}
  };

  const navigateToBooking = (facilityId: string) => {
    setPreviewFacility(null);
    router.navigate({
      pathname: '/(resident)/amenities/booking/[id]' as any,
      params: { id: facilityId },
    });
  };

  const renderHeader = () => (
    <View className="mb-3 gap-3">
      {/* Unified Search & Exact v2 Archetype Filter Bar */}
      <SearchFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t('search_amenities_placeholder', 'Search facilities, gym, courts, tools...')}
        sortOptions={ARCHETYPE_FILTER_OPTIONS}
        currentSort={selectedArchetype || 'All'}
        onSortChange={handleArchetypeChange}
        className="px-0 py-0 border-0"
      />

      {/* Discovery Quick Stats Bar */}
      {!loading && stats.totalCount > 0 ? (
        <View className="flex-row items-center gap-2 bg-card p-2.5 rounded-2xl border border-border">
          <View className="bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/30">
            <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {stats.totalCount} {t('facilities', 'Facilities')}
            </Text>
          </View>
          <View className="bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30">
            <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {stats.activeCount} {t('available', 'Available')}
            </Text>
          </View>
          {stats.maintenanceCount > 0 ? (
            <View className="bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/30">
              <Text className="text-xs font-bold text-amber-600 dark:text-amber-400">
                {stats.maintenanceCount} {t('maintenance', 'Maintenance')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const renderAmenityItem = (item: AmenityFacility) => (
    <AmenityCatalogCard
      key={`${item._id}-${language}`}
      amenity={item}
      onPress={handleCardPress}
      onBookClick={navigateToBooking}
    />
  );

  return (
    <ScreenShell
      title={t('discover_amenities', 'Discover Amenities')}
      subtitle={t('discover_amenities_subtitle', 'Browse & reserve community facilities')}
      iconName="Search"
      loading={loading && facilities.length === 0}
      error={error?.message || null}
      onRetry={() => {
        clearError();
        handleRefresh();
      }}
      headerRight={
        <Button
          variant="outline"
          size="sm"
          onPress={() => router.navigate('/(resident)/amenities/my-bookings' as any)}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
          accessibilityRole="button"
          accessibilityLabel={t('my_bookings', 'My Bookings')}
        >
          <CalendarCheck size={14} className="text-foreground" />
          <Text className="text-xs font-semibold text-foreground">{t('my_bookings', 'My Bookings')}</Text>
        </Button>
      }
    >
      <View className="flex-1 bg-background">
        {/* Catalog Paginated List */}
        <PaginatedList
          data={facilities}
          renderItem={renderAmenityItem}
          extraData={language}
          keyExtractor={(item) => `${item._id}-${language}`}
          pagination={pagination}
          onLoadMore={handleLoadMore}
          onRefresh={handleRefresh}
          loading={loading}
          paginationSummary
          ListHeaderComponent={renderHeader()}
          emptyIcon="Building2"
          emptyTitle={searchQuery ? t('no_matching_amenities', 'No Matching Amenities') : t('no_amenities_found', 'No Amenities Found')}
          emptySubtitle={
            searchQuery
              ? t('adjust_search_filter', 'Try adjusting your search query or filter category.')
              : t('no_facilities_registered', 'There are currently no community facilities registered in this estate.')
          }
          contentContainerClassName="px-4 pt-3 pb-28"
          contentContainerStyle={{ paddingBottom: 110 }}
        />
      </View>

      {/* Resident Amenity Specification & Detail Sheet */}
      <ResidentAmenityDetailSheet
        visible={!!previewFacility}
        onClose={() => setPreviewFacility(null)}
        amenity={selectedFacility || previewFacility}
        resources={resources}
        onBookClick={navigateToBooking}
      />
    </ScreenShell>
  );
}
