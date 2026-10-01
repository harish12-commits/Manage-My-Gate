import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { HelpCircle, Send } from 'lucide-react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/forms/TextInput';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useTranslation } from '@/src/utils/i18n';

import { useReportIssue } from '../hooks/useReportIssue';
import { ReportTypeSelector } from '../components/ReportTypeSelector';
import { ScreenshotUploader } from '../components/ScreenshotUploader';
import { ReportSubmittedView } from '../components/ReportSubmittedView';
import {
  FEATURE_MODULE_OPTIONS,
  ISSUE_REPORT_CONSTRAINTS,
  FeatureModule,
} from '../constants/issueReport.constants';

export const ReportIssueScreen: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();

  const {
    reportType,
    feature,
    title,
    description,
    screenshot,
    setReportType,
    setFeature,
    setTitle,
    setDescription,
    setScreenshot,
    removeScreenshot,
    validationErrors,
    isSubmitting,
    error,
    submittedReport,
    handleSubmit,
    resetForm,
    clearError,
  } = useReportIssue();

  // If report has been successfully submitted, display the confirmation view
  if (submittedReport?.reportNumber) {
    return (
      <ScreenShell
        title={t('report_submitted_header', 'Report Submitted')}
        subtitle={t('report_received_subtitle', 'Confirmation receipt')}
        showBackButton={false}
        scrollable={false}
      >
        <ReportSubmittedView
          reportNumber={submittedReport.reportNumber}
          createdAt={submittedReport.createdAt}
          reportType={reportType || 'OTHER'}
          feature={feature || 'OTHER'}
          title={title}
          onDone={() => {
            resetForm();
            router.back();
          }}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={t('report_an_issue', 'Contact Support')}
      subtitle={t('report_an_issue_subtitle', 'Help us improve Nahom')}
      showBackButton={true}
      onBackPress={() => router.back()}
      scrollable={true}
    >
      <View className="px-4 py-4 gap-5 pb-16">
        {/* 1. Header Explanatory Card */}
        <Card className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <View className="flex-row items-start gap-3">
            <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center shrink-0">
              <Icon as={HelpCircle} size={20} className="text-primary" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-foreground font-sans">
                {t('help_us_improve_title', 'Help us improve Nahom')}
              </Text>
              <Text className="text-xs text-muted-foreground font-sans mt-0.5 leading-relaxed">
                {t(
                  'help_us_improve_body',
                  'Tell us what went wrong or what you would like us to improve. Your feedback goes directly to our technical team.'
                )}
              </Text>
            </View>
          </View>
        </Card>

        {/* 2. Error Banner (if submission failed, preserving form fields) */}
        {error ? (
          <ErrorBanner
            title={t('submission_failed', 'Submission Failed')}
            message={error}
            onDismiss={clearError}
            onRetry={handleSubmit}
          />
        ) : null}

        {/* 3. Issue Type Selector */}
        <ReportTypeSelector
          value={reportType}
          onSelect={setReportType}
          error={validationErrors.reportType}
          disabled={isSubmitting}
        />

        {/* 4. Feature / Module Selector */}
        <DropdownSelect
          label={t('feature_module', 'Feature / Module')}
          required={true}
          placeholder={t('select_feature_placeholder', 'Select affected feature')}
          options={FEATURE_MODULE_OPTIONS}
          value={feature}
          onValueChange={(val) => setFeature(val as FeatureModule)}
          error={validationErrors.feature}
          searchable={false}
        />

        {/* 5. Title Input */}
        <TextInput
          label={t('issue_title', 'Title')}
          required={true}
          placeholder={t('issue_title_placeholder', 'Brief summary of the issue')}
          value={title}
          onChangeText={setTitle}
          maxLength={ISSUE_REPORT_CONSTRAINTS.TITLE_MAX_LENGTH}
          error={validationErrors.title}
          helperText={
            title
              ? `${title.length} / ${ISSUE_REPORT_CONSTRAINTS.TITLE_MAX_LENGTH}`
              : t('title_helper', 'Minimum 3 characters')
          }
          editable={!isSubmitting}
        />

        {/* 6. Description Input */}
        <TextInput
          label={t('issue_description', 'Description')}
          required={true}
          placeholder={t(
            'issue_description_placeholder',
            'Tell us what happened in detail...'
          )}
          multiline={true}
          numberOfLines={5}
          value={description}
          onChangeText={setDescription}
          maxLength={ISSUE_REPORT_CONSTRAINTS.DESCRIPTION_MAX_LENGTH}
          error={validationErrors.description}
          helperText={
            description
              ? `${description.length} / ${ISSUE_REPORT_CONSTRAINTS.DESCRIPTION_MAX_LENGTH}`
              : t('description_helper', 'Minimum 10 characters')
          }
          inputClassName="min-h-[110px] text-top"
          editable={!isSubmitting}
        />

        {/* 7. Screenshot Uploader (Optional) */}
        <ScreenshotUploader
          screenshot={screenshot}
          onSelect={setScreenshot}
          onRemove={removeScreenshot}
          error={validationErrors.screenshot}
          disabled={isSubmitting}
        />

        {/* 8. Submit CTA Button */}
        <View className="pt-2">
          <Button
            variant="default"
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting}
            onPress={handleSubmit}
            leftIcon={Send}
            className="w-full bg-emerald-600 active:bg-emerald-700 border-0"
            accessibilityLabel={t('submit_report', 'Submit Report')}
          >
            {isSubmitting
              ? t('submitting_report', 'Submitting...')
              : t('submit_report', 'Submit Report')}
          </Button>
        </View>
      </View>
    </ScreenShell>
  );
};

export default ReportIssueScreen;
