import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '../../../components/ui/button';
import { User, Clock, Check, X } from 'lucide-react-native';
import { cn } from '../../../lib/utils';

export interface WalkInApprovalCardProps {
  visitorName: string;
  purpose: string;
  arrivalTime: string;
  onApprove: () => void;
  onReject: () => void;
  className?: string;
}

export const WalkInApprovalCard = ({
  visitorName,
  purpose,
  arrivalTime,
  onApprove,
  onReject,
  className,
}: WalkInApprovalCardProps) => {
  return (
    <View className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900', className)}>
      <View className="mb-4 flex-row items-start justify-between">
        <View className="flex-row items-center flex-1">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <User size={24} className="text-slate-400" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-lg font-bold text-slate-900 dark:text-white" numberOfLines={1}>
              {visitorName}
            </Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400" numberOfLines={1}>
              {purpose}
            </Text>
          </View>
        </View>
      </View>
      
      <View className="mb-5 flex-row items-center rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
        <Clock size={14} className="text-slate-400" />
        <Text className="ml-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          Arrived at {arrivalTime}
        </Text>
      </View>
      
      <View className="flex-row items-center gap-3">
        <Button 
          variant="outline" 
          className="flex-1 border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20" 
          onPress={onReject}
        >
          <X size={18} className="mr-2 text-red-600 dark:text-red-400" />
          <Text className="font-semibold text-red-600 dark:text-red-400">Deny</Text>
        </Button>
        <Button 
          className="flex-1 bg-primary" 
          onPress={onApprove}
        >
          <Check size={18} className="mr-2 text-white" />
          <Text className="font-semibold text-white">Approve</Text>
        </Button>
      </View>
    </View>
  );
};
