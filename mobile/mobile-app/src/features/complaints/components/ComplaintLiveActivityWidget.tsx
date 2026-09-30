import React, { useState } from 'react';
import { View, Pressable, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Wrench, ArrowRight, AlertTriangle, X, Calendar, MapPin, Bell } from 'lucide-react-native';
import { Complaint } from '../types';
import { ComplaintDetailSheet } from './ComplaintDetailSheet';

export interface MaintenanceNotice {
  id: string;
  title: string;
  message: string;
  date: string;
  variant?: 'warning' | 'danger' | 'info';
}

export interface ComplaintLiveActivityWidgetProps {
  complaints?: Complaint[];
  maintenanceNotices?: MaintenanceNotice[];
  searchQuery?: string;
}

export function ComplaintLiveActivityWidget({ complaints = [], maintenanceNotices = [], searchQuery = '' }: ComplaintLiveActivityWidgetProps) {
  const router = useRouter();
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<MaintenanceNotice | null>(null);

  const q = searchQuery.toLowerCase().trim();

  // Filter complaints by searchQuery if present
  const filteredComplaints = complaints.filter((item) => {
    if (!q) return true;
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.complaintNumber && item.complaintNumber.toLowerCase().includes(q)) ||
      (item.status && item.status.toLowerCase().includes(q))
    );
  });

  // Filter maintenance notices by searchQuery if present
  const filteredNotices = maintenanceNotices.filter((notice) => {
    if (!q) return true;
    return (
      (notice.title && notice.title.toLowerCase().includes(q)) ||
      (notice.message && notice.message.toLowerCase().includes(q))
    );
  });

  // Take the 3 most relevant recent tickets
  const recentComplaints = filteredComplaints.slice(0, 3);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Closed':
      case 'Completed':
        return 'success';
      case 'Work Completed':
      case 'Waiting For Resident Confirmation':
        return 'warning';
      case 'In Progress':
      case 'Assigned':
      case 'Accepted':
        return 'info';
      case 'Escalated':
      case 'Rejected':
      case 'Cancelled':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  return (
    <View className="mb-8">
      {/* Header Row */}
      <View className="flex-row items-center justify-between mb-4 px-1">
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-emerald-500 me-2 animate-pulse" />
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Live Ticket & Activity Feed
          </Text>
        </View>
        <Pressable
          onPress={() => router.navigate('/(resident)/complaints/my-tickets' as any)}
          className="flex-row items-center active:opacity-70"
        >
          <Text className="text-xs font-bold text-primary me-1">View All</Text>
          <ArrowRight size={14} className="text-primary" />
        </Pressable>
      </View>

      {/* Maintenance Notices Banner Cards */}
      {filteredNotices.length > 0 ? (
        <View className="mb-4 gap-2.5">
          {filteredNotices.slice(0, 3).map((notice) => (
            <Pressable
              key={notice.id}
              onPress={() => setSelectedNotice(notice)}
              className={`p-3.5 rounded-2xl border flex-row items-start active:opacity-80 ${
                notice.variant === 'danger'
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : notice.variant === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-blue-500/10 border-blue-500/30'
              }`}
            >
              <View className="p-2 rounded-xl bg-background me-3 mt-0.5 shadow-xs">
                <AlertTriangle
                  size={18}
                  color={
                    notice.variant === 'danger'
                      ? '#f43f5e'
                      : notice.variant === 'warning'
                      ? '#f59e0b'
                      : '#3b82f6'
                  }
                />
              </View>
              <View className="flex-1">
                <View className="flex-row items-start justify-between mb-1 gap-2">
                  <Text className="text-xs font-extrabold text-foreground flex-1 leading-snug">
                    {notice.title}
                  </Text>
                  <Text className="text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                    {notice.date}
                  </Text>
                </View>
                <Text className="text-[11px] text-muted-foreground leading-normal">
                  {notice.message}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Active Complaints Feed List */}
      {recentComplaints.length > 0 ? (
        <View className="gap-y-2.5">
          {recentComplaints.map((item) => {
            const variant = getStatusBadgeVariant(item.status);
            const dateStr = item.createdAt
              ? new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recent';

            return (
              <Pressable
                key={item._id}
                onPress={() => setSelectedComplaint(item)}
                className="bg-card p-3.5 rounded-2xl border border-border/80 shadow-xs flex-row items-center justify-between active:opacity-75"
              >
                <View className="flex-row items-center flex-1 me-3">
                  <View className="w-10 h-10 rounded-2xl bg-primary/10 items-center justify-center me-3">
                    <Wrench size={18} className="text-primary" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center mb-0.5 gap-2 flex-wrap">
                      <Text className="text-xs font-extrabold text-foreground">
                        #{item.complaintNumber || item._id.slice(-6)}
                      </Text>
                      <StatusBadge label={item.status} variant={variant as any} />
                    </View>
                    <Text className="text-[11px] font-semibold text-muted-foreground">
                      {item.title} • {item.category || 'General'}
                    </Text>
                    <Text className="text-[10px] text-muted-foreground/80 mt-0.5">
                      {dateStr}
                    </Text>
                  </View>
                </View>
                <ArrowRight size={16} className="text-muted-foreground/60" />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View className="bg-card p-4 rounded-2xl border border-border items-center">
          <Text className="text-xs font-semibold text-muted-foreground">
            No recent activity or active tickets reported.
          </Text>
        </View>
      )}

      {/* Complaint Detail Sheet Modal */}
      {selectedComplaint ? (
        <ComplaintDetailSheet
          visible={!!selectedComplaint}
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
        />
      ) : null}

      {/* Notice Detail Sheet Modal */}
      {selectedNotice ? (
        <Modal
          visible={!!selectedNotice}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedNotice(null)}
        >
          <View className="flex-1 bg-black/60 justify-center p-4">
            <View className="bg-card border border-border rounded-3xl p-5 shadow-2xl gap-3">
              <View className="flex-row items-center justify-between pb-3 border-b border-border">
                <View className="flex-row items-center gap-2 flex-1 me-2">
                  <View className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Icon as={Bell} size={20} className="text-amber-500" />
                  </View>
                  <Text className="text-sm font-bold text-foreground flex-1">
                    Maintenance & Activity Notice
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedNotice(null)}
                  className="p-2 rounded-full bg-muted"
                  activeOpacity={0.7}
                >
                  <Icon as={X} size={18} className="text-foreground" />
                </TouchableOpacity>
              </View>

              <ScrollView className="max-h-[350px]" showsVerticalScrollIndicator={false}>
                <View className="gap-3 py-1">
                  <Text className="text-base font-extrabold text-foreground leading-snug">
                    {selectedNotice.title}
                  </Text>

                  <View className="flex-row items-center gap-2">
                    <StatusBadge
                      label={
                        selectedNotice.variant === 'danger'
                          ? 'Critical Alert'
                          : selectedNotice.variant === 'warning'
                          ? 'Scheduled Maintenance'
                          : 'Community Advisory'
                      }
                      variant={
                        selectedNotice.variant === 'danger'
                          ? 'danger'
                          : selectedNotice.variant === 'warning'
                          ? 'warning'
                          : 'info'
                      }
                    />
                    <View className="flex-row items-center me-1">
                      <Icon as={Calendar} size={12} className="text-muted-foreground me-1" />
                      <Text className="text-xs text-muted-foreground font-medium">
                        {selectedNotice.date}
                      </Text>
                    </View>
                  </View>

                  <View className="bg-muted/40 p-3.5 rounded-2xl border border-border/60">
                    <Text className="text-xs text-foreground leading-relaxed">
                      {selectedNotice.message}
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity
                onPress={() => setSelectedNotice(null)}
                className="bg-primary py-3 rounded-2xl items-center mt-2 active:opacity-80"
              >
                <Text className="text-xs font-bold text-white">Close Notice</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

export default ComplaintLiveActivityWidget;
