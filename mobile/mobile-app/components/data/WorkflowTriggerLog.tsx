import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Zap, ArrowRight } from 'lucide-react-native';
import { cn } from '../../lib/utils';

export interface WorkflowTriggerEvent {
  id: string;
  timestamp: string;
  triggerSource: string;
  targetNode: string;
  payloadSize: number;
  status: 'success' | 'dropped' | 'pending';
}

export interface WorkflowTriggerLogProps {
  events: WorkflowTriggerEvent[];
  className?: string;
}

export const WorkflowTriggerLog = ({ events, className }: WorkflowTriggerLogProps) => {
  return (
    <View className={cn('rounded-xl border border-border bg-card', className)}>
      <View className="flex-row items-center border-b border-border p-4">
        <Zap size={18} className="me-2 text-primary" />
        <Text className="text-base font-bold text-foreground">
          Trigger Logs
        </Text>
      </View>
      
      <ScrollView className="max-h-64">
        {events.map((event, index) => (
          <View 
            key={event.id}
            className={cn(
              'flex-row items-center p-3',
              index !== events.length - 1 && 'border-b border-border/50'
            )}
          >
            <View className="me-3 flex-1">
              <View className="flex-row items-center mb-1">
                <Text className="text-xs font-bold text-foreground">
                  {event.triggerSource}
                </Text>
                <ArrowRight size={12} className="mx-2 text-muted-foreground" />
                <Text className="text-xs font-bold text-foreground">
                  {event.targetNode}
                </Text>
              </View>
              <Text className="text-[10px] text-muted-foreground font-mono">
                {event.timestamp} • {event.payloadSize} bytes
              </Text>
            </View>
            <View className={cn(
              'rounded px-2 py-1',
              event.status === 'success' ? 'bg-status-success-light' :
              event.status === 'dropped' ? 'bg-status-danger-light' :
              'bg-status-warning-light'
            )}>
              <Text className={cn(
                'text-[10px] font-bold uppercase tracking-wider',
                event.status === 'success' ? 'text-status-success-foreground' :
                event.status === 'dropped' ? 'text-status-danger-foreground' :
                'text-status-warning-foreground'
              )}>
                {event.status}
              </Text>
            </View>
          </View>
        ))}
        
        {events.length === 0 && (
          <View className="p-6 items-center">
            <Text className="text-sm text-muted-foreground">No triggers recorded yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
