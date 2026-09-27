import React, { useEffect, useMemo, useState } from 'react';
import { GlobalFilterPanel, FilterCategoryConfig } from '@/components/ui/GlobalFilterPanel';
import { Layers, Building2 } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

interface VillaFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  availableStatuses: string[];
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  availableBlocks?: string[];
  selectedBlock?: string;
  onSelectBlock?: (block: string) => void;
  onClearAll: () => void;
}

export const VillaFilterSheet: React.FC<VillaFilterSheetProps> = ({
  visible,
  onClose,
  availableStatuses,
  selectedStatus,
  onSelectStatus,
  availableBlocks = [],
  selectedBlock = '',
  onSelectBlock,
  onClearAll,
}) => {
  const { t } = useTranslation();
  const [draftStatus, setDraftStatus] = useState(selectedStatus);
  const [draftBlock, setDraftBlock] = useState(selectedBlock);

  useEffect(() => {
    if (visible) {
      setDraftStatus(selectedStatus);
      setDraftBlock(selectedBlock);
    }
  }, [visible, selectedStatus, selectedBlock]);

  const totalActiveCount = (draftStatus ? 1 : 0) + (draftBlock ? 1 : 0);

  const handleApply = () => {
    if (draftStatus !== selectedStatus) onSelectStatus(draftStatus);
    if (draftBlock !== selectedBlock) onSelectBlock?.(draftBlock);
    onClose();
  };

  const categoryConfigs: FilterCategoryConfig[] = useMemo(() => {
    const categories: FilterCategoryConfig[] = [
      {
        id: 'status',
        label: t('unit_status', 'Unit Status'),
        icon: Layers,
        type: 'radio',
        options: [
          { id: '', label: t('all_statuses', 'All Statuses') },
          ...availableStatuses.map((st) => ({
            id: st,
            label: t(st, st),
          })),
        ],
        selectedValues: draftStatus,
        selectedCount: draftStatus ? 1 : 0,
        onOptionSelect: setDraftStatus,
      },
    ];

    if (availableBlocks.length > 0 && onSelectBlock) {
      categories.push({
        id: 'block',
        label: t('block_building', 'Block / Building'),
        icon: Building2,
        type: 'radio',
        options: [
          { id: '', label: t('all_blocks', 'All Blocks') },
          ...availableBlocks.map((blk) => ({
            id: blk,
            label: `${t('block', 'Block')} ${blk}`,
          })),
        ],
        selectedValues: draftBlock,
        selectedCount: draftBlock ? 1 : 0,
        onOptionSelect: setDraftBlock,
      });
    }

    return categories;
  }, [availableStatuses, draftStatus, availableBlocks, draftBlock, onSelectBlock, t]);

  return (
    <GlobalFilterPanel
      visible={visible}
      onClose={onClose}
      title={t('filter_units', 'Filter Units')}
      categories={categoryConfigs}
      onApply={handleApply}
      onClearAll={() => {
        setDraftStatus('');
        setDraftBlock('');
        onClearAll();
        onClose();
      }}
      totalActiveCount={totalActiveCount}
    />
  );
};

export default VillaFilterSheet;
