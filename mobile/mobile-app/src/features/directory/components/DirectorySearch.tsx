import React from 'react';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';

export interface DirectorySearchProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export const DirectorySearch = ({
  value,
  onChangeText,
  placeholder = 'Search by name, unit, phone, or role...',
}: DirectorySearchProps) => {
  return (
    <SearchFilterBar
      searchValue={value}
      onSearchChange={onChangeText}
      searchPlaceholder={placeholder}
      className="px-0 py-0"
    />
  );
};

export default DirectorySearch;
