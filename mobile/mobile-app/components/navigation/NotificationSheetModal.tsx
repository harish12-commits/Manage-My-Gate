import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  QrCode,
  CreditCard,
  AlertCircle,
  BellRing,
  Search,
  Info,
  ChevronRight,
} from 'lucide-react-native';
import { useNotifications } from '@/src/features/notification/hooks/useNotifications';
import { NotificationItemData } from '@/src/features/notification/services/notificationService';
import { mapActionUrlToMobileRoute } from '@/src/features/notification/utils/notificationNavigation';
import { getStatusTabStyle } from '@/components/ui/statusTabColors';
import { useTranslation } from '@/src/utils/i18n';
import { AppLoader } from '@/components/ui/AppLoader';

interface NotificationSheetModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationSheetModal: React.FC<NotificationSheetModalProps> = ({
  visible,
  onClose,
}) => {
  const router = useRouter();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  const {
    items,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Filter items based on active tab
  const filteredItems = React.useMemo(() => {
    if (activeTab === 'unread') {
      return items.filter((item) => !item.isRead);
    }
    return items;
  }, [items, activeTab]);

  const handleNotificationPress = (notification: NotificationItemData) => {
    const id = notification.id || notification._id;
    if (id && !notification.isRead) {
      markAsRead(id);
    }
    onClose();
    const route = mapActionUrlToMobileRoute(notification.actionUrl, notification.type, notification);
    router.push(route as any);
  };

  const getNotificationIcon = (type?: string) => {
    switch (type?.toUpperCase()) {
      case 'VISITOR':
        return <QrCode size={18} color="#03A9F4" />;
      case 'BILLING':
      case 'FINANCIAL':
        return <CreditCard size={18} color="#10b981" />;
      case 'COMPLAINT':
      case 'WARNING':
      case 'ERROR':
        return <AlertCircle size={18} color="#f43f5e" />;
      case 'NOTICE':
      case 'COMMUNITY':
        return <BellRing size={18} color="#14b8a6" />;
      case 'AMENITY':
        return <Search size={18} color="#6366f1" />;
      default:
        return <Info size={18} color="#3b82f6" />;
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-card border-t border-border rounded-t-3xl max-h-[85%] min-h-[50%] shadow-2xl overflow-hidden flex-col">
          {/* Header Bar */}
          <View className="px-5 py-4 border-b border-border/80 flex-row items-center justify-between bg-card">
            <View className="flex-row items-center gap-2">
              <View className="bg-primary/15 p-2 rounded-xl border border-primary/25">
                <Bell size={18} className="text-primary" />
              </View>
              <Text className="text-base font-extrabold text-foreground">{t('notifications', 'Notifications')}</Text>
              {unreadCount > 0 && (
                <View className="bg-rose-500 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-white">{unreadCount} {t('new', 'New')}</Text>
                </View>
              )}
            </View>

            <View className="flex-row items-center gap-2">
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={markAllAsRead}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-1 bg-secondary px-2.5 py-1.5 rounded-full border border-border/70"
                >
                  <CheckCheck size={13} className="text-primary" />
                  <Text className="text-[10px] font-bold text-primary">{t('read_all', 'Read all')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.7}
                className="h-11 w-11 items-center justify-center rounded-full bg-secondary border border-border/60 active:bg-muted"
                accessibilityRole="button"
                accessibilityLabel={t('close', 'Close')}
              >
                <X size={16} className="text-muted-foreground" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Tabs (All / Unread) */}
          <View className="flex-row px-5 py-2.5 border-b border-border/70 bg-secondary/30 gap-2">
            <TouchableOpacity
              onPress={() => setActiveTab('all')}
              className={`px-4 py-1.5 rounded-full border ${getStatusTabStyle('all', activeTab === 'all').containerClass}`}
            >
              <Text
                className={`text-xs ${getStatusTabStyle('all', activeTab === 'all').textClass}`}
              >
                {t('all', 'All')} ({items.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('unread')}
              className={`px-4 py-1.5 rounded-full border ${getStatusTabStyle('warning', activeTab === 'unread').containerClass}`}
            >
              <Text
                className={`text-xs ${getStatusTabStyle('warning', activeTab === 'unread').textClass}`}
              >
                {t('unread', 'Unread')} ({unreadCount})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Notifications Scroll List */}
          <ScrollView className="flex-1 px-4 py-2" showsVerticalScrollIndicator={false}>
            {loading && items.length === 0 ? (
              <View className="py-12 items-center justify-center">
                <AppLoader variant="inline" />
                <Text className="text-xs text-muted-foreground mt-2">{t('loading_notifications', 'Loading notifications...')}</Text>
              </View>
            ) : filteredItems.length > 0 ? (
              <View className="gap-2.5 pb-8">
                {filteredItems.map((notification) => {
                  const notifId = notification.id || notification._id || Math.random().toString();
                  return (
                    <TouchableOpacity
                      key={notifId}
                      onPress={() => handleNotificationPress(notification)}
                      activeOpacity={0.8}
                      className={`p-3.5 rounded-2xl border flex-row items-start gap-3 shadow-xs ${
                        !notification.isRead
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-card border-border/80'
                      }`}
                    >
                      {/* Unread Indicator Dot */}
                      {!notification.isRead && (
                        <View className="size-2 rounded-full bg-primary absolute top-3 right-3" />
                      )}

                      {/* Notification Type Icon Wrapper */}
                      <View className="p-2.5 rounded-xl bg-secondary border border-border/60 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </View>

                      {/* Content Section */}
                      <View className="flex-1 pr-4">
                        <View className="flex-row items-center justify-between">
                          <Text
                            className={`text-xs font-extrabold ${
                              !notification.isRead ? 'text-foreground font-black' : 'text-foreground/80'
                            }`}
                            numberOfLines={1}
                          >
                            {notification.title || t('system_notification', 'System Notification')}
                          </Text>
                          <Text className="text-[10px] text-muted-foreground font-medium">
                            {formatTimeAgo(notification.createdAt)}
                          </Text>
                        </View>

                        <Text
                          className="text-[11px] text-muted-foreground mt-1 leading-snug"
                          numberOfLines={2}
                        >
                          {notification.body || ''}
                        </Text>

                        {/* Direct Link Tag if actionUrl exists */}
                        {notification.actionUrl && (
                          <View className="flex-row items-center gap-0.5 mt-2">
                            <Text className="text-[10px] font-bold text-primary">{t('view_details', 'View details')}</Text>
                            <ChevronRight size={10} className="text-primary" />
                          </View>
                        )}
                      </View>

                      {/* Delete Action Button */}
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          deleteNotification(notifId);
                        }}
                        activeOpacity={0.7}
                        className="p-1 self-center"
                      >
                        <Trash2 size={14} className="text-muted-foreground" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View className="py-16 items-center justify-center gap-2">
                <View className="size-12 rounded-full bg-muted items-center justify-center">
                  <Bell size={24} color="#a1a1aa" />
                </View>
                <Text className="text-sm font-bold text-foreground">{t('no_notifications', 'No notifications')}</Text>
                <Text className="text-xs text-muted-foreground text-center px-6">
                  {activeTab === 'unread'
                    ? t('all_caught_up', 'You have caught up with all unread notifications!')
                    : t('no_notifications_available', 'No notifications available at this time.')}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default NotificationSheetModal;
