import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react-native';
import { cn } from '../../lib/utils';

export interface AuditEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'pending' | 'error';
  actor?: string;
}

export interface AuditTrailTimelineProps {
  events: AuditEvent[];
  className?: string;
}

export const AuditTrailTimeline = ({
  events,
  className,
}: AuditTrailTimelineProps) => {
  const getStatusIcon = (status: AuditEvent['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-500 bg-card rounded-full" />;
      case 'pending':
        return <Clock size={16} className="text-amber-500 bg-card rounded-full" />;
      case 'error':
        return <AlertCircle size={16} className="text-destructive bg-card rounded-full" />;
    }
  };

  return (
    <View className={cn('ps-2', className)}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        
        return (
          <View key={event.id} className="flex-row">
            {/* Timeline Line & Icon */}
            <View className="items-center me-3.5">
              <View className="z-10 mt-1 h-6 w-6 items-center justify-center rounded-full bg-secondary border border-border">
                {getStatusIcon(event.status)}
              </View>
              {!isLast && (
                <View className="w-[2px] flex-1 bg-border mt-1 mb-1" />
              )}
            </View>
            
            {/* Content */}
            <View className={cn('flex-1 pb-6', isLast && 'pb-0')}>
              <Text className="text-[14px] font-semibold font-sans text-foreground">
                {event.title}
              </Text>
              <Text className="mt-0.5 text-xs font-sans text-muted-foreground">
                {event.description}
              </Text>
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-[11px] text-muted-foreground/80 font-mono">
                  {event.timestamp}
                </Text>
                {event.actor && (
                  <Text className="text-[11px] font-medium font-sans text-muted-foreground">
                    By {event.actor}
                  </Text>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};
