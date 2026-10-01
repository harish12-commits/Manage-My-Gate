import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Terminal, Copy } from 'lucide-react-native';
import { cn } from '../../lib/utils';

export interface DiagnosticLogViewerProps {
  logs: string[];
  onCopyLogs?: () => void;
  className?: string;
}

export const DiagnosticLogViewer = ({
  logs,
  onCopyLogs,
  className,
}: DiagnosticLogViewerProps) => {
  return (
    <View className={cn('rounded-xl overflow-hidden bg-slate-900', className)}>
      <View className="flex-row items-center justify-between border-b border-slate-800 p-3">
        <View className="flex-row items-center">
          <Terminal size={16} className="text-slate-400 mr-2" />
          <Text className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Diagnostic Logs
          </Text>
        </View>
        {onCopyLogs && (
          <Pressable onPress={onCopyLogs} className="p-1">
            <Copy size={16} className="text-slate-400" />
          </Pressable>
        )}
      </View>
      
      <ScrollView className="max-h-48 p-4">
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <Text key={index} className="text-xs font-mono text-green-400 mb-1 leading-relaxed">
              {log}
            </Text>
          ))
        ) : (
          <Text className="text-xs font-mono text-slate-500 italic">No logs recorded.</Text>
        )}
      </ScrollView>
    </View>
  );
};
