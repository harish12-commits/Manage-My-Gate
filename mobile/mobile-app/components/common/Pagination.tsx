import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { cn } from '../../lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) => {
  return (
    <View className={cn('flex-row items-center justify-center space-x-4', className)}>
      <Pressable
        onPress={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={cn(
          'p-2 rounded-xl border border-border',
          currentPage === 1 ? 'opacity-50 bg-secondary' : 'bg-card active:bg-secondary'
        )}
      >
        <ChevronLeft size={18} className="text-foreground" />
      </Pressable>
      
      <Text className="text-sm font-medium font-sans text-foreground">
        Page {currentPage} of {totalPages}
      </Text>
      
      <Pressable
        onPress={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={cn(
          'p-2 rounded-xl border border-border',
          currentPage === totalPages ? 'opacity-50 bg-secondary' : 'bg-card active:bg-secondary'
        )}
      >
        <ChevronRight size={18} className="text-foreground" />
      </Pressable>
    </View>
  );
};
