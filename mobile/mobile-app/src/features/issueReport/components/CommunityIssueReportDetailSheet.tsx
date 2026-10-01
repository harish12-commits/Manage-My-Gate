import React, { useState } from 'react';
import { View, ScrollView, Image, TouchableOpacity, Modal } from 'react-native';
import dayjs from 'dayjs';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Icon } from '@/components/ui/icon';
import {
  FileText,
  Paperclip,
  CheckCircle2,
  X,
} from 'lucide-react-native';
import { IssueReportItem } from '../types/issueReport.types';
import { useAttachmentSource } from '../hooks/useAttachmentSource';
import { REPORT_TYPES, FEATURE_MODULES } from '../constants/issueReport.constants';
import { AppLoader } from '@/components/ui/AppLoader';

export interface CommunityIssueReportDetailSheetProps {
  visible: boolean;
  report: IssueReportItem | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
}

function AttachmentImage({ url, className, resizeMode }: { url: string; className: string; resizeMode: 'cover' | 'contain' }) {
  const source = useAttachmentSource(url);
  if (!source) {
    return (
      <View className={`${className} items-center justify-center`}>
        <AppLoader variant="inline" />
      </View>
    );
  }
  return <Image source={source} className={className} resizeMode={resizeMode} />;
}

export function CommunityIssueReportDetailSheet({
  visible,
  report,
  loading = false,
  error = null,
  onClose,
}: CommunityIssueReportDetailSheetProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (!visible) return null;

  const reportNumber = report?.reportNumber || 'NAH-000000';
  const title = report?.title || 'Untitled Issue Report';
  const description = report?.description || 'No description provided.';
  const reporterName = report?.reporter?.name || report?.reporter?.email || 'Resident';
  const reporterEmail = report?.reporter?.email || '';
  const reporterPhone = report?.reporter?.phone || '';
  const featureLabel = report?.feature
    ? FEATURE_MODULES[report.feature] || report.feature
    : 'General';
  const formattedDate = report?.createdAt
    ? dayjs(report.createdAt).format('MMMM DD, YYYY • hh:mm A')
    : '—';

  const typeConfig = report?.reportType && REPORT_TYPES[report.reportType]
    ? REPORT_TYPES[report.reportType]
    : { label: report?.reportType || 'Other', color: 'neutral' as const };

  const hasAttachments = Array.isArray(report?.attachments) && report.attachments.length > 0;

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} title={`Report ${reportNumber}`}>
        <View className="flex-1 bg-background pb-6">
          {error ? (
            <View className="p-4">
              <ErrorBanner message={error} />
            </View>
          ) : loading && !report ? (
            <View className="py-12 items-center justify-center">
              <AppLoader variant="block" />
              <Text className="text-xs text-muted-foreground mt-3 font-medium">
                Loading issue report details...
              </Text>
            </View>
          ) : report ? (
            <ScrollView className="flex-1 px-4 pt-2">
              {/* HEADER BADGES */}
              <View className="flex-row items-center justify-between mb-3 gap-2 flex-wrap">
                <StatusBadge variant={typeConfig.color} label={typeConfig.label} size="md" />
                <StatusBadge variant="neutral" label="Source: Contact Support" size="md" />
              </View>

              {/* TITLE */}
              <Text className="text-lg font-bold text-foreground mb-3">{title}</Text>

              {/* REPORT DETAILS SECTION */}
              <DetailSection title="Report Metadata" iconName="Layers">
                <DetailRow label="Report Number" value={reportNumber} copyable />
                <DetailRow label="Feature Module" value={featureLabel} />
                <DetailRow label="Submitted Date" value={formattedDate} />
              </DetailSection>

              {/* DESCRIPTION SECTION */}
              <View className="bg-card p-4 rounded-2xl border border-border mb-4 shadow-xs">
                <View className="flex-row items-center gap-2 mb-2">
                  <Icon as={FileText} size={16} className="text-primary" />
                  <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Description
                  </Text>
                </View>
                <Text className="text-sm text-foreground leading-relaxed font-sans">{description}</Text>
              </View>

              {/* REPORTER INFORMATION */}
              <DetailSection title="Resident Information" iconName="User">
                <DetailRow label="Name / Identifier" value={reporterName} />
                {reporterEmail ? <DetailRow label="Email Address" value={reporterEmail} copyable /> : null}
                {reporterPhone ? <DetailRow label="Phone Number" value={reporterPhone} copyable /> : null}
              </DetailSection>

              {/* TECHNICAL CONTEXT (If present) */}
              {report.technicalContext ? (
                <DetailSection title="Technical Context" iconName="Smartphone">
                  <DetailRow label="Platform" value={report.technicalContext.platform?.toUpperCase() || 'N/A'} />
                  <DetailRow label="App Version" value={report.technicalContext.appVersion || 'N/A'} />
                  <DetailRow label="Device Model" value={report.technicalContext.deviceModel || 'N/A'} />
                  <DetailRow label="OS Version" value={report.technicalContext.osVersion || 'N/A'} />
                </DetailSection>
              ) : null}

              {/* ATTACHMENTS VIEW */}
              {hasAttachments ? (
                <View className="bg-card p-4 rounded-2xl border border-border mb-4 shadow-xs">
                  <View className="flex-row items-center gap-2 mb-3">
                    <Icon as={Paperclip} size={16} className="text-primary" />
                    <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Attachments & Screenshots
                    </Text>
                  </View>

                  <View className="flex-row flex-wrap gap-3">
                    {report.attachments!.map((attachment, idx) => (
                      <TouchableOpacity
                        key={attachment.url || idx}
                        activeOpacity={0.8}
                        onPress={() => setPreviewImage(attachment.url)}
                        className="w-24 h-24 rounded-xl overflow-hidden border border-border bg-muted items-center justify-center relative"
                      >
                        <AttachmentImage url={attachment.url} className="w-full h-full" resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* READ-ONLY DISCLAIMER */}
              <View className="bg-muted/50 p-3 rounded-xl border border-border/50 items-center justify-center flex-row gap-2 mb-6">
                <Icon as={CheckCircle2} size={14} className="text-muted-foreground" />
                <Text className="text-xs text-muted-foreground text-center font-medium">
                  Read-Only Inspection Mode. Issue reports cannot be altered.
                </Text>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </BottomSheet>

      {/* FULL SCREEN IMAGE PREVIEW MODAL */}
      {previewImage ? (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
          <View className="flex-1 bg-black/90 items-center justify-center relative p-4">
            <TouchableOpacity
              onPress={() => setPreviewImage(null)}
              className="absolute top-12 right-6 p-2 rounded-full bg-white/20 z-10"
            >
              <Icon as={X} size={24} className="text-white" />
            </TouchableOpacity>

            <AttachmentImage url={previewImage} className="w-full h-4/5 rounded-2xl" resizeMode="contain" />
          </View>
        </Modal>
      ) : null}
    </>
  );
}

export default CommunityIssueReportDetailSheet;
