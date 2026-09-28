/**
 * Staff booking queue (Amenity Management V2): bookings awaiting approval, bookings
 * flagged for a staff decision, upcoming and all bookings. Staff approve or reject
 * (with a reason), decide flagged bookings, record a balance paid in cash, and cancel
 * with the refund shown first.
 */

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { KPIRow } from '@/components/ui/KPIRow';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useTranslation } from '@/src/utils/i18n';
import { useAdminBookingQueue } from '../hooks/useAdminBookingQueue';
import { useCancellationPreview } from '../hooks/useCancellationPreview';
import { AdminBookingQueueCard } from '../components/AdminBookingQueueCard';
import { AdminBookingActionsSheet } from '../components/AdminBookingActionsSheet';
import { RejectBookingSheet } from '../components/RejectBookingSheet';
import { ReviewDecisionSheet } from '../components/ReviewDecisionSheet';
import { ResidentCancelModal } from '../components/ResidentCancelModal';
import { AmenityReservation } from '../types/amenityDomain.types';
import type { AdminQueueTab } from '../store/amenityBookingSlice';
import { formatAmenityAmount } from '../utils/amenityStateHelpers';

type SubAction = 'approve' | 'reject' | 'decide' | 'collect' | 'cancel' | null;

export function AdminBookingQueueScreen() {
  const { t } = useTranslation();
  const queue = useAdminBookingQueue();
  const [sub, setSub] = useState<SubAction>(null);
  const cancelPreview = useCancellationPreview(sub === 'cancel' ? queue.selected?._id : null);

  const tabs = useMemo(
    () => [
      { label: t('amenity_admin_tab_approvals', 'Approvals'), value: 'APPROVALS' },
      { label: t('amenity_admin_tab_review', 'Needs decision'), value: 'REVIEW' },
      { label: t('amenity_admin_tab_upcoming', 'Upcoming'), value: 'UPCOMING' },
      { label: t('amenity_admin_tab_all', 'All'), value: 'ALL' },
    ],
    [t]
  );

  const emptyText: Record<AdminQueueTab, string> = {
    APPROVALS: t('amenity_admin_empty_approvals', 'No bookings are waiting for approval.'),
    REVIEW: t('amenity_admin_empty_review', 'No bookings need a staff decision.'),
    UPCOMING: t('amenity_admin_empty_upcoming', 'No upcoming bookings.'),
    ALL: t('amenity_admin_empty_all', 'No bookings match your search.'),
  };

  const selected = queue.selected;
  const closeAll = () => {
    setSub(null);
    queue.select(null);
  };
  /** Runs a staff action; on success every sheet closes (the booking may have left this tab). */
  const finish = async (action: () => Promise<boolean>) => {
    if (await action()) closeAll();
  };
  const openSub = (next: SubAction) => {
    queue.clearActionError();
    setSub(next);
  };
  const backToBooking = () => {
    queue.clearActionError();
    setSub(null);
  };

  return (
    <ScreenShell
      title={t('amenity_admin_queue_title', 'Booking Queue')}
      subtitle={t('amenity_admin_queue_sub', 'Approvals, decisions and bookings')}
      iconName="ClipboardCheck"
      loading={queue.loading && queue.items.length === 0 && !queue.error}
      scrollable={false}
    >
      <View className="flex-1 bg-background">
        <View className="py-2.5">
          <KPIRow
            cards={[
              {
                title: t('amenity_admin_kpi_approvals', 'Awaiting approval'),
                value: String(queue.counts.approvals),
                subtitle: t('amenity_admin_kpi_approvals_sub', 'Approve or reject'),
                iconName: 'Hourglass',
                variant: 'warning',
                onPress: () => queue.setTab('APPROVALS'),
              },
              {
                title: t('amenity_admin_kpi_review', 'Needs decision'),
                value: String(queue.counts.review),
                subtitle: t('amenity_admin_kpi_review_sub', 'No-shows, unpaid, returns'),
                iconName: 'ShieldAlert',
                variant: 'destructive',
                onPress: () => queue.setTab('REVIEW'),
              },
            ]}
          />
        </View>

        {queue.error ? (
          <View className="px-4 pb-2">
            <ErrorBanner message={queue.error} onDismiss={queue.clearError} onRetry={queue.refresh} />
          </View>
        ) : null}

        <SearchFilterBar
          searchValue={queue.search}
          onSearchChange={queue.setSearch}
          searchPlaceholder={t('amenity_admin_search', 'Search booking # or resident')}
          sortOptions={tabs}
          currentSort={queue.tab}
          onSortChange={(value) => queue.setTab(value as AdminQueueTab)}
        />

        <PaginatedList<AmenityReservation>
          data={queue.items}
          keyExtractor={(item) => item._id}
          renderItem={(item) => <AdminBookingQueueCard key={item._id} reservation={item} onPress={queue.select} />}
          pagination={queue.pagination}
          onLoadMore={queue.loadMore}
          onRefresh={queue.refresh}
          refreshing={queue.refreshing}
          loading={queue.loading}
          emptyIcon="CalendarCheck"
          emptyTitle={t('amenity_admin_empty_title', 'Nothing here')}
          emptySubtitle={emptyText[queue.tab]}
          contentContainerClassName="px-4 py-2 pb-28"
        />
      </View>

      <AdminBookingActionsSheet
        reservation={selected}
        visible={!!selected && sub === null}
        onClose={closeAll}
        loading={queue.actionLoading}
        error={queue.actionError}
        onApprove={() => openSub('approve')}
        onReject={() => openSub('reject')}
        onDecideReview={() => openSub('decide')}
        onCollectCash={() => openSub('collect')}
        onCancel={() => openSub('cancel')}
      />

      <ConfirmationModal
        visible={!!selected && sub === 'approve'}
        title={t('amenity_admin_approve_title', 'Approve booking?')}
        message={t('amenity_admin_approve_message', 'The resident is notified and receives the gate pass.')}
        confirmLabel={t('amenity_admin_approve', 'Approve')}
        cancelLabel={t('amenity_inspection_back', 'Back')}
        variant="info"
        loading={queue.actionLoading}
        onConfirm={() => selected && finish(() => queue.approve(selected._id))}
        onCancel={backToBooking}
      />

      <ConfirmationModal
        visible={!!selected && sub === 'collect'}
        title={t('amenity_admin_collect_title', 'Record cash payment?')}
        message={t('amenity_admin_collect_message', 'Confirm you received {amount} in cash. A receipt is recorded.', {
          amount: formatAmenityAmount(selected?.balanceAmount),
        })}
        confirmLabel={t('amenity_admin_collect_confirm', 'Record payment')}
        cancelLabel={t('amenity_inspection_back', 'Back')}
        variant="info"
        loading={queue.actionLoading}
        onConfirm={() => selected && finish(() => queue.collectCash(selected._id, Number(selected.balanceAmount || 0)))}
        onCancel={backToBooking}
      />

      <RejectBookingSheet
        reservation={selected}
        visible={!!selected && sub === 'reject'}
        onClose={backToBooking}
        loading={queue.actionLoading}
        error={queue.actionError}
        onConfirm={(reason) => selected && finish(() => queue.reject(selected._id, reason))}
      />

      <ReviewDecisionSheet
        reservation={selected}
        visible={!!selected && sub === 'decide'}
        onClose={backToBooking}
        loading={queue.actionLoading}
        error={queue.actionError}
        onConfirm={(action, options) => selected && finish(() => queue.resolveReview(selected._id, action, options))}
      />

      <ResidentCancelModal
        reservation={selected}
        visible={!!selected && sub === 'cancel'}
        onClose={backToBooking}
        loading={queue.actionLoading}
        preview={cancelPreview.preview}
        previewLoading={cancelPreview.loading}
        error={queue.actionError}
        onConfirm={(reason) => selected && finish(() => queue.cancel(selected._id, reason))}
        testID="admin-cancel-sheet"
        forStaff
      />
    </ScreenShell>
  );
}

export default AdminBookingQueueScreen;
