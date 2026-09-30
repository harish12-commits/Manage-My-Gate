import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Plus, Settings2, Trash2 } from 'lucide-react-native';
import { cn } from '../../../lib/utils';
import { DropdownSelect } from '../../../components/forms/DropdownSelect';
import { TextInput } from '../../../components/forms/TextInput';

export interface TriggerNode {
  id: string;
  type: 'event' | 'condition' | 'action';
  config: Record<string, any>;
}

export interface TriggerNodeBuilderProps {
  nodes: TriggerNode[];
  onChange: (nodes: TriggerNode[]) => void;
  className?: string;
}

export const TriggerNodeBuilder = ({ nodes, onChange, className }: TriggerNodeBuilderProps) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const addNode = (type: TriggerNode['type']) => {
    const newNode: TriggerNode = {
      id: Math.random().toString(36).substring(7),
      type,
      config: {}
    };
    onChange([...nodes, newNode]);
  };

  const removeNode = (id: string) => {
    onChange(nodes.filter(n => n.id !== id));
    if (selectedNode === id) setSelectedNode(null);
  };

  return (
    <View className={cn('flex-1', className)}>
      <View className="mb-4 flex-row justify-between items-center">
        <Text className="text-lg font-bold text-slate-900 dark:text-white">Workflow Flow</Text>
        <View className="flex-row gap-2">
          <Pressable onPress={() => addNode('event')} className="bg-primary/10 px-3 py-1.5 rounded-md">
            <Text className="text-xs font-semibold text-primary">+ Event</Text>
          </Pressable>
          <Pressable onPress={() => addNode('action')} className="bg-blue-100 px-3 py-1.5 rounded-md dark:bg-blue-900/30">
            <Text className="text-xs font-semibold text-blue-700 dark:text-blue-400">+ Action</Text>
          </Pressable>
        </View>
      </View>

      <View className="space-y-4">
        {nodes.map((node, index) => (
          <View key={node.id} className="relative">
            {index > 0 && (
              <View className="absolute -top-4 left-6 h-4 w-0.5 bg-slate-300 dark:bg-slate-700" />
            )}
            <Pressable
              onPress={() => setSelectedNode(node.id)}
              className={cn(
                'flex-row items-center justify-between rounded-xl border p-4',
                selectedNode === node.id
                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
                node.type === 'event' ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-blue-500'
              )}
            >
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {node.type}
                </Text>
                <Text className="text-base font-semibold text-slate-900 dark:text-white mt-1">
                  {node.config.name || `New ${node.type}`}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Pressable onPress={() => setSelectedNode(node.id)} className="p-2">
                  <Settings2 size={16} className="text-slate-400" />
                </Pressable>
                <Pressable onPress={() => removeNode(node.id)} className="p-2">
                  <Trash2 size={16} className="text-red-400" />
                </Pressable>
              </View>
            </Pressable>
          </View>
        ))}
        {nodes.length === 0 && (
          <View className="items-center py-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <Text className="text-sm text-slate-500">No nodes defined.</Text>
          </View>
        )}
      </View>
    </View>
  );
};
