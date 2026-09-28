import apiClient from '../../../services/apiClient';

export interface NotificationItemData {
  _id?: string;
  id?: string;
  title: string;
  body: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' | string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  readAt?: string;
  orgId?: string;
  recipientId?: string;
  metadata?: Record<string, any>;
}

export interface GetNotificationsResponse {
  notifications: NotificationItemData[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    unreadRecords: number;
  };
}

export const notificationService = {
  async getNotifications(page = 1, limit = 10): Promise<GetNotificationsResponse> {
    const response = await apiClient.get('/notifications', {
      params: { page, limit },
    });
    const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
    const innerData = body?.data || body;

    const notifications: NotificationItemData[] = Array.isArray(innerData)
      ? innerData
      : (Array.isArray(innerData?.notifications) ? innerData.notifications : []);

    const pagination = innerData?.pagination || {
      currentPage: page,
      totalPages: 1,
      totalRecords: notifications.length,
      unreadRecords: notifications.filter((n) => !n.isRead).length,
    };

    return {
      notifications,
      pagination,
    };
  },

  async markAsRead(id: string): Promise<NotificationItemData> {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
    const innerData = body?.data || body;
    return innerData as NotificationItemData;
  },

  async markAllAsRead(): Promise<{ matchedCount: number; modifiedCount: number }> {
    const response = await apiClient.patch('/notifications/read-all');
    const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
    const innerData = body?.data || body;
    return innerData;
  },

  async deleteNotification(id: string): Promise<any> {
    const response = await apiClient.delete(`/notifications/${id}`);
    const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
    const innerData = body?.data || body;
    return innerData;
  },

  async deleteAllNotifications(): Promise<{ deletedCount: number }> {
    try {
      const response = await apiClient.delete('/notifications/all');
      const body = response && (response as any).success !== undefined ? response : (response as any)?.data;
      return (body?.data || body) as { deletedCount: number };
    } catch (error: any) {
      // Compatibility for an app connected to an API deployment that has not
      // yet received the bulk endpoint. The existing ownership-scoped delete
      // endpoint still clears every notification, safely in small batches.
      const status = error?.response?.status;
      if (status !== 404 && status !== 405) throw error;

      let deletedCount = 0;
      let safetyCounter = 0;
      while (safetyCounter++ < 100) {
        const page = await this.getNotifications(1, 100);
        const ids = page.notifications
          .map((notification) => notification.id || notification._id)
          .filter((id): id is string => Boolean(id));
        if (ids.length === 0) break;

        for (let index = 0; index < ids.length; index += 10) {
          const batch = ids.slice(index, index + 10);
          await Promise.all(batch.map((id) => this.deleteNotification(id)));
          deletedCount += batch.length;
        }
      }
      return { deletedCount };
    }
  },
};

export default notificationService;
