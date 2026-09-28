/**
 * Published sessions of an event space booked by session (e.g. Morning 08:00–13:00,
 * Evening 16:00–22:00), each with its own price. Residents can only book these windows.
 */

import React from 'react';
import { View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/forms/TextInput';
import { useTranslation } from '@/src/utils/i18n';
import type { EventSessionForm } from '../../utils/mapAmenityCreationPayloadStrategy';

export interface EventSessionsEditorProps {
  sessions: EventSessionForm[];
  onChange: (sessions: EventSessionForm[]) => void;
  error?: string;
}

export function EventSessionsEditor({ sessions, onChange, error }: EventSessionsEditorProps) {
  const { t } = useTranslation();
  const update = (id: string, patch: Partial<EventSessionForm>) =>
    onChange(sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <View className="gap-3">
      {sessions.map((s, idx) => (
        <View key={s.id} testID={`event-session-${idx}`} className="bg-muted/40 p-3 rounded-2xl border border-border/60 gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold text-foreground">
              {t('amenity_create_session_n', 'Session {n}', { n: idx + 1 })}
            </Text>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => onChange(sessions.filter((x) => x.id !== s.id))}
              accessibilityLabel={t('amenity_create_session_remove', 'Remove session')}
            >
              <Trash2 size={16} className="text-destructive" />
            </Button>
          </View>
          <TextInput
            label={t('amenity_create_session_name', 'Name')}
            placeholder={t('amenity_create_session_name_ph', 'e.g. Evening')}
            value={s.name}
            onChangeText={(name) => update(s.id, { name })}
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <TextInput
                label={t('amenity_create_session_start', 'Starts (HH:MM)')}
                placeholder="16:00"
                value={s.startTime}
                onChangeText={(startTime) => update(s.id, { startTime })}
              />
            </View>
            <View className="flex-1">
              <TextInput
                label={t('amenity_create_session_end', 'Ends (HH:MM)')}
                placeholder="22:00"
                value={s.endTime}
                onChangeText={(endTime) => update(s.id, { endTime })}
              />
            </View>
          </View>
          <TextInput
            label={t('amenity_create_session_price', 'Price (₹, blank = base rate)')}
            placeholder="0"
            keyboardType="numeric"
            value={String(s.price ?? '')}
            onChangeText={(price) => update(s.id, { price })}
          />
        </View>
      ))}

      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}

      <Button
        variant="outline"
        onPress={() =>
          onChange([...sessions, { id: `session-${Date.now()}`, name: '', startTime: '', endTime: '', price: '' }])
        }
        className="flex-row items-center justify-center gap-2"
        testID="event-session-add"
      >
        <Plus size={16} className="text-foreground" />
        <Text className="text-sm font-semibold">{t('amenity_create_session_add', 'Add session')}</Text>
      </Button>
    </View>
  );
}

export default EventSessionsEditor;
