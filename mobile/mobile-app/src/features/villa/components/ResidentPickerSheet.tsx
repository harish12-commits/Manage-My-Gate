/**
 * Picks one resident of the active community (searchable by name, villa or phone).
 * Used by staff acting for a resident, e.g. booking an amenity on their behalf.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { ListCard } from '@/components/ui/ListCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useTranslation } from '@/src/utils/i18n';
import { useVillaResidentOptions } from '../hooks/useVillaResidentOptions';

export interface PickedResident {
  id: string;
  name: string;
  villaId: string;
  villaName: string;
}

export interface ResidentPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (resident: PickedResident) => void;
  title?: string;
}

/** Rows shown at once; a search narrows the rest. */
const MAX_ROWS = 50;

export function ResidentPickerSheet({ visible, onClose, onSelect, title }: ResidentPickerSheetProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { options, loading } = useVillaResidentOptions(visible);

  useEffect(() => {
    if (!visible) setSearch('');
  }, [visible]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = options.flatMap((villa) =>
      villa.residents.map((r) => ({ ...r, villaId: villa.id, villaName: villa.name }))
    );
    return term
      ? all.filter((r) => [r.name, r.villaName, r.phone || ''].some((v) => v.toLowerCase().includes(term)))
      : all;
  }, [options, search]);

  if (!visible) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title || t('resident_picker_title', 'Choose a resident')}>
      <View testID="resident-picker-sheet" className="gap-3 pb-4">
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('resident_picker_search', 'Search name, villa or phone')}
          variant="bordered"
        />
        <View className="gap-2 pb-2">
          {rows.slice(0, MAX_ROWS).map((r) => (
            <ListCard
              key={`${r.villaId}-${r.id}`}
              testID={`resident-option-${r.id}`}
              title={r.name}
              subtitle={[r.villaName, r.type, r.phone].filter(Boolean).join(' · ')}
              leftIcon="User"
              showChevron
              onPress={() => onSelect({ id: r.id, name: r.name, villaId: r.villaId, villaName: r.villaName })}
            />
          ))}
          {rows.length > MAX_ROWS ? (
            <Text variant="muted" className="text-xs text-center py-2">
              {t('resident_picker_more', 'Showing {shown} of {total}. Search to narrow the list.', { shown: MAX_ROWS, total: rows.length })}
            </Text>
          ) : null}
          {!loading && rows.length === 0 ? (
            <EmptyState
              title={t('resident_picker_empty', 'No residents found')}
              description={t('resident_picker_empty_sub', 'Try another name or villa number.')}
            />
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

export default ResidentPickerSheet;
