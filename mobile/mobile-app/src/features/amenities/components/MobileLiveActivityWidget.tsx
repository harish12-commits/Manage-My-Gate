import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '@/src/store/store';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ListCard } from '@/components/ui/ListCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { QrCode, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { useSecurityLogs } from '../hooks/useSecurityLogs';
import { SecurityLogDetailModal } from './SecurityLogDetailModal';
import { FullActivityLogsModal } from './FullActivityLogsModal';

export function MobileLiveActivityWidget() {
  const router = useRouter();
  const { logs } = useSecurityLogs();
  const { adminBookings, myBookings, dashboardStats } = useSelector(
    (state: RootState) => state.amenityBookings
  );
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [isFullLogsOpen, setIsFullLogsOpen] = useState(false);

  // Combine real-time security logs, master admin bookings, and personal resident bookings with deduplication
  const seenIds = new Set<string>();
  const uniqueRawList: any[] = [];

  for (const item of [
    ...(logs || []),
    ...(adminBookings || []),
    ...(myBookings || []),
    ...(dashboardStats?.recentScans || dashboardStats?.recentActivities || []),
  ]) {
    if (!item) continue;
    const itemId = String(item.id || item._id || item.bookingId || '');
    if (itemId) {
      if (seenIds.has(itemId)) continue;
      seenIds.add(itemId);
    }
    uniqueRawList.push(item);
  }

  const fallbackList = [
    {
      id: '1',
      key: 'fallback-1',
      residentName: 'Rahul Sharma',
      unitInfo: 'Villa 102',
      amenityName: 'Swimming Pool',
      timeStr: '10:00 AM - 11:00 AM',
      statusLabel: 'CHECKED-IN',
      variant: 'success' as const,
      rawLog: {
        _id: '1',
        residentName: 'Rahul Sharma (Villa 102)',
        amenityName: 'Swimming Pool',
        guardName: 'Gate Security System',
        bookingReference: 'BK-APP-8842',
        scanType: 'Entry',
        status: 'Success',
        reason: 'QR Pass scanned and verified successfully at Pool Gate',
        remarks: 'Slot: 10:00 AM - 11:00 AM',
        scanTime: new Date().toISOString(),
      },
    },
    {
      id: '2',
      key: 'fallback-2',
      residentName: 'Ananya Roy',
      unitInfo: 'Flat 404-B',
      amenityName: 'Tennis Court #1',
      timeStr: '02:00 PM - 03:00 PM',
      statusLabel: 'CONFIRMED',
      variant: 'info' as const,
      rawLog: {
        _id: '2',
        residentName: 'Ananya Roy (Flat 404-B)',
        amenityName: 'Tennis Court #1',
        guardName: 'Automated Booking System',
        bookingReference: 'BK-APP-9104',
        scanType: 'Booking Confirmed',
        status: 'Confirmed',
        reason: 'Slot reserved via Resident App with Wallet Payment',
        remarks: 'Slot: 02:00 PM - 03:00 PM',
        scanTime: new Date(Date.now() - 30 * 60000).toISOString(),
      },
    },
    {
      id: '3',
      key: 'fallback-3',
      residentName: 'Vikram Seth',
      unitInfo: 'Villa 45',
      amenityName: 'Gym Fitness Center',
      timeStr: '06:00 PM - 07:00 PM',
      statusLabel: 'EXPIRED',
      variant: 'neutral' as const,
      rawLog: {
        _id: '3',
        residentName: 'Vikram Seth (Villa 45)',
        amenityName: 'Gym Fitness Center',
        guardName: 'Gate Security System',
        bookingReference: 'BK-APP-7712',
        scanType: 'QR Expired',
        status: 'Expired',
        reason: 'QR pass expired due to unutilized slot time window',
        remarks: 'Slot: 06:00 PM - 07:00 PM',
        scanTime: new Date(Date.now() - 120 * 60000).toISOString(),
      },
    },
  ];

  const activeLogs = uniqueRawList.length > 0
    ? uniqueRawList.slice(0, 3).map((log: any, idx: number) => {
        const id = log.id || log._id || log.bookingId || `log-${idx}`;
        const key = `${id}-${idx}`;
        const residentName = log.residentName || log.userName || log.user?.name || log.userId?.name || 'Resident';
        const unitInfo = log.unitInfo || log.unit || log.user?.unit || log.user?.villaNumber || log.villaNumber || log.flatNumber || 'Unit';
        const amenityName = log.amenityName || log.amenity?.name || log.amenityId?.name || 'Facility';
        const bookingRef = log.bookingReference || log.bookingId || log._id || `BK-LOG-${idx + 101}`;
        const guardName = log.guardName || log.reviewedBy?.name || 'Gate Security System';

        let timeStr = log.timeAgo || log.scannedAt || log.bookingDate || log.date || 'Just now';
        if (log.startTime && log.endTime) {
          timeStr = `${log.startTime} - ${log.endTime}`;
        }

        const rawStatus = String(log.status || log.action || log.scanType || 'CONFIRMED').toUpperCase();
        let statusLabel = 'CONFIRMED';
        let variant: 'success' | 'info' | 'warning' | 'danger' | 'neutral' = 'info';

        if (rawStatus === 'CHECKED_IN' || rawStatus === 'CHECKED-IN' || rawStatus === 'CHECK_IN' || rawStatus === 'SUCCESS' || rawStatus === 'ENTRY') {
          statusLabel = 'CHECKED-IN';
          variant = 'success';
        } else if (rawStatus === 'CONFIRMED' || rawStatus === 'APPROVED' || rawStatus === 'PAID') {
          statusLabel = 'CONFIRMED';
          variant = 'info';
        } else if (rawStatus === 'PENDING') {
          statusLabel = 'PENDING';
          variant = 'warning';
        } else if (rawStatus === 'EXPIRED' || rawStatus === 'EXIT') {
          statusLabel = rawStatus === 'EXIT' ? 'EXIT' : 'EXPIRED';
          variant = 'neutral';
        } else if (rawStatus === 'CANCELLED' || rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'DENIED') {
          statusLabel = rawStatus === 'DENIED' ? 'DENIED' : 'CANCELLED';
          variant = 'danger';
        }

        const rawLog = {
          _id: String(id),
          residentName: `${residentName} (${unitInfo})`,
          residentPhoto: log.residentPhoto || log.user?.avatar || null,
          amenityName,
          guardName,
          bookingId: String(id),
          bookingReference: String(bookingRef),
          scanType: log.scanType || (statusLabel === 'CHECKED-IN' ? 'Entry' : statusLabel === 'EXIT' ? 'Exit' : statusLabel),
          status: log.status || statusLabel,
          reason: log.reason || log.remarks || log.cancellationReason || `Activity logged for ${amenityName}`,
          remarks: log.remarks || `Time Window: ${timeStr}`,
          scanTime: log.scanTime || log.createdAt || log.updatedAt || new Date().toISOString(),
        };

        return {
          id,
          key,
          residentName,
          unitInfo,
          amenityName,
          timeStr,
          statusLabel,
          variant,
          rawLog,
        };
      })
    : fallbackList;

  const logsForModal = uniqueRawList.length > 0 ? uniqueRawList : fallbackList;

  return (
    <View className="mb-6">
      <SectionHeader
        title="Recent Activity"
        actionLabel="View All"
        onAction={() => router.navigate('/(resident)/amenities/security-logs' as any)}
        className="px-0 bg-transparent dark:bg-transparent"
      />
      {activeLogs.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No Recent Activity"
          description="Facility entry scans and bookings will appear here."
          actionLabel="View Logs"
          onAction={() => router.navigate('/(resident)/amenities/security-logs' as any)}
        />
      ) : (
        <View className="bg-card p-4 rounded-2xl border border-border/70 shadow-xs">
          <View className="gap-2.5 mb-2">
            {activeLogs.map((item: any, idx: number) => (
              <ListCard
                key={item.key || `${item.id}-${idx}`}
                title={`${item.residentName} (${item.unitInfo})`}
                subtitle={`${item.amenityName} • ${item.timeStr}`}
                leftIcon="QrCode"
                status={{
                  label: item.statusLabel,
                  variant: item.variant,
                }}
                onPress={() => setSelectedLog(item.rawLog)}
                variant="card"
                className="mb-0 bg-muted/30 dark:bg-muted/20 border-border/50"
              />
            ))}
          </View>

          <Pressable
            onPress={() => setIsFullLogsOpen(true)}
            className="flex-row items-center justify-center gap-2 pt-3 border-t border-border/50 active:opacity-75"
          >
            <Text className="text-xs font-bold text-primary">View Full Activity Logs</Text>
            <ArrowRight size={14} className="text-primary" />
          </Pressable>
        </View>
      )}

      {/* Full Activity Logs Feed Bottom Sheet */}
      <FullActivityLogsModal
        visible={isFullLogsOpen}
        onClose={() => setIsFullLogsOpen(false)}
        logs={logsForModal}
        onSelectLog={(log) => setSelectedLog(log)}
      />

      {/* Log Detail Modal */}
      <SecurityLogDetailModal
        visible={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        log={selectedLog}
      />
    </View>
  );
}

export default MobileLiveActivityWidget;

