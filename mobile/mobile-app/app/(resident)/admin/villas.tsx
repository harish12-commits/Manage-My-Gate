import React, { useEffect, useState, useRef } from 'react';
import { View, FlatList, RefreshControl, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Animated, TouchableWithoutFeedback } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { HeaderActionButton } from '@/components/ui/HeaderActionButton';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { Text } from '@/components/ui/text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { FileSpreadsheet, Zap, Plus, Building2, UserPlus, Filter } from 'lucide-react-native';
import { useVilla } from '@/src/features/villa/hooks/useVilla';
import { useVillaSocket } from '@/src/features/villa/hooks/useVillaSocket';
import { VillaCard } from '@/src/features/villa/components/VillaCard';
import { VillaDetailsModal } from '@/src/features/villa/components/VillaDetailsModal';
import { VillaFormModal } from '@/src/features/villa/components/VillaFormModal';
import { BatchGenerateModal } from '@/src/features/villa/components/BatchGenerateModal';
import { BulkUploadVillasModal } from '@/src/features/villa/components/BulkUploadVillasModal';
import { VillaFilterSheet } from '@/src/features/villa/components/VillaFilterSheet';
import { Villa } from '@/src/features/villa/store/villaSlice';
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

  useVillaSocket();

  // Local state for modals
  const [selectedVilla, setSelectedVilla] = useState<Villa | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingVilla, setEditingVilla] = useState<Villa | null>(null);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [bulkUploadModalVisible, setBulkUploadModalVisible] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  // Speed Dial UI State & Animation
  const [isDialOpen, setIsDialOpen] = useState(false);
  const dialAnimation = useRef(new Animated.Value(0)).current;

  const toggleDial = () => {
    const toValue = isDialOpen ? 0 : 1;
    Animated.spring(dialAnimation, {
      toValue,
      friction: 5,
      useNativeDriver: true,
    }).start();
    setIsDialOpen(!isDialOpen);
  };

  const closeDialAndOpen = (setter: (v: boolean) => void) => {
    toggleDial();
    setTimeout(() => setter(true), 300);
  };

  const rotation = dialAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg']
  });

  const transX1 = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
  const transY1 = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -145] });
  const transX2 = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -75] });
  const transY2 = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -85] });
  const transX3 = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -115] });
  const transY3 = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -15] });
  
  const scale1 = dialAnimation.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1.1, 1], extrapolate: 'clamp' });
  const scale2 = dialAnimation.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 1.1, 1], extrapolate: 'clamp' });
  const scale3 = dialAnimation.interpolate({ inputRange: [0, 0.9, 1], outputRange: [0.5, 1.1, 1], extrapolate: 'clamp' });

  const dialOpacity = dialAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

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

  const handleOpenCreateForm = () => {
    setEditingVilla(null);
    setFormModalVisible(true);
  };

  const activeFilterCount = (filters.status ? 1 : 0) + (filters.blockOrBuilding ? 1 : 0);

  const availableStatuses = ['Vacant', 'Occupied', 'Under Maintenance', 'For Sale', 'For Rent'];
  const tabPills = ['All', 'Vacant', 'Occupied', 'Under Maintenance'];

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
        <HeaderActionButton
          onPress={handleOpenCreateForm}
          icon={Plus}
          label={t('create_unit', 'Add Unit')}
          accessibilityRole="button"
          accessibilityLabel="Add Unit"
        />
      }
    >
      <View className="flex-1 bg-background">
        {/* Premium Search Filter Bar */}
        <SearchFilterBar
          searchValue={filters.search || ''}
          onSearchChange={handleSearchChange}
          searchPlaceholder={t('search_units_placeholder', 'Search by unit or block...')}
          onFilterPress={() => setFilterSheetVisible(true)}
          activeFilterCount={activeFilterCount}
        />

        {/* Premium Pill Tabs */}
        <View className="pb-3 border-b border-border/30">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerClassName="px-4 gap-2.5"
          >
            {tabPills.map((tabStatus) => {
              const isActive = tabStatus === 'All' 
                ? !filters.status
                : filters.status === tabStatus;
              
              return (
                <TouchableOpacity
                  key={tabStatus}
                  onPress={() => {
                    if (tabStatus === 'All') {
                      handleStatusFilter('');
                    } else {
                      handleStatusFilter(tabStatus);
                    }
                  }}
                  activeOpacity={0.7}
                  className={`px-4 py-1.5 rounded-full transition-colors ${
                    isActive ? 'bg-primary' : 'bg-secondary'
                  }`}
                >
                  <Text 
                    className={`text-[13px] font-bold tracking-tight ${
                      isActive ? 'text-primary-foreground' : 'text-foreground'
                    }`}
                  >
                    {tabStatus}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* List Content */}
        {villas.length === 0 && !loading ? (
          <EmptyState
            icon={Building2}
            title="No Units Found"
            description="There are no units matching your current filters."
            actionLabel="Add Unit"
            onAction={() => setFormModalVisible(true)}
          />
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={villas}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <VillaCard
                villa={item}
                onPress={(v) => {
                  setSelectedVilla(v);
                  setDetailsModalVisible(true);
                }}
                onEdit={(v) => {
                  setEditingVilla(v);
                  setFormModalVisible(true);
                }}
              />
            )}
            contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={loading && villas.length > 0}
                onRefresh={() => fetchVillas({ page: 1 })}
                colors={['#0d9488']}
                tintColor="#0d9488"
              />
            }
          />
        )}
      </View>

      {/* Animated Speed Dial Overlay */}
      {isDialOpen && (
        <TouchableWithoutFeedback onPress={toggleDial}>
          <Animated.View 
            style={{ opacity: dialOpacity }}
            className="absolute inset-0 bg-black/60 z-[9990] elevation-5" 
          />
        </TouchableWithoutFeedback>
      )}

      {/* Speed Dial Action 3: Batch Generate (Left) */}
      <Animated.View 
        className="z-[9998]"
        style={{ 
          position: 'absolute', bottom: 135, right: 25,
          width: 50, height: 50,
          alignItems: 'center', justifyContent: 'center',
          transform: [{ translateX: transX3 }, { translateY: transY3 }, { scale: scale3 }], 
          opacity: dialOpacity,
          overflow: 'visible'
        }}
        pointerEvents={isDialOpen ? 'auto' : 'none'}
      >
        <View style={{ position: 'absolute', right: 55, width: 125, alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
          <View className="bg-card px-3 py-1.5 rounded-lg border border-border/60 shadow-sm" style={{ elevation: 2 }}>
            <Text className="text-foreground text-[11px] font-bold tracking-tight text-right" numberOfLines={1}>
              {t('batch_generate', 'Batch Generate')}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => closeDialAndOpen(setBatchModalVisible)}
          className="w-[50px] h-[50px] rounded-full bg-secondary border border-border/50 items-center justify-center shadow-lg"
        >
          <Zap size={22} className="text-primary" />
        </TouchableOpacity>
      </Animated.View>

      {/* Speed Dial Action 2: Bulk Upload (Top-Left) */}
      <Animated.View 
        className="z-[9998]"
        style={{ 
          position: 'absolute', bottom: 135, right: 25,
          width: 50, height: 50,
          alignItems: 'center', justifyContent: 'center',
          transform: [{ translateX: transX2 }, { translateY: transY2 }, { scale: scale2 }], 
          opacity: dialOpacity,
          overflow: 'visible'
        }}
        pointerEvents={isDialOpen ? 'auto' : 'none'}
      >
        <View style={{ position: 'absolute', right: 55, width: 125, alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
          <View className="bg-card px-3 py-1.5 rounded-lg border border-border/60 shadow-sm" style={{ elevation: 2 }}>
            <Text className="text-foreground text-[11px] font-bold tracking-tight text-right" numberOfLines={1}>
              {t('bulk_upload', 'Bulk Upload')}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => closeDialAndOpen(setBulkUploadModalVisible)}
          className="w-[50px] h-[50px] rounded-full bg-secondary border border-border/50 items-center justify-center shadow-lg"
        >
          <FileSpreadsheet size={22} className="text-primary" />
        </TouchableOpacity>
      </Animated.View>

      {/* Speed Dial Action 1: Create Unit (Top) */}
      <Animated.View 
        className="z-[9998]"
        style={{ 
          position: 'absolute', bottom: 135, right: 25,
          width: 50, height: 50,
          alignItems: 'center', justifyContent: 'center',
          transform: [{ translateX: transX1 }, { translateY: transY1 }, { scale: scale1 }], 
          opacity: dialOpacity,
          overflow: 'visible'
        }}
        pointerEvents={isDialOpen ? 'auto' : 'none'}
      >
        <View style={{ position: 'absolute', right: 55, width: 125, alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
          <View className="bg-card px-3 py-1.5 rounded-lg border border-border/60 shadow-sm" style={{ elevation: 2 }}>
            <Text className="text-foreground text-[11px] font-bold tracking-tight text-right" numberOfLines={1}>
              {t('create_unit', 'Create Unit')}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => {
            setEditingVilla(null);
            closeDialAndOpen(setFormModalVisible);
          }}
          className="w-[50px] h-[50px] rounded-full bg-secondary border border-border/50 items-center justify-center shadow-lg"
        >
          <Plus size={22} className="text-primary" />
        </TouchableOpacity>
      </Animated.View>

      {/* Main Animated FAB */}
      <TouchableOpacity
        className="rounded-full bg-primary/90 items-center justify-center shadow-xl border border-primary/50"
        style={{ position: 'absolute', bottom: 130, right: 20, width: 60, height: 60, elevation: 8, zIndex: 9999 }}
        activeOpacity={0.7}
        onPress={toggleDial}
      >
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Plus size={28} className="text-white" />
        </Animated.View>
      </TouchableOpacity>

      {/* Details Dialog */}
      <VillaDetailsModal
        visible={detailsModalVisible}
        onClose={() => setDetailsModalVisible(false)}
        villa={selectedVilla}
        onEdit={(v) => {
          setDetailsModalVisible(false);
          setEditingVilla(v);
          setFormModalVisible(true);
        }}
      />

      {/* Form Dialog (Create / Edit) */}
      <VillaFormModal
        visible={formModalVisible}
        onClose={() => setFormModalVisible(false)}
        onSubmit={async (data) => {
          try {
            if (editingVilla) {
              await updateUnit(editingVilla._id, data);
            } else {
              await createUnit(data);
            }
            setFormModalVisible(false);
          } catch (err: any) {
            const msg = typeof err === 'string' ? err : err?.message || 'Unit operation failed';
            Alert.alert('Unit Error', msg);
          }
        }}
        editingVilla={editingVilla}
      />

      {/* Batch Dialog */}
      <BatchGenerateModal 
        visible={batchModalVisible} 
        onClose={() => setBatchModalVisible(false)} 
        onSubmit={async (batchData) => {
          try {
            await batchGenerate(batchData);
            setBatchModalVisible(false);
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
            setBulkUploadModalVisible(false);
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
