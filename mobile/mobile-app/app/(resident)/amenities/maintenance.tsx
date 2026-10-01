import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { HeaderActionButton } from '@/components/ui/HeaderActionButton';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { Text } from '@/components/ui/text';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Plus, RotateCcw } from 'lucide-react-native';

import { useAdminMaintenance } from '../../../src/features/amenities/hooks/useAdminMaintenance';
import { AmenityMaintenanceCard } from '../../../src/features/amenities/components/AmenityMaintenanceCard';
import { MaintenanceWizard } from '../../../src/features/amenities/components/maintenance-wizard';
import { FacilityMaintenanceDetailSheet } from '../../../src/features/amenities/components/FacilityMaintenanceDetailSheet';
import amenityManagementService from '../../../src/features/amenities/services/amenityManagementService';
import { Amenity, MaintenanceTask } from '../../../src/features/amenities/store/amenitySlice';

type StatusFilterType = 'ALL' | 'MAINTENANCE' | 'OPERATIONAL';

export interface AmenityMaintenanceItem {
  amenity: Amenity;
  activeTasks: MaintenanceTask[];
  activeTask?: MaintenanceTask | null;
}

export default function AmenityMaintenanceScheduleScreen() {
  const {
    amenities,
    maintenanceList,
    loading,
    error,
    isModalOpen,
    editingTask,
    selectedAmenityId,
    deleteTargetTask,
    setDeleteTargetTask,
    deleteTargetAmenity,
    setDeleteTargetAmenity,
    scheduling,
    loadData,
    handleLoadMore,
    handleOpenCreateModal,
    handleOpenEditModal,
    handleCloseModal,
    handleScheduleSubmit,
    handleConfirmDelete,
    handleConfirmDeleteAll,
  } = useAdminMaintenance();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');

  // Selected facility for the detailed maintenance bottom sheet view
  const [selectedFacilityForDetails, setSelectedFacilityForDetails] = useState<Amenity | null>(null);

  // Pair each amenity from Amenities Master with ALL its active scheduled upkeep tasks
  const amenityMaintenanceItems: AmenityMaintenanceItem[] = useMemo(() => {
    const list: AmenityMaintenanceItem[] = amenities.map((amenity) => {
      const activeTasks = maintenanceList.filter((t) => {
        const matchAmenity =
          String(t.amenityId) === String(amenity._id) ||
          (t.amenityName &&
            amenity.name &&
            t.amenityName.trim().toLowerCase() === amenity.name.trim().toLowerCase());
        const s = String(t.status || '').toUpperCase();
        return matchAmenity && s !== 'CANCELLED' && s !== 'COMPLETED';
      });

      return {
        amenity,
        activeTasks,
        activeTask: activeTasks[0] || null,
      };
    });

    // Also include any ad-hoc custom maintenance tasks without a matching master amenity
    maintenanceList.forEach((task) => {
      const s = String(task.status || '').toUpperCase();
      if (s === 'CANCELLED' || s === 'COMPLETED') return;

      const alreadyLinked = list.some(
        (item) =>
          String(item.amenity._id) === String(task.amenityId) ||
          (item.amenity.name &&
            task.amenityName &&
            item.amenity.name.trim().toLowerCase() === task.amenityName.trim().toLowerCase())
      );
      if (!alreadyLinked) {
        list.push({
          amenity: {
            _id: task.amenityId || 'OTHER',
            name: task.amenityName || task.title || 'Custom Facility',
            category: task.maintenanceType || 'General',
            location: 'Community Facility',
          },
          activeTasks: [task],
          activeTask: task,
        });
      }
    });

    return list;
  }, [amenities, maintenanceList]);

  // Derive the latest facility object for details modal
  const currentSelectedAmenity = useMemo(() => {
    if (!selectedFacilityForDetails) return null;
    return (
      amenities.find((a) => String(a._id) === String(selectedFacilityForDetails._id)) ||
      selectedFacilityForDetails
    );
  }, [selectedFacilityForDetails, amenities]);

  // Derive active tasks live from maintenanceList for the selected facility
  const activeTasksForSelectedFacility = useMemo(() => {
    if (!selectedFacilityForDetails) return [];
    const facId = String(selectedFacilityForDetails._id);
    const facName = selectedFacilityForDetails.name?.trim().toLowerCase();
    return maintenanceList.filter((t) => {
      const matchAmenity =
        String(t.amenityId) === facId ||
        (t.amenityName && facName && t.amenityName.trim().toLowerCase() === facName);
      const s = String(t.status || '').toUpperCase();
      return matchAmenity && s !== 'CANCELLED' && s !== 'COMPLETED';
    });
  }, [selectedFacilityForDetails, maintenanceList]);

  // Compute status counts for filter badges
  const counts = useMemo(() => {
    let maintenance = 0;
    let operational = 0;

    amenityMaintenanceItems.forEach((item) => {
      const isMaint = item.activeTasks.length > 0;
      if (isMaint) maintenance++;
      else operational++;
    });

    return {
      all: amenityMaintenanceItems.length,
      maintenance,
      operational,
    };
  }, [amenityMaintenanceItems]);

  // Filter items by status and search query
  const filteredItems = useMemo(() => {
    return amenityMaintenanceItems.filter((item) => {
      const hasActiveMaintenance = item.activeTasks.length > 0;

      // Status filter
      if (statusFilter === 'MAINTENANCE' && !hasActiveMaintenance) return false;
      if (statusFilter === 'OPERATIONAL' && hasActiveMaintenance) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.amenity.name?.toLowerCase().includes(q);
        const matchesCategory = item.amenity.category?.toLowerCase().includes(q);
        const matchesLocation = item.amenity.location?.toLowerCase().includes(q);
        const matchesAnyTask = item.activeTasks.some((t) => {
          return (
            t.title?.toLowerCase().includes(q) ||
            t.maintenanceType?.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q)
          );
        });
        if (
          !matchesName &&
          !matchesCategory &&
          !matchesLocation &&
          !matchesAnyTask
        ) {
          return false;
        }
      }

      return true;
    });
  }, [amenityMaintenanceItems, statusFilter, searchQuery]);

  const statusSortOptions = useMemo(
    () => [
      { label: `All (${counts.all})`, value: 'ALL' },
      { label: `Under Maintenance (${counts.maintenance})`, value: 'MAINTENANCE' },
      { label: `Operational (${counts.operational})`, value: 'OPERATIONAL' },
    ],
    [counts]
  );

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
  };

  const cancelConfirmMessage = useMemo(() => {
    if (!deleteTargetTask) return '';
    const facName = deleteTargetTask.amenityName || currentSelectedAmenity?.name || 'Facility';
    const maintTitle = deleteTargetTask.title || deleteTargetTask.reason || 'Routine Maintenance';
    const dateStr = `${deleteTargetTask.startDate}${
      deleteTargetTask.endDate && deleteTargetTask.endDate !== deleteTargetTask.startDate
        ? ` – ${deleteTargetTask.endDate}`
        : ''
    }`;
    const timeStr = `${deleteTargetTask.startTime || '00:00'} – ${deleteTargetTask.endTime || '23:59'}`;
    return `Facility:\n${facName}\n\nMaintenance:\n${maintTitle}\n\nDate:\n${dateStr}\n\nTime:\n${timeStr}\n\nAre you sure you want to cancel this maintenance window?`;
  }, [deleteTargetTask, currentSelectedAmenity]);

  const renderItem = (item: AmenityMaintenanceItem) => {
    return (
      <AmenityMaintenanceCard
        key={item.amenity._id}
        amenity={item.amenity}
        activeTask={item.activeTask}
        activeTasks={item.activeTasks}
        onPress={(amenity) => setSelectedFacilityForDetails(amenity)}
      />
    );
  };

  const renderListHeader = () => {
    return (
      <View className="gap-3 mb-2">
        {/* Search & Status Filter Bar with Filter Icon Modal */}
        <SearchFilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search amenities by name, category, upkeep task..."
          sortOptions={statusSortOptions}
          currentSort={statusFilter}
          onSortChange={(val) => setStatusFilter(val as StatusFilterType)}
          filterTitle="Filter Maintenance Facilities"
          className="px-0 py-0 border-0"
        />

        {/* Section Counter & Reset */}
        <View className="flex-row items-center justify-between mt-1">
          <Text className="text-sm font-bold text-foreground font-sans">
            Facilities ({filteredItems.length}
            {filteredItems.length !== amenityMaintenanceItems.length
              ? ` of ${amenityMaintenanceItems.length}`
              : ''}
            )
          </Text>
          {(searchQuery || statusFilter !== 'ALL') && (
            <TouchableOpacity onPress={resetFilters} className="flex-row items-center gap-1">
              <RotateCcw size={12} className="text-muted-foreground" />
              <Text className="text-xs font-medium text-muted-foreground">Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenShell
      title="Maintenance Tasks"
      subtitle="Track facility upkeep & tasks"
      loading={loading && amenityMaintenanceItems.length === 0}
      error={error}
      onRetry={loadData}
      headerRight={
        <HeaderActionButton
          onPress={() => handleOpenCreateModal()}
          icon={Plus}
          label="Schedule"
          accessibilityLabel="Schedule Task"
        />
      }
    >
      <View className="flex-1 bg-background">
        {/* Clean Facility Summary Card List */}
        <PaginatedList<AmenityMaintenanceItem>
          data={filteredItems}
          renderItem={renderItem}
          ListHeaderComponent={renderListHeader()}
          pagination={{
            currentPage: 1,
            totalPages: 1,
            totalRecords: filteredItems.length,
            limit: 50,
          }}
          onLoadMore={handleLoadMore}
          onRefresh={loadData}
          loading={loading}
          paginationSummary
          emptyIcon="CircleCheck"
          emptyTitle={
            searchQuery || statusFilter !== 'ALL'
              ? 'No Matching Facilities Found'
              : 'No Community Facilities'
          }
          emptySubtitle={
            searchQuery || statusFilter !== 'ALL'
              ? 'Try changing your search terms or resetting the active filters.'
              : 'Create community facilities in Amenities Master to schedule maintenance.'
          }
          contentContainerClassName="p-4 gap-3 pb-28"
        />
      </View>

      {/* Facility Maintenance Details Bottom Sheet */}
      <FacilityMaintenanceDetailSheet
        visible={!!currentSelectedAmenity}
        onClose={() => setSelectedFacilityForDetails(null)}
        amenity={currentSelectedAmenity}
        activeTasks={activeTasksForSelectedFacility}
        onAddWindow={(amenityId) => handleOpenCreateModal(amenityId)}
        onEditTask={(task) => handleOpenEditModal(task)}
        onCancelTask={(task) => handleConfirmDelete(task)}
        loading={loading}
        error={error}
        onRetry={loadData}
      />

      {/* Schedule / Edit Maintenance Wizard */}
      <MaintenanceWizard
        visible={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleScheduleSubmit}
        amenities={amenities}
        initialData={editingTask}
        initialAmenityId={selectedAmenityId}
        loading={scheduling}
      />

      {/* Cancel Single Maintenance Window Confirmation Modal */}
      <ConfirmationModal
        visible={!!deleteTargetTask}
        title="Cancel Maintenance Window?"
        message={cancelConfirmMessage}
        variant="danger"
        confirmLabel="Cancel Window"
        cancelLabel="Keep Window"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetTask(null)}
      />

      {/* Cancel All Maintenance Schedules for Facility Confirmation Modal */}
      <ConfirmationModal
        visible={!!deleteTargetAmenity}
        title="Cancel All Maintenance Schedules?"
        message={`Are you sure you want to cancel all scheduled maintenance windows for "${
          deleteTargetAmenity?.amenityName || 'this facility'
        }"? This will return the facility to operational status and unblock resident reservation slots.`}
        variant="danger"
        confirmLabel="Cancel All Maintenance"
        cancelLabel="Keep Schedules"
        onConfirm={handleConfirmDeleteAll}
        onCancel={() => setDeleteTargetAmenity(null)}
      />
    </ScreenShell>
  );
}
