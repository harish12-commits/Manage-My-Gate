import React from 'react';
import { Download } from 'lucide-react-native';
import { ButtonProps } from '../ui/button';
import { HeaderActionButton } from '../ui/HeaderActionButton';
import { useTranslation } from '@/src/utils/i18n';

export interface ExportReportButtonProps {
  onExport: () => void;
  loading?: boolean;
  className?: string;
  variant?: ButtonProps['variant'];
}

export const ExportReportButton = ({
  onExport,
  loading = false,
  className,
  variant: _variant = 'outline',
}: ExportReportButtonProps) => {
  const { t } = useTranslation();

  return (
    <HeaderActionButton
      icon={Download}
      label={t('export_csv', 'Export CSV')}
      onPress={onExport}
      loading={loading}
      className={className}
      accessibilityLabel={t('export_csv', 'Export CSV')}
    />
  );
};
