import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Send, Ban, Calendar, User, Clock, Shield } from 'lucide-react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SkeletonLoader } from '@/components/feedback/SkeletonLoader';
import { Button } from '@/components/common/Button';
import {
  fetchInvitations,
  resendInvitation,
  revokeInvitation,
  InvitationItem,
} from '@/src/features/userManagement/services/userService';
import { useTranslation } from '@/src/utils/i18n';
import { Text } from '@/components/ui/text';

const STATUS_FILTERS = ['ALL', 'PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'];

export default function InvitationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Pagination & Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Revoke modal state
  const [revokeTarget, setRevokeTarget] = useState<InvitationItem | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadData = useCallback(
    async (pageToLoad = 1, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageToLoad === 1) {
        setLoading(true);
      }

      try {
        const res = await fetchInvitations({
          page: pageToLoad,
          limit: 10,
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          search: search.trim() || undefined,
        });

        const data = res?.data || res;
        const records: InvitationItem[] = data?.records || [];

        if (pageToLoad === 1) {
          setInvitations(records);
        } else {
          setInvitations((prev) => [...prev, ...records]);
        }

        setCurrentPage(data?.currentPage || 1);
        setTotalPages(data?.totalPages || 1);
        setTotalRecords(data?.totalRecords || 0);
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to load invitations');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedStatus, search]
  );

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  const handleRefresh = () => {
    loadData(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && !refreshing && currentPage < totalPages) {
      loadData(currentPage + 1);
    }
  };

  const handleResend = async (invitation: InvitationItem) => {
    setActionLoadingId(invitation._id);
    try {
      await resendInvitation(invitation._id);
      Alert.alert('Success', `Invitation successfully resent to ${invitation.recipient?.email || 'recipient'}`);
      loadData(1);
    } catch (err: any) {
      Alert.alert('Resend Failed', err?.message || 'Failed to resend invitation');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeInvitation(revokeTarget._id);
      Alert.alert('Success', 'Invitation has been revoked.');
      setRevokeTarget(null);
      loadData(1);
    } catch (err: any) {
      Alert.alert('Revoke Failed', err?.message || 'Failed to revoke invitation');
    } finally {
      setRevoking(false);
    }
  };

  const getStatusBadgeProps = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return { variant: 'success' as const, label: 'Accepted' };
      case 'PENDING':
        return { variant: 'warning' as const, label: 'Pending' };
      case 'EXPIRED':
        return { variant: 'neutral' as const, label: 'Expired' };
      case 'REVOKED':
        return { variant: 'danger' as const, label: 'Revoked' };
      case 'REJECTED':
        return { variant: 'critical' as const, label: 'Rejected' };
      default:
        return { variant: 'neutral' as const, label: status };
    }
  };

  const renderInvitationCard = ({ item }: { item: InvitationItem }) => {
    const status = (item.status || 'PENDING').toUpperCase();
    const badgeProps = getStatusBadgeProps(status);
    const isActionLoading = actionLoadingId === item._id;

    return (
      <View className="bg-card border border-border rounded-xl p-4 mb-3 shadow-xs">
        {/* Header Row */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center flex-1 me-2">
            <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center me-2">
              <Mail size={16} className="text-primary" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                {item.recipient?.name || item.recipient?.username || 'Invited User'}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {item.recipient?.email || 'No email provided'}
              </Text>
            </View>
          </View>
          <StatusBadge variant={badgeProps.variant} label={badgeProps.label} />
        </View>

        {/* Details Grid */}
        <View className="bg-muted/40 rounded-lg p-2.5 my-2 space-y-1.5">
          {item.role?.name ? (
            <View className="flex-row items-center">
              <Shield size={13} className="text-muted-foreground me-1.5" />
              <Text className="text-xs text-muted-foreground me-1">{t('role_label', 'Role:')}</Text>
              <Text className="text-xs font-medium text-foreground">{item.role.name}</Text>
            </View>
          ) : null}

          <View className="flex-row items-center">
            <User size={13} className="text-muted-foreground me-1.5" />
            <Text className="text-xs text-muted-foreground me-1">{t('inviter_label', 'Inviter:')}</Text>
            <Text className="text-xs text-foreground">
              {item.inviter?.name || item.inviter?.email || t('system_admin', 'System Admin')}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Calendar size={13} className="text-muted-foreground me-1.5" />
              <Text className="text-xs text-muted-foreground me-1">{t('sent_label', 'Sent:')}</Text>
              <Text className="text-xs text-foreground">
                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Clock size={13} className="text-muted-foreground me-1.5" />
              <Text className="text-xs text-muted-foreground me-1">{t('expires_label', 'Expires:')}</Text>
              <Text className="text-xs text-foreground">
                {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons Row */}
        {(status === 'PENDING' || status === 'EXPIRED') && (
          <View className="flex-row items-center justify-end gap-2 mt-2 pt-2 border-t border-border/50">
            {/* Resend: PENDING or EXPIRED */}
            <Button
              variant="outline"
              size="sm"
              loading={isActionLoading}
              onPress={() => handleResend(item)}
              className="px-3"
            >
              {t('resend', 'Resend')}
            </Button>

            {/* Revoke: PENDING only */}
            {status === 'PENDING' && (
              <Button
                variant="destructive"
                size="sm"
                onPress={() => setRevokeTarget(item)}
                className="px-3"
              >
                {t('revoke', 'Revoke')}
              </Button>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenShell
      title={t('invitations', 'Invitations')}
      subtitle={`${totalRecords} ${t('invitations_registered', 'invitations registered')}`}
      onBackPress={() => router.back()}
    >
      <View className="flex-1 px-4 pt-2">
        {/* Search Bar */}
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('search_name_email', 'Search by name or email...')}
        />

        {/* Status Filter Chips */}
        <View className="flex-row py-2.5 overflow-x-auto">
          {STATUS_FILTERS.map((s) => {
            const isSelected = selectedStatus === s;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => setSelectedStatus(s)}
                className={`px-3 py-1.5 rounded-full me-2 border ${
                  isSelected
                    ? 'bg-primary border-primary'
                    : 'bg-card border-border'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    isSelected ? 'text-primary-foreground' : 'text-foreground'
                  }`}
                >
                  {t(s, s)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content List */}
        {loading && !refreshing ? (
          <SkeletonLoader count={4} />
        ) : invitations.length === 0 ? (
          <EmptyState
            title={t('no_invitations_found', 'No Invitations Found')}
            description={t('no_invitations_desc', 'No invitations match the selected criteria.')}
          />
        ) : (
          <FlatList
            data={invitations}
            keyExtractor={(item) => item._id}
            renderItem={renderInvitationCard}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>

      {/* Revocation Confirmation Modal */}
      <ConfirmationModal
        visible={!!revokeTarget}
        title="Revoke Invitation"
        message={`Are you sure you want to revoke the invitation for ${
          revokeTarget?.recipient?.name || revokeTarget?.recipient?.email || 'this user'
        }? The invitation link will immediately become invalid.`}
        confirmLabel="Revoke"
        cancelLabel="Cancel"
        variant="danger"
        loading={revoking}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </ScreenShell>
  );
}
