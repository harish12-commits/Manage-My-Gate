import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Linking, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import { ListCard } from '@/components/ui/ListCard';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { useVilla } from '@/src/features/villa/hooks/useVilla';
import { Villa } from '@/src/features/villa/store/villaSlice';
import { Phone, Search, Building2, User, Home } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

export const GuardVillaDirectoryView: React.FC = () => {
  const { t } = useTranslation();
  const { villas, pagination, loading, fetchVillas } = useVilla();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Occupied' | 'Vacant'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchVillas({
        page: 1,
        limit: 50,
        search: search.trim() || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
    }, search.trim() ? 300 : 0);

    return () => clearTimeout(debounce);
  }, [fetchVillas, search, statusFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVillas({
      page: 1,
      limit: 50,
      search: search.trim() || undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    });
    setRefreshing(false);
  }, [fetchVillas, search, statusFilter]);

  const handleLoadMore = useCallback(async () => {
    if (pagination && pagination.currentPage < pagination.totalPages) {
      await fetchVillas({
        page: pagination.currentPage + 1,
        limit: pagination.rowsPerPage || 50,
        search: search.trim() || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
    }
  }, [pagination, fetchVillas, search, statusFilter]);

  const filteredVillas = useMemo(() => {
    if (!Array.isArray(villas)) return [];
    return villas.filter((v: Villa) => {
      const matchStatus =
        statusFilter === 'ALL' ||
        v.status?.toLowerCase() === statusFilter.toLowerCase();

      if (!matchStatus) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();

      const unitMatch = v.unitNumber?.toLowerCase().includes(q);
      const blockMatch = v.blockOrBuilding?.toLowerCase().includes(q);
      const primaryName =
        v.primaryResident?.name ||
        v.primaryResident?.username ||
        (typeof v.primaryResidentId === 'object' ? v.primaryResidentId?.name : '');
      const residentMatch = primaryName?.toLowerCase().includes(q);

      const subResidentsMatch = v.residents?.some((r) => {
        const rName = typeof r.userId === 'object' ? r.userId?.name || r.userId?.username : '';
        return rName?.toLowerCase().includes(q);
      });

      return unitMatch || blockMatch || residentMatch || subResidentsMatch;
    });
  }, [villas, search, statusFilter]);

  const handleCallResident = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const renderHeader = () => (
    <View className="gap-3 mb-3">
      {/* Search Input */}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t('search_villa_block_or_resident_name', 'Search villa, block, or resident name...')}
        leftIcon={<Search size={16} className="text-muted-foreground" />}
        inputClassName="text-xs"
      />

      {/* Filter Chips */}
      <View className="flex-row items-center gap-2">
        {(['ALL', 'Occupied', 'Vacant'] as const).map((st) => (
          <TouchableOpacity
            key={st}
            onPress={() => setStatusFilter(st)}
            activeOpacity={0.7}
            className={`min-h-11 px-3.5 py-2 rounded-full border items-center justify-center ${
              statusFilter === st
                ? 'bg-primary border-primary'
                : 'bg-card border-border'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                statusFilter === st ? 'text-primary-foreground' : 'text-foreground'
              }`}
            >
              {st === 'ALL' ? t('all_units', 'All Units') : st === 'Occupied' ? t('occupied', 'Occupied') : t('vacant', 'Vacant')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <PaginatedList<Villa>
        data={filteredVillas}
        pagination={{
          currentPage: pagination.currentPage,
          totalPages: pagination.totalPages,
          totalRecords: pagination.totalRecords || filteredVillas.length,
          limit: pagination.rowsPerPage || 100,
        }}
        onLoadMore={handleLoadMore}
        onRefresh={handleRefresh}
        paginationSummary
        refreshing={refreshing}
        loading={loading && !refreshing && filteredVillas.length === 0}
        ListHeaderComponent={renderHeader()}
        emptyIcon="Building2"
        emptyTitle="No Villas Found"
        emptySubtitle="No estate units match your search query."
        contentContainerClassName="px-4 pt-3 pb-28 gap-3"
        renderItem={(villa) => {
          if (!villa) return null;

          const residentName =
            villa.primaryResident?.name ||
            villa.primaryResident?.username ||
            (typeof villa.primaryResidentId === 'object' ? villa.primaryResidentId?.name : '') ||
            (villa.residents && villa.residents.length > 0
              ? typeof villa.residents[0].userId === 'object'
                ? villa.residents[0].userId?.name
                : 'Assigned Resident'
              : 'Vacant');

          const residentPhone =
            villa.primaryResident?.phone ||
            (typeof villa.primaryResidentId === 'object' ? villa.primaryResidentId?.phone : '') ||
            (villa.residents && villa.residents.length > 0 && typeof villa.residents[0].userId === 'object'
              ? villa.residents[0].userId?.phone
              : undefined);

          const isOccupied = villa.status === 'Occupied' || residentName !== 'Vacant';

          return (
            <ListCard
              title={`Villa ${villa.unitNumber}${villa.blockOrBuilding ? ` (${villa.blockOrBuilding})` : ''}`}
              subtitle={`Host: ${residentName}${residentPhone ? ` • Intercom: ${residentPhone}` : ''}`}
              leftIcon="Home"
              leftIconBgColor="bg-primary/10"
              status={{
                label: isOccupied ? t('occupied', 'OCCUPIED').toUpperCase() : t('vacant', 'VACANT').toUpperCase(),
                variant: isOccupied ? 'success' : 'neutral',
              }}
              rightContent={
                residentPhone ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => handleCallResident(residentPhone)}
                    className="flex-row items-center gap-1 h-8 px-2.5 rounded-xl border-primary/30 bg-primary/10"
                    accessibilityLabel={t('call_resident_villa', 'Call resident of Villa {unit}', { unit: villa.unitNumber })}
                  >
                    <Phone size={13} className="text-primary" />
                    <Text className="text-xs font-bold text-primary">{t('dial', 'Dial')}</Text>
                  </Button>
                ) : null
              }
            />
          );
        }}
      />
    </View>
  );
};

export default GuardVillaDirectoryView;
