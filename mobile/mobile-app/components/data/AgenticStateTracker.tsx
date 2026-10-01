import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Activity, CheckCircle, Clock, XCircle } from 'lucide-react-native';
import { cn } from '../../lib/utils';

export type AgentState = 'idle' | 'running' | 'completed' | 'failed';

export interface AgenticStateTrackerProps {
  state: AgentState;
  agentName: string;
  lastActive?: string;
  logs?: string[];
  className?: string;
}

export const AgenticStateTracker = ({
  state,
  agentName,
  lastActive,
  logs = [],
  className,
}: AgenticStateTrackerProps) => {
  const getStateColor = () => {
    switch (state) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-emerald-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-slate-400';
    }
  };

  const StateIcon = () => {
    switch (state) {
      case 'running': return <Activity size={16} className="text-blue-500" />;
      case 'completed': return <CheckCircle size={16} className="text-emerald-500" />;
      case 'failed': return <XCircle size={16} className="text-red-500" />;
      default: return <Clock size={16} className="text-slate-400" />;
    }
  };

  return (
    <View className={cn('rounded-2xl border border-border bg-card p-4 shadow-xs', className)}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View className="me-2.5 p-2 bg-secondary rounded-xl border border-border">
            <StateIcon />
          </View>
          <View>
            <Text className="text-sm font-bold font-sans text-foreground">
              {agentName}
            </Text>
            {lastActive && (
              <Text className="text-xs font-sans text-muted-foreground">
                Last active: {lastActive}
              </Text>
            )}
          </View>
        </View>
        <View className="flex-row items-center rounded-full bg-secondary border border-border px-2.5 py-1">
          <View className={cn('me-1.5 h-2 w-2 rounded-full', getStateColor())} />
          <Text className="text-xs font-semibold font-sans text-foreground capitalize">
            {state}
          </Text>
        </View>
      </View>

      {logs.length > 0 && (
        <View className="rounded-xl bg-black/80 border border-border p-3">
          {logs.map((log, index) => (
            <Text key={index} className="text-xs font-mono text-emerald-400 mb-1">
              &gt; {log}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};
