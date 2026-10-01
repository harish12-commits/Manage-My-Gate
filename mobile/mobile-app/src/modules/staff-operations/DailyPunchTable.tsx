import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '../../../lib/utils';

export interface PunchRecord {
  id: string;
  staffId: string;
  date: string;
  punchIn: string;
  punchOut: string;
  totalHours: number;
}

export interface DailyPunchTableProps {
  records: PunchRecord[];
  className?: string;
}

export const DailyPunchTable = ({ records, className }: DailyPunchTableProps) => {
  return (
    <View className={cn('rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900', className)}>
      <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header */}
          <View className="flex-row border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
            <View className="w-20"><Text className="text-xs font-semibold text-slate-500 uppercase">DATE</Text></View>
            <View className="w-24"><Text className="text-xs font-semibold text-slate-500 uppercase">STAFF_ID</Text></View>
            <View className="w-20"><Text className="text-xs font-semibold text-slate-500 uppercase">PUNCH_IN</Text></View>
            <View className="w-24"><Text className="text-xs font-semibold text-slate-500 uppercase">PUNCH_OUT</Text></View>
            <View className="w-24"><Text className="text-xs font-semibold text-right text-slate-500 uppercase">HOURS</Text></View>
          </View>
          
          {/* Rows */}
          {records.map((record) => (
            <View key={record.id} className="flex-row border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <View className="w-20"><Text className="text-sm font-mono text-slate-900 dark:text-slate-100">{record.date}</Text></View>
              <View className="w-24"><Text className="text-sm font-mono text-slate-900 dark:text-slate-100">{record.staffId}</Text></View>
              <View className="w-20"><Text className="text-sm font-mono text-slate-900 dark:text-slate-100">{record.punchIn}</Text></View>
              <View className="w-24"><Text className="text-sm font-mono text-slate-900 dark:text-slate-100">{record.punchOut || '-'}</Text></View>
              <View className="w-24"><Text className="text-sm font-mono font-bold text-right text-slate-900 dark:text-slate-100">{record.totalHours}</Text></View>
            </View>
          ))}
          
          {records.length === 0 && (
            <View className="p-4 items-center">
              <Text className="text-sm text-slate-500">0 records</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
