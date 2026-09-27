import React, { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { KPICard } from '@/components/ui/KPICard';
import { Text } from '@/components/ui/text';
import { FAB } from '@/components/ui/FAB';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/ui/icon';
import { EmptyState } from '@/components/feedback/EmptyState';
import { FileSpreadsheet, Zap, Building2, Plus } from 'lucide-react-native';
import { useVilla } from '@/src/features/villa/hooks/useVilla';
import { useVillaSocket } from '@/src/features/villa/hooks/useVillaSocket';
import { VillaCard } from '@/src/features/villa/components/VillaCard';
import { VillaDetailsModal } from '@/src/features/villa/components/VillaDetailsModal';
import { VillaFormModal } from '@/src/features/villa/components/VillaFormModal';
import { BatchGenerateModal } from '@/src/features/villa/components/BatchGenerateModal';
import { BulkUploadVillasModal } from '@/src/features/villa/components/BulkUploadVillasModal';
import { VillaFilterSheet } from '@/src/features/villa/components/VillaFilterSheet';
import { Villa } from '@/src/features/villa/store/villaSlice';
import { VillaPayload, BatchGenerateParams } from '@/src/features/villa/services/villaService';
import { useTranslation } from '@/src/utils/i18n';

export default function VillaManagementScreen() {
  const { t } = useTranslation();
  const {
    villas,
    blocks,
    stats,
    loading,
    actionLoading,
    error,
    filters,
    fetchVillas,
    fetchBlocks,
    fetchStats,
    createUnit,
    updateUnit,
    deleteUnit,
    batchGenerate,
    bulkUpload,
    downloadTemplate,
    setSearch,
    setBlock,
    setStatus,
  } = useVilla();

  // Connect real-time socket listener
  useVillaSocket();

  // Local state for modals
  const [selectedVilla, setSelectedVilla] = useState<Villa | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingVilla, setEditingVilla] = useState<Villa | null>(null);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [bulkUploadModalVisible, setBulkUploadModalVisible] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  useEffect(() => {
    fetchVillas();
    fetchBlocks();
    fetchStats();
  }, []);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    fetchVillas({ search: text, page: 1 });
  };

  const handleStatusFilter = (statusVal: string) => {
    setStatus(statusVal);
    fetchVillas({ status: statusVal, page: 1 });
  };

  const handleBlockFilter = (blockVal: string) => {
    setBlock(blockVal);
    fetchVillas({ blockOrBuilding: blockVal, page: 1 });
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatus('');
    setBlock('');
    fetchVillas({ search: '', status: '', blockOrBuilding: '', page: 1 });
  };

  const handleCardPress = (villa: Villa) => {
    setSelectedVilla(villa);
    setDetailsModalVisible(true);
  };

  const handleOpenCreateForm = () => {
    setEditingVilla(null);
    setFormModalVisible(true);
  };

  const handleOpenEditForm = (villa: Villa) => {
    setEditingVilla(villa);
    setFormModalVisible(true);
  };

  const handleFormSubmit = async (data: VillaPayload) => {
    try {
      if (editingVilla) {
        await updateUnit(editingVilla._id, data);
      } else {
        await createUnit(data);
      }
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to save unit';
      Alert.alert('Unit Save Error', msg);
    }
  };

  const handleDeleteUnit = async (villa: Villa) => {
    try {
      await deleteUnit(villa._id);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Cannot delete unit';
      Alert.alert('Cannot Delete Unit', msg);
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.blockOrBuilding) count++;
    if (filters.status) count++;
    return count;
  }, [filters.blockOrBuilding, filters.status]);

  const activeSelectedVilla = useMemo(() => {
    if (!selectedVilla) return null;
    return villas.find((v) => v._id === selectedVilla._id) || selectedVilla;
  }, [selectedVilla, villas]);

  const availableStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];

  return (
    <ScreenShell
      title={t('unit_villa_management', 'Unit & Villa Management')}
      subtitle={t('unit_villa_management_sub', 'Configure community blocks, unit statuses, and occupants')}
      iconName="Home"
      permission="villas:read"
      error={error}
      onRetry={() => {
        fetchVillas();
        fetchStats();
      }}
      headerRight={
        <TouchableOpacity
          onPress={handleOpenCreateForm}
          className="flex-row items-center gap-1 bg-emerald-600 active:bg-emerald-700 px-3 py-1.5 rounded-full"
          accessibilityRole="button"
          accessibilityLabel="Add Unit"
        >
          <Plus size={14} color="#ffffff" />
          <Text className="text-xs font-bold text-white">{t('create_unit', 'Add Unit')}</Text>
        </TouchableOpacity>
      }
    >
      <View className="flex-1 bg-background relative">
        {/* KPI Stats Horizontal Row */}
        <View className="border-b border-border/50 bg-card/40 py-2.5 px-4 shrink-0">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <View className="flex-row items-center gap-2">
              <KPICard title={t('total_units', 'TOTAL UNITS')} value={stats.total || 0} iconName="Building2" iconColor="#0d9488" />
              <KPICard title={t('occupied_units', 'OCCUPIED UNITS')} value={stats.occupied || 0} iconName="UserCheck" iconColor="#16a34a" />
              <KPICard title={t('vacant_units', 'VACANT UNITS')} value={stats.vacant || 0} iconName="DoorOpen" iconColor="#6b7280" />
              <KPICard title={t('under_maintenance', 'UNDER MAINTENANCE')} value={stats.maintenance || 0} iconName="Wrench" iconColor="#eab308" />
            </View>
          </ScrollView>
        </View>

        {/* Action Toolbar (Responsive Mini Cards) */}
        <View className="px-4 py-2.5 border-b border-border/40 bg-card/20 shrink-0">
          <View className="flex-row items-stretch gap-2.5">
            <TouchableOpacity
              onPress={() => setBulkUploadModalVisible(true)}
              activeOpacity={0.7}
              className="flex-1 p-2.5 rounded-xl border border-blue-500/25 bg-blue-500/5 active:bg-blue-500/10 flex-row items-center gap-2.5 shadow-2xs"
              accessibilityRole="button"
              accessibilityLabel="Bulk Upload Units"
            >
              <View className="w-9 h-9 rounded-lg bg-blue-500/15 items-center justify-center shrink-0">
                <FileSpreadsheet size={18} color="#2563eb" />
              </View>
              <View className="flex-1 justify-center">
                <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                  {t('bulk_upload', 'Bulk Upload')}
                </Text>
                <Text className="text-[10px] text-muted-foreground mt-0.5" numberOfLines={1}>
                  {t('bulk_upload_sub', 'Import via CSV')}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setBatchModalVisible(true)}
              activeOpacity={0.7}
              className="flex-1 p-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 active:bg-amber-500/10 flex-row items-center gap-2.5 shadow-2xs"
              accessibilityRole="button"
              accessibilityLabel="Batch Generate Units"
            >
              <View className="w-9 h-9 rounded-lg bg-amber-500/15 items-center justify-center shrink-0">
                <Zap size={18} color="#d97706" />
              </View>
              <View className="flex-1 justify-center">
                <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                  {t('batch_generate', 'Batch Generate')}
                </Text>
                <Text className="text-[10px] text-muted-foreground mt-0.5" numberOfLines={1}>
                  {t('batch_generate_sub', 'Auto-create units')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search & Filter Bar */}
        <SearchFilterBar
          searchValue={filters.search}
          onSearchChange={handleSearchChange}
          searchPlaceholder={t('search_unit_number', 'Search unit number...')}
          onFilterPress={() => setFilterSheetVisible(true)}
          activeFilterCount={activeFilterCount}
        />

        {/* Active Filters Pill Bar (when filtered) */}
        {activeFilterCount > 0 && (
          <View className="px-4 py-2 bg-muted/20 border-b border-border/40 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5 flex-wrap flex-1">
              <Text className="text-[11px] font-medium text-muted-foreground">
                {t('active_filters', 'Filtered by')}:
              </Text>
              {filters.status ? (
                <View className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                  <Text className="text-[11px] font-semibold text-primary">{filters.status}</Text>
                </View>
              ) : null}
              {filters.blockOrBuilding ? (
                <View className="px-2 py-0.5 rounded-md bg-secondary border border-border">
                  <Text className="text-[11px] font-semibold text-foreground">
                    {t('block', 'Block')} {filters.blockOrBuilding}
                  </Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={handleClearFilters}
              className="p-1"
              accessibilityRole="button"
              accessibilityLabel="Clear active filters"
            >
              <Text className="text-[11px] font-bold text-destructive">{t('clear', 'Clear')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Directory & List Container */}
        {loading && villas.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <ActivityIndicator size="large" color="#0d9488" />
            <Text variant="muted" className="text-xs mt-2">{t('loading_units_directory', 'Loading units directory...')}</Text>
          </View>
        ) : villas.length === 0 ? (
          <View className="flex-1 items-center justify-center p-6">
            <EmptyState
              icon={Building2}
              title={t('no_units_found', 'No Units Found')}
              description={t('no_units_match_desc', 'No community units match the active search or filters. You can batch generate, bulk upload, or manually create new units.')}
              actionLabel={t('batch_generate', 'Batch Generate')}
              onAction={() => setBatchModalVisible(true)}
            />
          </View>
        ) : (
          <FlatList
            data={villas}
            keyExtractor={(villa: Villa) => villa._id}
            renderItem={({ item }: { item: Villa }) => (
              <VillaCard
                villa={item}
                onPress={handleCardPress}
              />
            )}
            ListHeaderComponent={
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xs font-bold text-muted-foreground uppercase">
                  {t('unit_directory', 'Unit Directory')} ({villas.length})
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={() => {
                  fetchVillas();
                  fetchStats();
                }}
                colors={['#0d9488']}
                tintColor="#0d9488"
              />
            }
          />
        )}
      </View>

      {/* Details Bottom Sheet Modal */}
      {detailsModalVisible && activeSelectedVilla ? (
        <VillaDetailsModal
          visible={detailsModalVisible}
          onClose={() => setDetailsModalVisible(false)}
          villa={activeSelectedVilla}
          onEdit={handleOpenEditForm}
          onDelete={handleDeleteUnit}
        />
      ) : null}

      {/* Create / Edit Form Modal */}
      {formModalVisible ? (
        <VillaFormModal
          visible={formModalVisible}
          onClose={() => setFormModalVisible(false)}
          onSubmit={handleFormSubmit}
          editingVilla={editingVilla}
          loading={actionLoading}
        />
      ) : null}

      {/* Batch Generate Modal */}
      <BatchGenerateModal
        visible={batchModalVisible}
        onClose={() => setBatchModalVisible(false)}
        onSubmit={async (batchData: BatchGenerateParams) => {
          try {
            await batchGenerate(batchData);
          } catch (err: any) {
            const msg = typeof err === 'string' ? err : err?.message || 'Batch generation failed';
            Alert.alert('Batch Generate Error', msg);
          }
        }}
        loading={actionLoading}
      />

      {/* Bulk Upload Modal */}
      <BulkUploadVillasModal
        visible={bulkUploadModalVisible}
        onClose={() => setBulkUploadModalVisible(false)}
        onBulkUpload={async (units) => {
          try {
            await bulkUpload(units);
          } catch (err: any) {
            const msg = typeof err === 'string' ? err : err?.message || 'Bulk upload failed';
            Alert.alert('Bulk Upload Error', msg);
          }
        }}
        onDownloadTemplate={downloadTemplate}
        loading={actionLoading}
      />

      {/* Villa Filter Sheet */}
      <VillaFilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        availableStatuses={availableStatuses}
        selectedStatus={filters.status}
        onSelectStatus={handleStatusFilter}
        availableBlocks={blocks}
        selectedBlock={filters.blockOrBuilding}
        onSelectBlock={handleBlockFilter}
        onClearAll={handleClearFilters}
      />
    </ScreenShell>
  );
}
