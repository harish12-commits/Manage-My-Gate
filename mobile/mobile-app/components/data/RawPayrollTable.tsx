import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '../../lib/utils';

export interface PayrollRow {
  id: string;
  employeeId: string;
  baseSalary: number;
  deductions: number;
  bonus: number;
  netPay: number;
}

export interface RawPayrollTableProps {
  data: PayrollRow[];
  className?: string;
}

export const RawPayrollTable = ({ data, className }: RawPayrollTableProps) => {
  return (
    <View className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header */}
          <View className="flex-row border-b border-border bg-muted px-4 py-3">
            <View className="w-24"><Text className="text-xs font-semibold text-muted-foreground uppercase">ID</Text></View>
            <View className="w-32"><Text className="text-xs font-semibold text-muted-foreground uppercase">EMP_ID</Text></View>
            <View className="w-24"><Text className="text-xs font-semibold text-end text-muted-foreground uppercase">BASE</Text></View>
            <View className="w-24"><Text className="text-xs font-semibold text-end text-muted-foreground uppercase">DEDUCT</Text></View>
            <View className="w-24"><Text className="text-xs font-semibold text-end text-muted-foreground uppercase">BONUS</Text></View>
            <View className="w-32"><Text className="text-xs font-semibold text-end text-muted-foreground uppercase">NET</Text></View>
          </View>
          
          {/* Rows */}
          {data.map((row) => (
            <View key={row.id} className="flex-row border-b border-border px-4 py-3">
              <View className="w-24"><Text className="text-sm font-mono text-foreground">{row.id}</Text></View>
              <View className="w-32"><Text className="text-sm font-mono text-foreground">{row.employeeId}</Text></View>
              <View className="w-24"><Text className="text-sm font-mono text-end text-foreground">{row.baseSalary}</Text></View>
              <View className="w-24"><Text className="text-sm font-mono text-end text-foreground">{row.deductions}</Text></View>
              <View className="w-24"><Text className="text-sm font-mono text-end text-foreground">{row.bonus}</Text></View>
              <View className="w-32"><Text className="text-sm font-mono font-bold text-end text-foreground">{row.netPay}</Text></View>
            </View>
          ))}
          {data.length === 0 && (
            <View className="p-4 items-center">
              <Text className="text-sm text-muted-foreground">0</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
