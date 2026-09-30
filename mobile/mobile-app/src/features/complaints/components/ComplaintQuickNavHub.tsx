import React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import * as LucideIcons from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

export interface QuickNavItem {
  id: string;
  name: string;
  keywords?: string[];
  route: string;
  iconName: string;
  colorBg: string;
  colorIcon: string;
}

export interface ComplaintQuickNavHubProps {
  searchQuery?: string;
  badgeCounts?: any;
  onFeedbackPress?: () => void;
}

export function ComplaintQuickNavHub({ searchQuery = '', onFeedbackPress }: ComplaintQuickNavHubProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const navItems: QuickNavItem[] = [
    {
      id: 'feature_complaints_raise_ticket_name',
      name: 'Raise Ticket',
      keywords: ['raise', 'create', 'new', 'ticket', 'report', 'issue', 'complaint', 'upkeep'],
      route: '/(resident)/complaints/raise-ticket',
      iconName: 'PlusCircle',
      colorBg: 'bg-blue-500/10',
      colorIcon: '#3b82f6',
    },
    {
      id: 'feature_complaints_track_requests_name',
      name: 'My Tickets',
      keywords: ['my', 'tickets', 'track', 'status', 'list', 'history', 'complaints', 'upkeep'],
      route: '/(resident)/complaints/my-tickets',
      iconName: 'Search',
      colorBg: 'bg-amber-500/10',
      colorIcon: '#f59e0b',
    },
    {
      id: 'feature_complaints_complaint_management_name',
      name: 'Management',
      keywords: ['management', 'admin', 'kanban', 'board', 'queue', 'upkeep', 'staff'],
      route: '/(resident)/complaints/manage',
      iconName: 'Kanban',
      colorBg: 'bg-indigo-500/10',
      colorIcon: '#6366f1',
    },
    {
      id: 'staff_vendors',
      name: 'Staff & Vendors',
      keywords: ['staff', 'vendors', 'technician', 'roster', 'contacts', 'directory', 'upkeep', 'maintenance', 'worker', 'crew'],
      route: '/(resident)/complaints/staff',
      iconName: 'Users',
      colorBg: 'bg-emerald-500/10',
      colorIcon: '#10b981',
    },
    {
      id: 'assignee_queue',
      name: 'Assignee Queue',
      keywords: ['assignee', 'queue', 'tasks', 'staff', 'technician', 'work orders', 'assigned'],
      route: '/(resident)/complaints/assignee',
      iconName: 'ClipboardList',
      colorBg: 'bg-purple-500/10',
      colorIcon: '#a855f7',
    },
    {
      id: 'community_issue_reports',
      name: 'Issue Reports',
      keywords: ['issue', 'reports', 'resident', 'bug', 'inquiry', 'report an issue'],
      route: '/(resident)/complaints/issue-reports',
      iconName: 'AlertCircle',
      colorBg: 'bg-rose-500/10',
      colorIcon: '#f43f5e',
    },
  ];

  const filteredItems = navItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const translated = t(item.id, item.name);
    const matchName = item.name.toLowerCase().includes(q) || translated.toLowerCase().includes(q);
    const matchId = item.id.toLowerCase().includes(q);
    const matchKeywords = item.keywords ? item.keywords.some((k) => k.toLowerCase().includes(q)) : false;
    return matchName || matchId || matchKeywords;
  });

  return (
    <View className="mb-8">
      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1 mb-4 px-1">
        {t('complaints_maintenance_features', 'Complaints & Maintenance Features')}
      </Text>

      {filteredItems.length > 0 ? (
        <View className="flex-row flex-wrap justify-start gap-x-[3.5%] gap-y-3">
          {filteredItems.map((item) => {
            const IconComp = (LucideIcons as Record<string, any>)[item.iconName] || LucideIcons.Circle;
            const displayName = t(item.id, item.name);

            return (
              <Pressable
                key={item.id}
                onPress={() => router.navigate(item.route as any)}
                className="w-[31%] bg-card p-3 rounded-2xl border border-border items-center justify-center active:opacity-75 shadow-xs relative"
              >
                <View className={`w-11 h-11 rounded-2xl ${item.colorBg} items-center justify-center mb-2`}>
                  <IconComp size={20} color={item.colorIcon} />
                </View>

                <Text
                  className="text-[11px] font-bold text-foreground text-center"
                  numberOfLines={2}
                >
                  {displayName}
                </Text>
              </Pressable>
            );
          })}

          {onFeedbackPress && (!searchQuery.trim() || 'feedback'.includes(searchQuery.toLowerCase())) ? (
            <Pressable
              onPress={onFeedbackPress}
              className="w-[31%] bg-card p-3 rounded-2xl border border-border items-center justify-center active:opacity-75 shadow-xs relative"
            >
              <View className="w-11 h-11 rounded-2xl bg-rose-500/10 items-center justify-center mb-2">
                <LucideIcons.MessageSquare size={20} color="#f43f5e" />
              </View>

              <Text
                className="text-[11px] font-bold text-foreground text-center"
                numberOfLines={2}
              >
                {t('feedback', 'Feedback')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View className="p-6 bg-card rounded-2xl border border-border items-center justify-center">
          <Text className="text-xs text-muted-foreground">
            {t('no_matching_features', `No feature found for "${searchQuery}"`)}
          </Text>
        </View>
      )}
    </View>
  );
}

export default ComplaintQuickNavHub;
