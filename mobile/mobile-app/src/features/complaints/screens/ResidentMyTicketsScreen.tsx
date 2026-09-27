import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Alert } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { CheckCircle2 } from 'lucide-react-native';
import { useComplaints } from '../hooks/useComplaints';
import { ComplaintCard } from '../components/ComplaintCard';
import { ComplaintDetailSheet } from '../components/ComplaintDetailSheet';
import { ComplaintFilterDrawer, ComplaintFilterValues } from '../components/ComplaintFilterDrawer';
import { Complaint } from '../types';
import { useTranslation } from '@/src/utils/i18n';

export function ResidentMyTicketsScreen() {
  const { t } = useTranslation();
  const {
    complaints,
    pagination,
    isLoading,
    error,
    fetchComplaints,
    addComment,
    confirmCompletion,
    updateStatus,
    deleteComplaint,
    clearErrors
  } = useComplaints();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [drawerFilters, setDrawerFilters] = useState<ComplaintFilterValues>({
    status: 'ALL',
    priority: 'ALL',
    category: 'ALL',
  });

  // Modal States
  const [cancelTicketId, setCancelTicketId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    fetchComplaints({ page: 1, limit: 20 });
  }, [fetchComplaints]);

  const loadMore = useCallback(() => {
    if (!isLoading && pagination.currentPage < pagination.totalPages) {
      fetchComplaints({ page: pagination.currentPage + 1, limit: pagination.limit || 20 });
    }
  }, [fetchComplaints, isLoading, pagination]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // The filter drawer is the single source of truth for ticket filters.
  // Keeping status controls there avoids duplicate, conflicting states.
  const filteredTickets = useMemo(() => {
    return complaints.filter((item: Complaint) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesNumber = item.complaintNumber?.toLowerCase().includes(query);
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesCat = item.category?.toLowerCase().includes(query);
        if (!matchesNumber && !matchesTitle && !matchesCat) return false;
      }

      // 2. Drawer Priority Filter
      if (drawerFilters.priority && drawerFilters.priority !== 'ALL') {
        if (item.priority?.toLowerCase() !== drawerFilters.priority.toLowerCase()) return false;
      }

      // 3. Drawer Category Filter
      if (drawerFilters.category && drawerFilters.category !== 'ALL') {
        if (item.category?.toLowerCase() !== drawerFilters.category.toLowerCase()) return false;
      }

      // 4. Drawer Status Filter. Drawer values represent lifecycle groups,
      // rather than raw backend status strings.
      if (drawerFilters.status && drawerFilters.status !== 'ALL') {
        const status = String(item.status || '').toUpperCase();
        const statusGroups: Record<string, string[]> = {
          UNASSIGNED: ['SUBMITTED', 'OPEN', 'WAITING FOR ASSIGNMENT'],
          ASSIGNED: ['ASSIGNED', 'ACCEPTED', 'WAITING FOR ACCEPTANCE'],
          IN_PROGRESS: ['IN PROGRESS'],
          ESCALATED: ['ESCALATED'],
          COMPLETED: ['CLOSED', 'COMPLETED', 'WORK COMPLETED'],
        };
        const allowedStatuses = statusGroups[drawerFilters.status] || [drawerFilters.status.toUpperCase()];
        if (!allowedStatuses.includes(status)) return false;
      }

      return true;
    });
  }, [complaints, searchQuery, drawerFilters]);

  const activeDrawerCount =
    (drawerFilters.status !== 'ALL' && drawerFilters.status ? 1 : 0) +
    (drawerFilters.priority !== 'ALL' && drawerFilters.priority ? 1 : 0) +
    (drawerFilters.category !== 'ALL' && drawerFilters.category ? 1 : 0);

  const handleConfirmCancelTicket = async () => {
    if (!cancelTicketId) return;
    try {
      await updateStatus(cancelTicketId, {
        status: 'Cancelled',
        remarks: 'Cancelled by resident',
      });
      setCancelTicketId(null);
      loadData();
    } catch (err: any) {
      console.error('Failed to cancel ticket:', err);
      Alert.alert('Error', err?.message || 'Failed to cancel ticket');
    }
  };

  const handleReopenTicket = async (id: string, remarks: string) => {
    try {
      await updateStatus(id, {
        status: 'Reopened',
        remarks: remarks || 'Reopened by resident due to persistent issue',
      });
      loadData();
    } catch (err: any) {
      console.error('Failed to reopen ticket:', err);
      Alert.alert('Error', err?.message || 'Failed to reopen ticket');
    }
  };

  const handleConfirmDeleteTicket = async (id: string) => {
    try {
      await deleteComplaint(id);
      loadData();
    } catch (err: any) {
      console.error('Failed to delete ticket:', err);
      Alert.alert('Error', err?.message || 'Failed to delete ticket');
      throw err;
    }
  };

  return (
    <ScreenShell
      title={t('track_my_tickets', 'Track My Tickets')}
      subtitle={t('track_my_tickets_sub', 'View live status, rate completed repairs & manage maintenance requests')}
      iconName="ListOrdered"
      loading={isLoading && complaints.length === 0}
    >
      <View className="flex-1 bg-background">
        {error ? (
          <View className="px-4 pt-3">
            <ErrorBanner message={error} onDismiss={clearErrors} />
          </View>
        ) : null}

        <PaginatedList<Complaint>
          data={filteredTickets}
          pagination={pagination}
          loading={isLoading}
          refreshing={isLoading && complaints.length > 0}
          onRefresh={loadData}
          onLoadMore={loadMore}
          paginationSummary
          contentContainerClassName="pb-28"
          ListHeaderComponent={
            <>
          {/* SECTION 1: SEARCH BAR */}
          <SearchFilterBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t('search_ticket_placeholder', 'Search ticket # or title...')}
            onFilterPress={() => setIsFilterOpen(true)}
            activeFilterCount={activeDrawerCount}
          />

            </>
          }
          renderItem={(ticket) => (
            <View className="px-4">
              <ComplaintCard
                complaint={ticket}
                onPress={() => setSelectedComplaint(ticket)}
                onConfirmPress={() => setSelectedComplaint(ticket)}
                onCancelPress={() => setCancelTicketId(ticket._id)}
              />
            </View>
          )}
          ListEmptyComponent={
            !isLoading ? (
              <View className="px-4 pt-6">
                <EmptyState
                  icon={CheckCircle2}
                  title={t('no_tickets_found', 'No Tickets Found')}
                  description={t('no_tickets_desc', 'You have no maintenance requests matching your selected search filter.')}
                />
              </View>
            ) : null
          }
        />

        {/* TICKET DETAILS DRAWER SHEET */}
        <ComplaintDetailSheet
          visible={!!selectedComplaint}
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          onAddComment={async (id, text) => {
            await addComment(id, text);
            loadData();
          }}
          onConfirmCompletion={async (id, payload) => {
            await confirmCompletion(id, payload);
            loadData();
          }}
          onCancelTicket={async (id) => {
            await updateStatus(id, { status: 'Cancelled', remarks: 'Cancelled by resident' });
            loadData();
          }}
          onReopenTicket={async (id, remarks) => {
            await handleReopenTicket(id, remarks);
          }}
          onDeleteTicket={async (id) => {
            await handleConfirmDeleteTicket(id);
          }}
          isResident={true}
        />

        {/* CANCEL TICKET CONFIRMATION MODAL */}
        <ConfirmationModal
          visible={!!cancelTicketId}
          onCancel={() => setCancelTicketId(null)}
          onConfirm={handleConfirmCancelTicket}
          title="Cancel Complaint Request?"
          message="Are you sure you want to cancel this ticket? The assigned team will be notified."
          confirmLabel="Yes, Cancel Ticket"
          cancelLabel="Keep Ticket"
          variant="danger"
        />

        {/* COMPLAINT FILTER DRAWER */}
        <ComplaintFilterDrawer
          visible={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          filters={drawerFilters}
          onApply={setDrawerFilters}
          onReset={() =>
            setDrawerFilters({
              status: 'ALL',
              priority: 'ALL',
              category: 'ALL',
            })
          }
        />
      </View>
    </ScreenShell>
  );
}

export default ResidentMyTicketsScreen;
