import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import dayjs from 'dayjs';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Icon } from '@/components/ui/icon';
import { Paperclip, Calendar, User, ChevronRight } from 'lucide-react-native';
import { IssueReportItem } from '../types/issueReport.types';
import { REPORT_TYPES, FEATURE_MODULES } from '../constants/issueReport.constants';

export interface CommunityIssueReportCardProps {
  report: IssueReportItem;
  onPress: () => void;
}

export function CommunityIssueReportCard({ report, onPress }: CommunityIssueReportCardProps) {
  const reportNumber = report.reportNumber || 'NAH-000000';
  const title = report.title || 'Untitled Report';
  const reporterName = report.reporter?.name || report.reporter?.email || 'Resident';
  const featureLabel = report.feature
    ? FEATURE_MODULES[report.feature] || report.feature
    : 'General';
  const hasAttachments = Array.isArray(report.attachments) && report.attachments.length > 0;
  const formattedDate = report.createdAt
    ? dayjs(report.createdAt).format('MMM DD, YYYY • hh:mm A')
    : '—';

  const typeConfig = report.reportType && REPORT_TYPES[report.reportType]
    ? REPORT_TYPES[report.reportType]
    : { label: report.reportType || 'Other', color: 'neutral' as const };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      className="bg-card p-4 rounded-2xl border border-border mb-3 shadow-xs"
    >
      {/* Top Header Row: Report #, Type Badge, and Source Badge */}
      <View className="flex-row items-center justify-between mb-2 gap-2 flex-wrap">
        <View className="flex-row items-center gap-2">
          <Text className="text-xs font-mono font-bold text-primary">{reportNumber}</Text>
          <StatusBadge variant={typeConfig.color} label={typeConfig.label} size="sm" />
        </View>

        <StatusBadge variant="neutral" label="Source: Contact Support" size="sm" />
      </View>

      {/* Main Title */}
      <Text className="text-sm font-bold text-foreground mb-2" numberOfLines={2}>
        {title}
      </Text>

      {/* Sub-info: Feature Module Tag & Attachments */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="bg-muted px-2.5 py-1 rounded-lg">
          <Text className="text-[11px] font-semibold text-muted-foreground">{featureLabel}</Text>
        </View>

        {hasAttachments ? (
          <View className="flex-row items-center gap-1 bg-secondary/20 px-2 py-0.5 rounded-md">
            <Icon as={Paperclip} size={12} className="text-secondary-foreground" />
            <Text className="text-[10px] font-medium text-secondary-foreground">Attachment</Text>
          </View>
        ) : null}
      </View>

      {/* Footer Info: Reporter & Submitted Timestamp */}
      <View className="pt-2 border-t border-border/50 flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5 flex-1 me-2">
          <Icon as={User} size={13} className="text-muted-foreground" />
          <Text className="text-xs font-medium text-muted-foreground truncate" numberOfLines={1}>
            {reporterName}
          </Text>
        </View>

        <View className="flex-row items-center gap-1">
          <Icon as={Calendar} size={12} className="text-muted-foreground" />
          <Text className="text-[11px] text-muted-foreground">{formattedDate}</Text>
          <Icon as={ChevronRight} size={14} className="text-muted-foreground ms-1" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default CommunityIssueReportCard;
