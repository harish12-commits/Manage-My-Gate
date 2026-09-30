import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { HeaderActionButton } from '@/components/ui/HeaderActionButton';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

import { AmenityMasterCard } from '@/src/features/amenities/components/AmenityMasterCard';
import { AmenityFilterDrawer } from '@/src/features/amenities/components/AmenityFilterDrawer';
import { AmenityDeactivationConflictModal } from '@/src/features/amenities/components/AmenityDeactivationConflictModal';
import { useAmenityMaster, ArchetypeFilterOption, AmenityStatusFilter } from '@/src/features/amenities/hooks/useAmenityMaster';
import {
  AmenityCreationWizard,
  AmenityArchetypeSheet,
} from '@/src/features/amenities/components/creation-wizard';
import { AmenityDetailSheet } from '@/src/features/amenities/components/AmenityDetailSheet';
import { AmenityFacility } from '@/src/features/amenities/types/amenityDomain.types';
import { Plus } from 'lucide-react-native';

export default function AdminAmenityMasterScreen() {
  const router = useRouter();
  const {
    facilities,
    filteredAmenities,
    pagination,
    handleLoadMore,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    statusCounts,
    availableCategories,
    activeFilters,
    activeFilterCount,
    isFilterDrawerOpen,
    setIsFilterDrawerOpen,
    handleApplyFilters,
    handleResetFilters,
    selectedArchetype,
    setSelectedArchetype,
    loading,
    error,
    isFormModalOpen,
    isArchetypeSheetOpen,
    creationArchetype,
    editingAmenity,
    selectedAmenityDetail,
    setSelectedAmenityDetail,
    deleteTarget,
    setDeleteTarget,
    deactivateTarget,
    setDeactivateTarget,
    deactivationConflict,
    handleResolveDeactivationConflict,
    handleCloseDeactivationConflict,
    saving,
    savingDraft,
    loadData,
    handleOpenCreateModal,
    handleSelectArchetypeForCreation,
    handleCloseArchetypeSheet,
    handleOpenEditModal,
    handleCloseFormModal,
    handleFormSubmit,
    handleSaveDraft,
    handleToggleStatus,
    handleConfirmDeactivate,
    handleConfirmDelete,
  } = useAmenityMaster();

  // Status sort options with live counts (matching Billing Ledger pattern)
  const statusSortOptions = useMemo(() => [
    { label: `All (${statusCounts.total})`, value: 'ALL' },
    { label: `Active (${statusCounts.active})`, value: 'ACTIVE' },
    { label: `Draft (${statusCounts.draft})`, value: 'DRAFT' },
    { label: `Inactive (${statusCounts.inactive})`, value: 'INACTIVE' },
    { label: `Maintenance (${statusCounts.maintenance})`, value: 'MAINTENANCE' },
  ], [statusCounts]);

  const emptySubtitle = useMemo(() => {
    if (search.trim()) return `No facilities match "${search.trim()}".`;
    if (statusFilter !== 'ALL') return `No facilities match status filter "${statusFilter.toLowerCase()}".`;
    if (activeFilterCount > 0) return 'No facilities match the active filter criteria.';
    return 'No facility records found in master catalog.';
  }, [search, statusFilter, activeFilterCount]);

  const renderHeader = () => (
    <View className="mb-3">
      {/* Search & Status Filter Bar with Filter Drawer Trigger */}
      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search facility name, location or code..."
        sortOptions={statusSortOptions}
        currentSort={statusFilter}
        onSortChange={(val) => setStatusFilter(val as AmenityStatusFilter)}
        onFilterPress={() => setIsFilterDrawerOpen(true)}
        activeFilterCount={activeFilterCount}
        variant="default"
        className="px-0 py-0 border-0"
      />
    </View>
  );

  return (
    <ScreenShell
      title="Amenity Master Console"
      subtitle={`Total ${facilities.length} community facilities`}
      iconName="Building2"
      loading={loading && facilities.length === 0}
      error={error}
      onRetry={loadData}
      headerRight={
        <HeaderActionButton
          onPress={handleOpenCreateModal}
          icon={Plus}
          label="Add Facility"
          accessibilityLabel="Add New Amenity Facility"
        />
      }
    >
      <View className="flex-1 bg-background">
        {/* Master Amenity List */}
        <PaginatedList<AmenityFacility>
          data={filteredAmenities}
          renderItem={(item) => (
            <AmenityMasterCard
              key={item._id}
              item={item}
              onPress={(f) => setSelectedAmenityDetail(f)}
              onEdit={(f) => handleOpenEditModal(f)}
              onToggleStatus={(f) => handleToggleStatus(f)}
              onDelete={(f) => setDeleteTarget(f)}
            />
          )}
          pagination={pagination || { currentPage: 1, totalPages: 1, totalRecords: filteredAmenities.length, limit: 50 }}
          onLoadMore={handleLoadMore}
          onRefresh={loadData}
          loading={loading && facilities.length === 0}
          paginationSummary
          ListHeaderComponent={renderHeader()}
          emptyIcon="Building2"
          emptyTitle="No Amenity Records Found"
          emptySubtitle={emptySubtitle}
          contentContainerClassName="px-4 pt-3 pb-10"
        />
      </View>

      {/* Advanced Multi-Select Filter Drawer */}
      <AmenityFilterDrawer
        visible={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={activeFilters}
        availableCategories={availableCategories}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      {/* 1. Initial Archetype Selection Bottom Sheet (Visitor Pattern UX) */}
      <AmenityArchetypeSheet
        visible={isArchetypeSheetOpen}
        selectedArchetype={creationArchetype}
        onClose={handleCloseArchetypeSheet}
        onSelectArchetype={handleSelectArchetypeForCreation}
      />

      {/* 2. Amenity Create / Edit Flow Wizard */}
      <AmenityCreationWizard
        visible={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSubmit={handleFormSubmit as any}
        onSaveDraft={handleSaveDraft as any}
        amenity={editingAmenity}
        loading={saving}
        savingDraft={savingDraft}
        initialArchetype={creationArchetype}
      />

      {/* Facility Inspection Detail Sheet */}
      <AmenityDetailSheet
        visible={!!selectedAmenityDetail}
        onClose={() => setSelectedAmenityDetail(null)}
        amenity={selectedAmenityDetail}
        onEditClick={handleOpenEditModal}
        onScheduleMaintenanceClick={() => router.navigate('/(resident)/amenities/maintenance' as any)}
      />

      {/* Status Toggle Confirmation Modal */}
      <ConfirmationModal
        visible={!!deactivateTarget}
        title={
          deactivateTarget?.status === 'ACTIVE' || (deactivateTarget as any)?.isActive === true
            ? 'Deactivate Amenity Facility?'
            : 'Activate Amenity Facility?'
        }
        message={
          deactivateTarget?.status === 'ACTIVE' || (deactivateTarget as any)?.isActive === true
            ? `"${deactivateTarget?.name}" will be deactivated and marked unavailable for resident bookings. Are you sure you want to proceed?`
            : `Are you sure you want to activate "${deactivateTarget?.name}" and open it for resident bookings?`
        }
        variant={
          deactivateTarget?.status === 'ACTIVE' || (deactivateTarget as any)?.isActive === true
            ? 'warning'
            : 'info'
        }
        confirmLabel={
          deactivateTarget?.status === 'ACTIVE' || (deactivateTarget as any)?.isActive === true
            ? 'Deactivate Facility'
            : 'Activate Facility'
        }
        cancelLabel={
          deactivateTarget?.status === 'ACTIVE' || (deactivateTarget as any)?.isActive === true
            ? 'Keep Active'
            : 'Keep Inactive'
        }
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />

      {/* Interactive Deactivation Conflict Resolution Modal (Policy T1) */}
      <AmenityDeactivationConflictModal
        visible={!!deactivationConflict}
        facility={deactivationConflict?.facility || null}
        bookingsCount={deactivationConflict?.count || 0}
        loading={saving}
        onHonorExisting={() => handleResolveDeactivationConflict('HONOR_EXISTING')}
        onCancelAndRefund={() => handleResolveDeactivationConflict('CANCEL_AND_REFUND')}
        onDismiss={handleCloseDeactivationConflict}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        visible={!!deleteTarget}
        title="Delete Amenity Record?"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"? All associated settings and schedule configurations for this facility will be removed.`}
        variant="danger"
        confirmLabel="Delete Record"
        cancelLabel="Keep Amenity"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </ScreenShell>
  );
}
