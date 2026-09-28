import React, { useState, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Chip } from '@/components/common/Chip';
import { GlobalFilterPanel, FilterCategoryConfig } from '@/components/ui/GlobalFilterPanel';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { DatePicker } from '@/components/common/DatePicker';
import { formatDateString } from '@/components/common/DatePickerModal';
import { Calendar, Building2, CreditCard, CheckCircle2 } from 'lucide-react-native';
import { fetchVillaBlocks } from '@/src/features/villa/services/villaService';
import { useTranslation } from '@/src/utils/i18n';

export interface LedgerFilterValues {
  startDate: string;
  endDate: string;
  datePreset: string;
  block: string;
  paymentMethod: string;
  status?: string;
}

interface LedgerFilterDrawerProps {
  visible: boolean;
  onClose: () => void;
  filters: LedgerFilterValues;
  onApply: (newFilters: LedgerFilterValues) => void;
  onReset: () => void;
}

export const LedgerFilterDrawer: React.FC<LedgerFilterDrawerProps> = ({
  visible,
  onClose,
  filters,
  onApply,
  onReset,
}) => {
  const { t } = useTranslation();

  const datePresets = useMemo(() => [
    { id: 'ALL_TIME', label: t('all_time', 'All Time') },
    { id: 'THIS_MONTH', label: t('this_month', 'This Month') },
    { id: 'LAST_MONTH', label: t('last_month', 'Last Month') },
    { id: 'THIS_QUARTER', label: t('this_quarter', 'This Quarter') },
    { id: 'THIS_FY', label: t('fy_2026_27', 'FY 2026-27') },
    { id: 'CUSTOM', label: t('custom_range', 'Custom Range') },
  ], [t]);

  const paymentMethods = useMemo(() => [
    { id: 'ALL', label: t('all_methods', 'All Methods') },
    { id: 'CASH', label: t('cash', 'Cash') },
    { id: 'BANK_TRANSFER', label: t('bank_transfer', 'Bank Transfer (NEFT/RTGS)') },
    { id: 'UPI', label: t('upi_qr', 'UPI / QR') },
    { id: 'CHEQUE', label: t('cheque', 'Cheque') },
    { id: 'DEMAND_DRAFT', label: t('demand_draft', 'Demand Draft') },
    { id: 'WALLET', label: t('wallet', 'Wallet') },
    { id: 'RAZORPAY', label: t('online_gateway', 'Online / Gateway') },
  ], [t]);

  const [selectedStatus, setSelectedStatus] = useState(filters.status || 'ALL');
  const [datePreset, setDatePreset] = useState(filters.datePreset || 'ALL_TIME');
  const [startDate, setStartDate] = useState(filters.startDate || '');
  const [endDate, setEndDate] = useState(filters.endDate || '');
  const [selectedBlock, setSelectedBlock] = useState(filters.block || 'ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(filters.paymentMethod || 'ALL');
  const [availableBlocks, setAvailableBlocks] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setSelectedStatus(filters.status || 'ALL');
      setDatePreset(filters.datePreset || 'ALL_TIME');
      setStartDate(filters.startDate || '');
      setEndDate(filters.endDate || '');
      setSelectedBlock(filters.block || 'ALL');
      setSelectedPaymentMethod(filters.paymentMethod || 'ALL');

      // Fetch distinct blocks for this community
      fetchVillaBlocks()
        .then((res: any) => {
          const raw = res?.data?.data || res?.data || res || [];
          const blocks = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
          setAvailableBlocks(
            blocks
              .map((b: any) => (typeof b === 'string' ? b : b?.block || b?.blockOrBuilding || b?._id || b?.name || ''))
              .filter((b: string) => Boolean(b) && b !== '[object Object]')
          );
        })
        .catch(() => {});
    }
  }, [visible, filters]);

  const handleSelectPreset = (presetId: string) => {
    setDatePreset(presetId);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (presetId === 'ALL_TIME') {
      setStartDate('');
      setEndDate('');
    } else if (presetId === 'THIS_MONTH') {
      const firstDay = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0);
      setStartDate(formatDateString(firstDay));
      setEndDate(formatDateString(lastDay));
    } else if (presetId === 'LAST_MONTH') {
      const firstDay = new Date(y, m - 1, 1);
      const lastDay = new Date(y, m, 0);
      setStartDate(formatDateString(firstDay));
      setEndDate(formatDateString(lastDay));
    } else if (presetId === 'THIS_QUARTER') {
      const q = Math.floor(m / 3);
      const firstDay = new Date(y, q * 3, 1);
      const lastDay = new Date(y, (q + 1) * 3, 0);
      setStartDate(formatDateString(firstDay));
      setEndDate(formatDateString(lastDay));
    } else if (presetId === 'THIS_FY') {
      const fyStartYear = m >= 3 ? y : y - 1;
      const firstDay = new Date(fyStartYear, 3, 1);
      const lastDay = new Date(fyStartYear + 1, 2, 31);
      setStartDate(formatDateString(firstDay));
      setEndDate(formatDateString(lastDay));
    }
  };

  const handleApply = () => {
    onApply({
      startDate,
      endDate,
      datePreset,
      block: selectedBlock,
      paymentMethod: selectedPaymentMethod,
      status: selectedStatus,
    });
    onClose();
  };

  const handleResetInternal = () => {
    setSelectedStatus('ALL');
    setDatePreset('ALL_TIME');
    setStartDate('');
    setEndDate('');
    setSelectedBlock('ALL');
    setSelectedPaymentMethod('ALL');
    onReset();
    onClose();
  };

  const blockOptions = useMemo(() => {
    const opts = [{ label: t('all_blocks', 'All Blocks'), value: 'ALL' }];
    availableBlocks.forEach((blk) => {
      opts.push({ label: `${t('block', 'Block')} ${blk}`, value: blk });
    });
    return opts;
  }, [availableBlocks, t]);

  const totalActiveCount =
    (selectedStatus !== 'ALL' && selectedStatus !== '' ? 1 : 0) +
    (datePreset !== 'ALL_TIME' || startDate || endDate ? 1 : 0) +
    (selectedBlock !== 'ALL' && selectedBlock !== '' ? 1 : 0) +
    (selectedPaymentMethod !== 'ALL' && selectedPaymentMethod !== '' ? 1 : 0);

  const renderDateSection = () => (
    <View className="gap-3 pt-1">
      {/* Date Preset Chips */}
      <View className="flex-row flex-wrap gap-2">
        {datePresets.map((preset) => (
          <Chip
            key={preset.id}
            label={preset.label}
            selected={datePreset === preset.id}
            onPress={() => handleSelectPreset(preset.id)}
            className="py-1.5 px-3"
          />
        ))}
      </View>

      {/* DatePicker inputs for Start and End Date */}
      {datePreset === 'CUSTOM' || startDate || endDate ? (
        <View className="gap-2.5 pt-2 border-t border-border/40 mt-1">
          <DatePicker
            label={t('start_date_label', 'Start Date')}
            value={startDate ? new Date(`${startDate}T00:00:00`) : null}
            onChange={(d) => {
              setStartDate(formatDateString(d));
              setDatePreset('CUSTOM');
            }}
            placeholder={t('select_start_date', 'Select Start Date')}
          />
          <DatePicker
            label={t('end_date_label', 'End Date')}
            value={endDate ? new Date(`${endDate}T00:00:00`) : null}
            onChange={(d) => {
              setEndDate(formatDateString(d));
              setDatePreset('CUSTOM');
            }}
            placeholder={t('select_end_date', 'Select End Date')}
          />
        </View>
      ) : null}
    </View>
  );

  const renderBlockSection = () => (
    <View className="gap-3 pt-1">
      <DropdownSelect
        options={blockOptions}
        value={selectedBlock}
        onValueChange={setSelectedBlock}
        placeholder={t('select_community_block', 'Select Community Block')}
      />
    </View>
  );

  const categoryConfigs: FilterCategoryConfig[] = useMemo(() => [
    {
      id: 'status',
      label: t('payment_status', 'Payment Status'),
      icon: CheckCircle2,
      type: 'radio',
      options: [
        { id: 'ALL', label: t('all_statuses', 'All Statuses') },
        { id: 'VERIFICATION_PENDING', label: t('status_verification_pending', 'Pending Verification') },
        { id: 'OVERDUE', label: t('status_overdue', 'Overdue') },
        { id: 'UNPAID', label: t('status_unpaid', 'Unpaid') },
        { id: 'PARTIALLY_PAID', label: t('status_partially_paid', 'Partially Paid') },
        { id: 'PAID', label: t('status_paid', 'Paid') },
      ],
      selectedValues: selectedStatus,
      selectedCount: selectedStatus !== 'ALL' && selectedStatus !== '' ? 1 : 0,
      onOptionSelect: (val) => setSelectedStatus(val),
    },
    {
      id: 'date',
      label: t('date_range', 'Date Range'),
      icon: Calendar,
      type: 'custom',
      selectedCount: datePreset !== 'ALL_TIME' || startDate || endDate ? 1 : 0,
      renderCustom: renderDateSection,
    },
    {
      id: 'block',
      label: t('block_building', 'Block / Building'),
      icon: Building2,
      type: 'custom',
      selectedCount: selectedBlock !== 'ALL' && selectedBlock !== '' ? 1 : 0,
      renderCustom: renderBlockSection,
    },
    {
      id: 'paymentMethod',
      label: t('payment_method', 'Payment Method'),
      icon: CreditCard,
      type: 'radio',
      options: paymentMethods,
      selectedValues: selectedPaymentMethod,
      selectedCount: selectedPaymentMethod !== 'ALL' && selectedPaymentMethod !== '' ? 1 : 0,
      onOptionSelect: (val) => setSelectedPaymentMethod(val),
    },
  ], [selectedStatus, datePreset, startDate, endDate, selectedBlock, selectedPaymentMethod, blockOptions, paymentMethods, t]);

  return (
    <GlobalFilterPanel
      visible={visible}
      onClose={onClose}
      title={t('advanced_ledger_filters', 'Advanced Ledger Filters')}
      categories={categoryConfigs}
      onApply={handleApply}
      onClearAll={handleResetInternal}
      totalActiveCount={totalActiveCount}
    />
  );
};

export default LedgerFilterDrawer;
