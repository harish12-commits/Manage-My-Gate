import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, Alert, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SuccessToast } from '@/components/feedback';
import {
  Bell,
  CheckCheck,
  Trash2,
  QrCode,
  CreditCard,
  AlertCircle,
  BellRing,
  Search,
  Info,
  ChevronRight,
  RotateCcw,
  Building2,
  Check,
  X,
} from 'lucide-react-native';
import { useNotifications } from '@/src/features/notification/hooks/useNotifications';
import { NotificationItemData } from '@/src/features/notification/services/notificationService';
import { mapActionUrlToMobileRoute } from '@/src/features/notification/utils/notificationNavigation';
import {
  InvitationDetailModal,
  extractInvitationToken,
} from '@/src/features/notification/components/InvitationDetailModal';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/src/store/store';
import {
  acceptInviteThunk,
  rejectInviteThunk,
  switchWorkspaceContextThunk,
} from '@/src/features/auth/store/authSlice';
import { getStatusTabStyle } from '@/components/ui/statusTabColors';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from '@/src/utils/i18n';

export default function NotificationsScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Bulk Delete State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [successToastMessage, setSuccessToastMessage] = useState<string | null>(null);

  // Invitation Modal State
  const [selectedInviteNotification, setSelectedInviteNotification] = useState<NotificationItemData | null>(null);
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [inviteStatusMap, setInviteStatusMap] = useState<Record<string, 'ACCEPTED' | 'REJECTED'>>({});

  const {
    items,
    unreadCount,
    pagination,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  useFocusEffect(
    useCallback(() => {
      // Auto-clear notification badge when the screen is focused
      if (unreadCount > 0) {
        markAllAsRead();
      }
    }, [unreadCount, markAllAsRead])
  );

  const blurActiveElement = useCallback(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);



  // Helper to determine if a notification represents an invitation
  const isInvitationNotification = useCallback((notification?: NotificationItemData | null): boolean => {
    if (!notification) return false;
    if (notification.type === 'INVITATION') return true;
    const title = (notification.title || '').toLowerCase();
    const body = (notification.body || '').toLowerCase();
    const url = (notification.actionUrl || '').toLowerCase();
    return (
      title.includes('invitation') ||
      body.includes('invited') ||
      url.includes('/invite/') ||
      url.includes('accept-invite')
    );
  }, []);

  // Filter items based on active tab
  const filteredItems = React.useMemo(() => {
    if (activeTab === 'unread') {
      return items.filter((item) => !item.isRead);
    }
    return items;
  }, [items, activeTab]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchNotifications(1, 15);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (
      !loading &&
      pagination &&
      pagination.currentPage < pagination.totalPages
    ) {
      fetchNotifications(pagination.currentPage + 1, 15);
    }
  };

  // Full acceptance workflow with automatic workspace context switch and navigation
  const handleAcceptInvitation = useCallback(
    async (token: string, orgId?: string, orgName?: string) => {
      try {
        const actionResult: any = await dispatch(
          acceptInviteThunk({ token, email: user?.email })
        ).unwrap();

        const targetOrg = orgId || actionResult?.orgId || actionResult?.user?.orgId;
        if (targetOrg) {
          try {
            await dispatch(switchWorkspaceContextThunk({ targetOrgId: targetOrg })).unwrap();
          } catch (_) {}
        }

        const notifId = selectedInviteNotification?.id || selectedInviteNotification?._id;
        if (notifId) {
          markAsRead(notifId);
          setInviteStatusMap((prev) => ({ ...prev, [notifId]: 'ACCEPTED' }));
        }

        setIsInviteModalVisible(false);
        setSelectedInviteNotification(null);

        // Seamlessly navigate to the community page
        router.replace('/(resident)/dashboard');
      } catch (err: any) {
        const msg = err?.message || err || 'Failed to accept invitation';
        Alert.alert(t('invitation_error', 'Invitation Error'), msg);
        throw err;
      }
    },
    [dispatch, user?.email, selectedInviteNotification, markAsRead, router, t]
  );

  // Full rejection workflow matching email rejection logic
  const handleRejectInvitation = useCallback(
    async (token: string, orgName?: string) => {
      try {
        await dispatch(rejectInviteThunk({ token, email: user?.email })).unwrap();

        const notifId = selectedInviteNotification?.id || selectedInviteNotification?._id;
        if (notifId) {
          markAsRead(notifId);
          setInviteStatusMap((prev) => ({ ...prev, [notifId]: 'REJECTED' }));
        }

        setIsInviteModalVisible(false);
        setSelectedInviteNotification(null);

        await fetchNotifications(1, 15);
        Alert.alert(
          t('invitation_declined', 'Invitation Declined'),
          `${t('declined_success', 'You have declined the invitation to join')} ${orgName || 'the workspace'}.`
        );
      } catch (err: any) {
        const msg = err?.message || err || 'Failed to reject invitation';
        Alert.alert(t('error', 'Error'), msg);
        throw err;
      }
    },
    [dispatch, user?.email, selectedInviteNotification, markAsRead, fetchNotifications, t]
  );

  // Quick card accept button handler
  const handleCardQuickAccept = useCallback(
    async (notification: NotificationItemData) => {
      const token = extractInvitationToken(notification);
      if (!token) {
        // Fallback to opening details modal
        setSelectedInviteNotification(notification);
        setIsInviteModalVisible(true);
        return;
      }
      const notifId = notification.id || notification._id || '';
      setActionInProgressId(notifId);
      try {
        const actionResult: any = await dispatch(
          acceptInviteThunk({ token, email: user?.email })
        ).unwrap();

        const targetOrg =
          notification.metadata?.orgId || actionResult?.orgId || actionResult?.user?.orgId;
        if (targetOrg) {
          try {
            await dispatch(switchWorkspaceContextThunk({ targetOrgId: targetOrg })).unwrap();
          } catch (_) {}
        }

        if (notifId) {
          markAsRead(notifId);
          setInviteStatusMap((prev) => ({ ...prev, [notifId]: 'ACCEPTED' }));
        }

        router.replace('/(resident)/dashboard');
      } catch (err: any) {
        const msg = err?.message || err || 'Failed to accept invitation';
        Alert.alert(t('invitation_error', 'Invitation Error'), msg);
      } finally {
        setActionInProgressId(null);
      }
    },
    [dispatch, user?.email, markAsRead, router, t]
  );

  // Quick card reject button handler
  const handleCardQuickReject = useCallback(
    async (notification: NotificationItemData) => {
      const token = extractInvitationToken(notification);
      if (!token) {
        setSelectedInviteNotification(notification);
        setIsInviteModalVisible(true);
        return;
      }
      const notifId = notification.id || notification._id || '';
      const orgName =
        notification.metadata?.communityName || notification.title || 'the community';

      Alert.alert(
        t('decline_invitation', 'Decline Invitation'),
        `${t('confirm_decline', 'Are you sure you want to decline the invitation to join')} ${orgName}?`,
        [
          { text: t('cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('decline', 'Decline'),
            style: 'destructive',
            onPress: async () => {
              setActionInProgressId(notifId);
              try {
                await dispatch(rejectInviteThunk({ token, email: user?.email })).unwrap();
                if (notifId) {
                  markAsRead(notifId);
                  setInviteStatusMap((prev) => ({ ...prev, [notifId]: 'REJECTED' }));
                }
                await fetchNotifications(1, 15);
                Alert.alert(
                  t('invitation_declined', 'Invitation Declined'),
                  `${t('declined_success', 'You have declined the invitation to join')} ${orgName}.`
                );
              } catch (err: any) {
                const msg = err?.message || err || 'Failed to reject invitation';
                Alert.alert(t('error', 'Error'), msg);
              } finally {
                setActionInProgressId(null);
              }
            },
          },
        ]
      );
    },
    [dispatch, user?.email, markAsRead, fetchNotifications, t]
  );

  const handleNotificationPress = (notification: NotificationItemData) => {
    blurActiveElement();
    const id = notification.id || notification._id;
    if (id && !notification.isRead) {
      markAsRead(id);
    }

    // Intercept invitation notifications to show community details and accept/reject modal
    if (isInvitationNotification(notification)) {
      setSelectedInviteNotification(notification);
      setIsInviteModalVisible(true);
      return;
    }

    if (notification.actionUrl) {
      const route = mapActionUrlToMobileRoute(
        notification.actionUrl,
        notification.type,
        notification
      );
      router.push(route as any);
    }
  };

  const getNotificationIcon = (type?: string) => {
    switch (type?.toUpperCase()) {
      case 'VISITOR':
        return <QrCode size={20} color="#2563EB" />;
      case 'BILLING':
      case 'FINANCIAL':
        return <CreditCard size={20} color="#16A34A" />;
      case 'COMPLAINT':
      case 'WARNING':
      case 'ERROR':
        return <AlertCircle size={20} color="#DC2626" />;
      case 'NOTICE':
      case 'COMMUNITY':
        return <BellRing size={20} color="#DB2777" />;
      case 'AMENITY':
        return <Search size={20} color="#7C3AED" />;
      default:
        return <Info size={20} color="#2563EB" />;
    }
  };

  const formatTimeAgo = (createdAtString?: string) => {
    if (!createdAtString) return t('just_now', 'Just now');
    const date = new Date(createdAtString);
    if (isNaN(date.getTime())) return createdAtString;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return t('just_now', 'Just now');
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderNotificationCard = (notification: NotificationItemData) => {
    const notifId =
      notification.id || notification._id || Math.random().toString();
    const isUnread = !notification.isRead;
    const isInvite = isInvitationNotification(notification);
    const isActionLoading = actionInProgressId === notifId;

    const trackedStatus: string =
      (inviteStatusMap[notifId] as string) ||
      (notification.metadata?.invitationStatus as string) ||
      (notification.metadata?.membershipStatus as string) ||
      '';
    const isInviteAccepted =
      trackedStatus === 'ACCEPTED' ||
      trackedStatus === 'Active' ||
      trackedStatus === 'ACCEPTED_MEMBER';
    const isInviteRejected =
      trackedStatus === 'REJECTED' ||
      trackedStatus === 'Declined' ||
      trackedStatus === 'Rejected';

    const isSelected = selectedIds.has(notifId);

    return (
      <TouchableOpacity
        key={notifId}
        onPress={() => {
          if (isSelectionMode) {
            const newSet = new Set(selectedIds);
            if (newSet.has(notifId)) newSet.delete(notifId);
            else newSet.add(notifId);
            setSelectedIds(newSet);
          } else {
            handleNotificationPress(notification);
          }
        }}
        activeOpacity={0.8}
        className={`p-4 rounded-2xl border flex-row items-start gap-3.5 mb-2.5 shadow-xs ${
          isSelected 
            ? 'bg-primary/5 border-primary' 
            : isUnread
            ? 'bg-primary/10 border-primary/30'
            : 'bg-card border-border/80'
        }`}
      >
        {/* Selection Checkbox */}
        {isSelectionMode && (
          <View className={`mt-2 size-5 rounded-md border items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary' : 'bg-background border-border'}`}>
            {isSelected && <Check size={12} color="white" strokeWidth={3} />}
          </View>
        )}

        {/* Unread Amber/Gold Dot */}
        {isUnread && !isSelectionMode && (
          <View className="size-2 rounded-full bg-primary absolute top-3.5 end-3.5" />
        )}

        {/* Notification Type Icon Wrapper */}
        <View className="p-3 rounded-2xl bg-secondary border border-border/60 shrink-0 mt-0.5">
          {isInvite ? (
            <Building2 size={20} color="#FF6A00" />
          ) : (
            getNotificationIcon(notification.type)
          )}
        </View>

        {/* Content Section */}
        <View className="flex-1 pe-2 justify-center">
          <View className="flex-row items-center justify-between">
            <Text
              className={`text-[13px] tracking-tight ${
                isUnread
                  ? 'text-foreground font-black'
                  : 'text-foreground/90 font-bold'
              }`}
              numberOfLines={1}
            >
              {notification.title || t('system_notification', 'System Notification')}
            </Text>
            <Text className="text-[10px] text-muted-foreground font-medium">
              {formatTimeAgo(notification.createdAt)}
            </Text>
          </View>

          {/* Invitation Badge */}
          {isInvite ? (
            <View className="flex-row items-center mt-1">
              <StatusBadge
                variant="info"
                label={t('workspace_invitation', 'Workspace Invitation')}
                size="sm"
                dot={true}
              />
            </View>
          ) : null}

          <Text
            className="text-[12px] text-muted-foreground mt-1 leading-[17px]"
            numberOfLines={3}
          >
            {notification.body || ''}
          </Text>

          {/* Invitation Action Buttons & View Details */}
          {isInvite ? (
            <View className="flex-col gap-2 mt-3 pt-2.5 border-t border-border/50">
              {isInviteAccepted ? (
                <View className="flex-row items-center gap-2">
                  <StatusBadge
                    variant="success"
                    label={t('accepted', 'Accepted')}
                    size="sm"
                    dot={true}
                  />
                </View>
              ) : isInviteRejected ? (
                <View className="flex-row items-center gap-2">
                  <StatusBadge
                    variant="danger"
                    label={t('declined', 'Declined')}
                    size="sm"
                    dot={true}
                  />
                </View>
              ) : (
                <View className="flex-row items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onPress={(e) => {
                      e.stopPropagation();
                      handleCardQuickAccept(notification);
                    }}
                    loading={isActionLoading}
                    disabled={isActionLoading}
                    className="h-8 px-3 rounded-lg flex-1"
                  >
                    <View className="flex-row items-center justify-center gap-1">
                      <Check size={13} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold font-sans">
                        {t('accept', 'Accept')}
                      </Text>
                    </View>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onPress={(e) => {
                      e.stopPropagation();
                      handleCardQuickReject(notification);
                    }}
                    loading={isActionLoading}
                    disabled={isActionLoading}
                    className="h-8 px-3 rounded-lg border-destructive/40 flex-1"
                  >
                    <View className="flex-row items-center justify-center gap-1">
                      <X size={13} className="text-destructive" />
                      <Text className="text-destructive text-xs font-semibold font-sans">
                        {t('decline', 'Decline')}
                      </Text>
                    </View>
                  </Button>
                </View>
              )}

              <TouchableOpacity
                onPress={() => handleNotificationPress(notification)}
                className="flex-row items-center gap-1 py-1 self-start"
              >
                <Text className="text-[11px] font-bold text-primary">
                  {t('view_details', 'View details')}
                </Text>
                <ChevronRight size={12} color="#FF6A00" />
              </TouchableOpacity>
            </View>
          ) : notification.actionUrl ? (
            <View className="flex-row items-center gap-1 mt-2.5">
              <Text className="text-[11px] font-bold text-primary">
                {t('view_details', 'View details')}
              </Text>
              <ChevronRight size={12} color="#FF6A00" />
            </View>
          ) : null}
        </View>

        {/* Delete Action Button */}
        {!isSelectionMode && (
          <TouchableOpacity
            onPress={async (e) => {
              e.stopPropagation();
              blurActiveElement();
              try {
                await deleteNotification(notifId);
                setSuccessToastMessage(t('notification_deleted', 'Notification deleted successfully.'));
                setTimeout(() => setSuccessToastMessage(null), 3000);
              } catch (error) {
                console.error("Failed to delete notification", error);
              }
            }}
            activeOpacity={0.7}
            className="p-1.5 self-center shrink-0 rounded-full bg-secondary/80 border border-border/40"
            accessibilityRole="button"
            accessibilityLabel="Delete notification"
          >
            <Trash2 size={14} className="text-muted-foreground" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      {/* Success Toast - positioned absolutely above bottom navigation */}
      {successToastMessage && (
        <View className="absolute bottom-24 left-4 right-4 z-[999] elevation-5">
          <SuccessToast
            message={successToastMessage}
            visible={!!successToastMessage}
            onDismiss={() => setSuccessToastMessage(null)}
            duration={3000}
          />
        </View>
      )}

      <ScreenShell
        title={t('notifications', 'Notifications')}
        subtitle={
          isSelectionMode
            ? `${selectedIds.size} ${t('selected', 'selected')}`
            : unreadCount > 0
            ? `${unreadCount} ${t('unread_notifications', 'unread alerts')}`
            : t('all_caught_up', 'All notifications and activity logs')
        }
        iconName="Bell"
        showBackButton={true}
        headerRight={
          <TouchableOpacity
            onPress={() => {
              setIsSelectionMode(!isSelectionMode);
              setSelectedIds(new Set());
            }}
            activeOpacity={0.7}
            className={`flex-row items-center gap-1 border px-3 py-1.5 rounded-full shadow-xs ${
              isSelectionMode
                ? 'bg-primary/10 border-primary/25'
                : 'bg-secondary/80 border-border/40'
            }`}
          >
            <Text className={`text-[11px] font-bold font-sans ${isSelectionMode ? 'text-primary' : 'text-foreground'}`}>
              {isSelectionMode ? t('cancel', 'Cancel') : t('select', 'Select')}
            </Text>
          </TouchableOpacity>
        }
      >
        <View className="flex-1 bg-background">

          {/* Selection Mode Action Bar */}
          {isSelectionMode && (
            <View className="flex-row items-center justify-between px-4 py-2.5 bg-card border-b border-border/40">
              <TouchableOpacity
                onPress={() => {
                  const allIds = filteredItems.map(n => n.id || n._id || '').filter(Boolean);
                  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
                  if (allSelected) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(allIds));
                  }
                }}
                activeOpacity={0.7}
                className="flex-row items-center gap-1.5"
              >
                {(() => {
                  const allIds = filteredItems.map(n => n.id || n._id || '').filter(Boolean);
                  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
                  return (
                    <>
                      <View className={`size-5 rounded-md border items-center justify-center ${allSelected ? 'bg-primary border-primary' : 'bg-background border-border'}`}>
                        {allSelected && <Check size={12} color="white" strokeWidth={3} />}
                      </View>
                      <Text className="text-xs font-bold text-foreground font-sans">
                        {allSelected ? t('deselect_all', 'Deselect All') : t('select_all', 'Select All')}
                      </Text>
                    </>
                  );
                })()}
              </TouchableOpacity>

              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => {
                    if (selectedIds.size === 0) return;
                    const ids = Array.from(selectedIds);
                    ids.forEach(id => markAsRead(id));
                    setSuccessToastMessage(t('notifications_marked_read', `${ids.length} marked as read.`));
                    setTimeout(() => setSuccessToastMessage(null), 3000);
                    setIsSelectionMode(false);
                    setSelectedIds(new Set());
                  }}
                  activeOpacity={0.7}
                  disabled={selectedIds.size === 0}
                  className={`flex-row items-center gap-1 border px-2.5 py-1.5 rounded-full ${
                    selectedIds.size > 0
                      ? 'bg-primary/10 border-primary/25'
                      : 'bg-muted border-border/40 opacity-40'
                  }`}
                >
                  <CheckCheck size={12} color={selectedIds.size > 0 ? "#FF6A00" : "#888"} />
                  <Text className={`text-[10px] font-bold font-sans ${selectedIds.size > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {t('mark_read', 'Read')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    if (selectedIds.size === 0) return;
                    const ids = Array.from(selectedIds);
                    let successCount = 0;
                    for (const id of ids) {
                      try {
                        await deleteNotification(id);
                        successCount++;
                      } catch (error) {
                        console.error("Failed to delete notification", error);
                      }
                    }
                    if (successCount > 0) {
                      setSuccessToastMessage(t('notifications_deleted', `${successCount} notifications deleted.`));
                      setTimeout(() => setSuccessToastMessage(null), 3000);
                    }
                    setIsSelectionMode(false);
                    setSelectedIds(new Set());
                  }}
                  activeOpacity={0.7}
                  disabled={selectedIds.size === 0}
                  className={`flex-row items-center gap-1 border px-2.5 py-1.5 rounded-full ${
                    selectedIds.size > 0
                      ? 'bg-red-500/10 border-red-500/25'
                      : 'bg-muted border-border/40 opacity-40'
                  }`}
                >
                  <Trash2 size={12} color={selectedIds.size > 0 ? "#DC2626" : "#888"} />
                  <Text className={`text-[10px] font-bold font-sans ${selectedIds.size > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {t('delete', 'Delete')} {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {/* Full-Page Paginated List with Infinity Scroll & Pull to Refresh */}
          <PaginatedList<NotificationItemData>
            data={filteredItems}
            renderItem={(item) => renderNotificationCard(item)}
            pagination={{
              currentPage: pagination.currentPage,
              totalPages: pagination.totalPages,
              totalRecords: pagination.totalRecords,
              limit: 15,
            }}
            onLoadMore={handleLoadMore}
            onRefresh={handleRefresh}
            loading={loading}
            refreshing={refreshing}
            ListHeaderComponent={
              !isSelectionMode ? (
                <View className="flex-row items-center gap-2 pt-3 mb-3 pb-1">
                  <TouchableOpacity
                    onPress={() => setActiveTab('all')}
                    className={`px-4 py-1.5 rounded-full border ${
                      getStatusTabStyle('all', activeTab === 'all').containerClass
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        getStatusTabStyle('all', activeTab === 'all').textClass
                      }`}
                    >
                      {t('all', 'All')} ({items.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setActiveTab('unread')}
                    className={`px-4 py-1.5 rounded-full border ${
                      getStatusTabStyle('warning', activeTab === 'unread').containerClass
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        getStatusTabStyle('warning', activeTab === 'unread').textClass
                      }`}
                    >
                      {t('unread', 'Unread')} ({unreadCount})
                    </Text>
                  </TouchableOpacity>

                  {unreadCount > 0 && (
                    <TouchableOpacity
                      onPress={markAllAsRead}
                      activeOpacity={0.7}
                      className="flex-row items-center gap-1 bg-primary/10 border border-primary/25 px-2.5 py-1.5 rounded-full ms-auto"
                    >
                      <CheckCheck size={12} color="#FF6A00" />
                      <Text className="text-[10px] font-bold text-primary font-sans">
                        {t('mark_all_read', 'Read all')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View className="pt-2" />
              )
            }
            contentContainerClassName="px-4 pb-28"
            contentContainerStyle={{ paddingBottom: 110 }}
            emptyIcon="Bell"
            emptyTitle={
              activeTab === 'unread'
                ? t('no_unread_notifications', 'No Unread Notifications')
                : t('no_notifications', 'No Notifications')
            }
            emptySubtitle={
              activeTab === 'unread'
                ? t('caught_up_subtitle', 'You have caught up with all unread notifications!')
                : t('no_notifications_desc', 'Gate alerts, booking updates and broadcasts will appear here.')
            }
          />
        </View>
      </ScreenShell>

      {/* Community Invitation Details Modal with Accept & Reject Actions */}
      <InvitationDetailModal
        visible={isInviteModalVisible}
        onClose={() => {
          setIsInviteModalVisible(false);
          setSelectedInviteNotification(null);
        }}
        notification={selectedInviteNotification}
        onAccept={handleAcceptInvitation}
        onReject={handleRejectInvitation}
      />
    </>
  );
}
