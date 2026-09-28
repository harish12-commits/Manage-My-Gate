import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { BlacklistEntryCard, BlacklistEntry } from '@/src/features/visitor/components/admin/BlacklistEntryCard';
import { AdminBlacklistModal } from '@/src/features/visitor/components/admin/AdminBlacklistModal';
import { useAdminVisitor } from '@/src/features/visitor/hooks/useAdminVisitor';
import { Plus } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

export default function AdminBlacklistScreen() {
  const { t } = useTranslation();
  const {
    blacklist,
    status,
    actionStatus,
    loadBlacklist,
    addToBlacklist,
    removeFromBlacklist,
  } = useAdminVisitor();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRemoveId, setSelectedRemoveId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    loadBlacklist();
  }, [loadBlacklist]);

  const handleRefresh = useCallback(() => {
    loadBlacklist();
  }, [loadBlacklist]);

  const filteredBlacklist = useMemo(() => {
    if (!search.trim()) return blacklist;
    const q = search.toLowerCase();
    return blacklist.filter((item: any) =>
      (item.visitorName && item.visitorName.toLowerCase().includes(q)) ||
      (item.phone && item.phone.includes(q)) ||
      (item.reason && item.reason.toLowerCase().includes(q)) ||
      (item.idProofNumber && item.idProofNumber.toLowerCase().includes(q))
    );
  }, [blacklist, search]);

  const handleConfirmRemove = async () => {
    if (selectedRemoveId) {
      const res: any = await removeFromBlacklist(selectedRemoveId);
      setRemoveError(res?.meta?.requestStatus === 'rejected' ? String(res.payload || 'Failed to remove entry.') : null);
      setSelectedRemoveId(null);
    }
  };

  const renderEntry = (item: BlacklistEntry) => (
    <BlacklistEntryCard
      key={item._id}
      entry={item}
      onRemovePress={setSelectedRemoveId}
    />
  );

  const renderHeader = () => (
    <View className="mb-3">
      {removeError ? (
        <ErrorBanner message={removeError} onDismiss={() => setRemoveError(null)} className="mb-3" />
      ) : null}
      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('search_barred_visitor_name_phone_reason', 'Search barred visitor name, phone, reason...')}
        variant="default"
        className="px-0 py-0 border-0"
      />
    </View>
  );

  return (
    <ScreenShell
      title={t('community_visitor_blacklist', 'Community Visitor Blacklist')}
      subtitle={t('restricted_visitors_security_breach_registry', 'Restricted visitors & security breach registry')}
      headerRight={
        <Button
          variant="destructive"
          size="sm"
          onPress={() => setModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add Blacklist"
          className="flex-row items-center gap-1 px-3 rounded-full bg-red-600 active:bg-red-700 border-0"
        >
          <Plus size={14} color="#ffffff" />
          <Text className="text-xs font-bold text-white">{t('add_blacklist', 'Add Blacklist')}</Text>
        </Button>
      }
    >
      <View className="flex-1 bg-background">
        {/* High-Performance Paginated List */}
        <PaginatedList<BlacklistEntry>
          data={(filteredBlacklist || []) as BlacklistEntry[]}
          renderItem={(item) => item ? renderEntry(item) : null}
          keyExtractor={(item, index) => item?._id || `empty-${index}`}
          pagination={{
            currentPage: 1,
            totalPages: 1,
            totalRecords: filteredBlacklist.length,
            limit: 50,
          }}
          onLoadMore={handleRefresh}
          loading={status === 'loading'}
          onRefresh={handleRefresh}
          ListHeaderComponent={renderHeader()}
          emptyIcon="ShieldAlert"
          emptyTitle={t('no_blacklisted_visitors', 'No Blacklisted Visitors')}
          emptySubtitle={t('add_individuals_to_prevent_gate_entry_across_the_community', 'Add individuals to prevent gate entry across the community.')}
          contentContainerClassName="px-4 pt-3 pb-28"
        />
      </View>

      <AdminBlacklistModal
        visible={modalOpen}
        loading={actionStatus === 'loading'}
        onClose={() => setModalOpen(false)}
        onSubmit={async (data) => {
          const res: any = await addToBlacklist(data);
          // Throwing keeps the form open with the reason (e.g. a duplicate entry).
          if (res?.meta?.requestStatus === 'rejected') {
            throw new Error(String(res.payload || 'Failed to blacklist visitor'));
          }
        }}
      />

      <ConfirmationModal
        visible={Boolean(selectedRemoveId)}
        title={t('remove_blacklist_entry_title', 'Remove Blacklist Entry?')}
        message={t('remove_blacklist_entry_msg', 'Are you sure you want to remove this visitor from the community blacklist?')}
        variant="danger"
        confirmLabel={t('remove_entry', 'Remove Entry')}
        onConfirm={handleConfirmRemove}
        onCancel={() => setSelectedRemoveId(null)}
        loading={actionStatus === 'loading'}
      />
    </ScreenShell>
  );
}
