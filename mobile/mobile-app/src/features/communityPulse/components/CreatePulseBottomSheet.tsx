import React, { useState, useEffect } from 'react';
import { View, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Edit3, Sparkles, Check, X, Clock, Eye } from 'lucide-react-native';
import { PulseCategory, PulseItem } from '../types/communityPulseTypes';

export interface CreatePulseBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string, emoji?: string, category?: PulseCategory, contextText?: string) => void;
  initialPulse?: PulseItem | null;
}

export interface PresetOption {
  id: string;
  emoji: string;
  text: string;
  category: PulseCategory;
  placeholder: string;
  suggestions: string[];
}

export const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'feeling_good',
    emoji: '😊',
    text: 'Feeling good',
    category: 'general',
    placeholder: 'Having a great day 😊',
    suggestions: ['Having a great day', 'Blessed', 'Good energy'],
  },
  {
    id: 'coffee_time',
    emoji: '☕',
    text: 'Coffee time',
    category: 'general',
    placeholder: 'Anyone at the clubhouse?',
    suggestions: ['Gazebo', 'Clubhouse', 'Now'],
  },
  {
    id: 'badminton',
    emoji: '🏸',
    text: 'Anyone playing badminton?',
    category: 'up_for',
    placeholder: 'Anyone joining around 7 PM?',
    suggestions: ['Tonight', '7 PM', 'Court 1'],
  },
  {
    id: 'going_walk',
    emoji: '🚶',
    text: 'Going for a walk',
    category: 'general',
    placeholder: 'Heading out around 6 PM',
    suggestions: ['Morning', 'Evening', 'Garden'],
  },
  {
    id: 'gym',
    emoji: '🏋️',
    text: 'At the gym',
    category: 'general',
    placeholder: 'Working out for an hour',
    suggestions: ['Gym area', 'Cardio session', 'Leg day'],
  },
  {
    id: 'movie_night',
    emoji: '🎬',
    text: 'Movie night',
    category: 'up_for',
    placeholder: 'Thinking of watching a movie tonight',
    suggestions: ['Clubhouse hall', '8 PM', 'Sci-fi'],
  },
  {
    id: 'gardening',
    emoji: '🌱',
    text: 'Gardening',
    category: 'general',
    placeholder: 'Working near Block B',
    suggestions: ['Block B garden', 'Potting plants', 'Morning'],
  },
  {
    id: 'walking_pet',
    emoji: '🐶',
    text: 'Walking my pet',
    category: 'general',
    placeholder: 'Around central lawn',
    suggestions: ['Central lawn', 'Main park', 'Dog park'],
  },
  {
    id: 'just_hi',
    emoji: '👋',
    text: 'Just saying hi',
    category: 'general',
    placeholder: 'Wishing everyone a peaceful day',
    suggestions: ['Have a great day', 'Weekend vibes', 'Hello neighbors'],
  },
  {
    id: 'looking_plumber',
    emoji: '🔧',
    text: 'Looking for a plumber',
    category: 'looking_for',
    placeholder: 'Available this evening...',
    suggestions: ['Today', 'This evening', 'Urgent'],
  },
];

export const CreatePulseBottomSheet = ({
  visible,
  onClose,
  onSubmit,
  initialPulse,
}: CreatePulseBottomSheetProps) => {
  const [mode, setMode] = useState<'presets' | 'custom'>('presets');
  const [selectedPreset, setSelectedPreset] = useState<PresetOption | null>(null);
  const [contextText, setContextText] = useState('');
  const [customText, setCustomText] = useState('');
  const [customCategory, setCustomCategory] = useState<PulseCategory>('general');
  const [postedSuccess, setPostedSuccess] = useState(false);

  // Preselect active pulse for "Change Pulse" experience
  useEffect(() => {
    if (visible) {
      setPostedSuccess(false);
      if (initialPulse) {
        const matchingPreset = PRESET_OPTIONS.find((p) => p.text === initialPulse.text);
        if (matchingPreset) {
          setMode('presets');
          setSelectedPreset(matchingPreset);
          setContextText(initialPulse.contextText || '');
        } else {
          setMode('custom');
          setCustomText(initialPulse.text);
          setCustomCategory(initialPulse.category);
        }
      } else {
        setSelectedPreset(null);
        setContextText('');
        setCustomText('');
      }
    }
  }, [visible, initialPulse]);

  const handleSelectPreset = (preset: PresetOption) => {
    if (selectedPreset?.id === preset.id) {
      // Toggle off if tapped again
      setSelectedPreset(null);
      setContextText('');
    } else {
      setSelectedPreset(preset);
    }
  };

  const handleAddSuggestion = (chip: string) => {
    if (contextText.includes(chip)) return;
    const nextText = contextText ? `${contextText} • ${chip}` : chip;
    if (nextText.length <= 60) {
      setContextText(nextText);
    }
  };

  const handleClearSelection = () => {
    setSelectedPreset(null);
    setContextText('');
  };

  const handlePost = () => {
    if (mode === 'presets') {
      if (!selectedPreset) {
        Alert.alert('Selection Required', 'Please select a pulse preset option.');
        return;
      }
      setPostedSuccess(true);
      setTimeout(() => {
        onSubmit(
          selectedPreset.text,
          selectedPreset.emoji,
          selectedPreset.category,
          contextText.trim() || undefined
        );
        onClose();
      }, 700);
    } else {
      const trimmed = customText.trim();
      if (!trimmed) {
        Alert.alert('Validation Error', 'Please enter your custom pulse message.');
        return;
      }
      setPostedSuccess(true);
      setTimeout(() => {
        onSubmit(trimmed, '💬', customCategory, undefined);
        setCustomText('');
        onClose();
      }, 700);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="What's happening?">
      <View className="gap-4 pb-4">
        {postedSuccess ? (
          <View className="items-center justify-center py-8 gap-3">
            <View className="h-14 w-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500 items-center justify-center shadow-xs">
              <Check size={28} className="text-emerald-500" />
            </View>
            <Text className="text-base font-bold text-foreground">✓ You're live for 24 hours!</Text>
            <Text className="text-xs text-muted-foreground text-center px-4">
              Your neighbors will see your status on their Community Pulse feed.
            </Text>
          </View>
        ) : (
          <>
            {/* Mode Switcher */}
            <View className="flex-row bg-muted/40 border border-border p-1 rounded-xl gap-1">
              <Pressable
                onPress={() => setMode('presets')}
                className={`flex-1 flex-row items-center justify-center py-2 rounded-lg gap-1.5 ${
                  mode === 'presets' ? 'bg-card border border-border shadow-xs' : 'bg-transparent'
                }`}
              >
                <Sparkles
                  size={14}
                  className={mode === 'presets' ? 'text-primary' : 'text-muted-foreground'}
                />
                <Text
                  className={`text-xs ${
                    mode === 'presets' ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
                  }`}
                >
                  Quick Presets
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMode('custom')}
                className={`flex-1 flex-row items-center justify-center py-2 rounded-lg gap-1.5 ${
                  mode === 'custom' ? 'bg-card border border-border shadow-xs' : 'bg-transparent'
                }`}
              >
                <Edit3
                  size={14}
                  className={mode === 'custom' ? 'text-primary' : 'text-muted-foreground'}
                />
                <Text
                  className={`text-xs ${
                    mode === 'custom' ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
                  }`}
                >
                  Write Custom (80 chars)
                </Text>
              </Pressable>
            </View>

            {mode === 'presets' ? (
              <View className="flex-1">
                <View className="gap-3 pt-1">
                  {/* Presets Chips Grid */}
                  <View className="flex-row flex-wrap gap-2">
                    {PRESET_OPTIONS.map((item) => {
                      const isSelected = selectedPreset?.id === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => handleSelectPreset(item)}
                          className={`flex-row items-center gap-2 px-3.5 py-2.5 rounded-2xl border transition-all ${
                            isSelected
                              ? 'bg-primary/10 border-primary shadow-xs'
                              : 'bg-card border-border active:bg-muted/40 shadow-xs'
                          }`}
                        >
                          {isSelected ? (
                            <View className="h-4 w-4 rounded-full bg-primary items-center justify-center me-0.5">
                              <Check size={10} className="text-primary-foreground" />
                            </View>
                          ) : (
                            <Text className="text-base">{item.emoji}</Text>
                          )}
                          <Text
                            className={`text-xs ${
                              isSelected ? 'font-bold text-primary' : 'font-medium text-foreground'
                            }`}
                          >
                            {item.text}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Revealed Optional Context Area when a preset is selected */}
                  {selectedPreset ? (
                    <View className="bg-muted/20 border border-border rounded-2xl p-3.5 gap-3 mt-1 shadow-xs">
                      {/* Selected Header with Remove button */}
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2 flex-1 me-2">
                          <Text className="text-base">{selectedPreset.emoji}</Text>
                          <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                            {selectedPreset.text}
                          </Text>
                        </View>
                        <Pressable
                          onPress={handleClearSelection}
                          className="px-2 py-1 bg-muted/60 rounded-lg border border-border flex-row items-center gap-1 active:opacity-70"
                        >
                          <X size={12} className="text-muted-foreground" />
                          <Text className="text-[10px] font-semibold text-muted-foreground">Clear</Text>
                        </Pressable>
                      </View>

                      {/* Optional Context Field */}
                      <View className="gap-1">
                        <Text className="text-xs font-semibold text-muted-foreground">
                          Add a little more detail (Optional)
                        </Text>
                        <Input
                          value={contextText}
                          onChangeText={setContextText}
                          maxLength={60}
                          placeholder={selectedPreset.placeholder}
                          className="h-10 bg-card border-border text-foreground text-xs rounded-xl"
                        />
                        <View className="flex-row justify-between items-center px-1 pt-0.5">
                          <Text className="text-[10px] text-muted-foreground">Short details (max 60 chars)</Text>
                          <Text
                            className={`text-[10px] font-mono ${
                              contextText.length > 50 ? 'text-amber-500 font-bold' : 'text-muted-foreground'
                            }`}
                          >
                            {contextText.length}/60
                          </Text>
                        </View>
                      </View>

                      {/* Quick Context Suggestion Chips */}
                      {selectedPreset.suggestions.length > 0 ? (
                        <View className="gap-1">
                          <Text className="text-[11px] font-medium text-muted-foreground">
                            Quick suggestions:
                          </Text>
                          <View className="flex-row flex-wrap gap-1.5">
                            {selectedPreset.suggestions.map((chip, idx) => (
                              <Pressable
                                key={idx}
                                onPress={() => handleAddSuggestion(chip)}
                                className="px-2.5 py-1 rounded-xl bg-card border border-border active:bg-primary/10"
                              >
                                <Text className="text-[11px] font-medium text-foreground">
                                  + {chip}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      ) : null}

                      {/* Compact Preview Box */}
                      <View className="bg-card border border-border/80 rounded-xl p-2.5 gap-1 mt-0.5">
                        <View className="flex-row items-center gap-1.5">
                          <Eye size={12} className="text-primary" />
                          <Text className="text-[10px] font-bold text-primary uppercase">
                            Live Preview
                          </Text>
                        </View>
                        <Text className="text-xs font-bold text-foreground">
                          {selectedPreset.emoji} {selectedPreset.text}
                        </Text>
                        {contextText.trim() ? (
                          <Text className="text-xs text-muted-foreground font-medium">
                            {contextText.trim()}
                          </Text>
                        ) : null}
                        <View className="flex-row items-center gap-1 pt-0.5">
                          <Clock size={10} className="text-muted-foreground" />
                          <Text className="text-[10px] font-mono text-muted-foreground">
                            Expires in 24 hours
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : (
              <View className="gap-3 pt-1">
                {/* Category Switcher for Custom Mode */}
                <View className="flex-row gap-2">
                  {(['general', 'up_for', 'looking_for'] as PulseCategory[]).map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setCustomCategory(cat)}
                      className={`flex-1 py-2 px-2 rounded-xl border items-center ${
                        customCategory === cat ? 'bg-primary/10 border-primary' : 'bg-card border-border'
                      }`}
                    >
                      <Text
                        className={`text-[11px] ${
                          customCategory === cat ? 'font-bold text-primary' : 'font-medium text-muted-foreground'
                        }`}
                      >
                        {cat === 'general' ? 'General' : cat === 'up_for' ? "I'm Up For" : 'Looking For'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Custom Input with 80 character limit */}
                <View className="gap-1">
                  <Input
                    value={customText}
                    onChangeText={setCustomText}
                    maxLength={80}
                    placeholder="Share what's happening around you..."
                    multiline
                    numberOfLines={3}
                    className="bg-muted/20 border-border text-foreground min-h-[90px] p-3 text-sm rounded-2xl"
                  />
                  <View className="flex-row justify-between items-center px-1">
                    <Text className="text-[11px] text-muted-foreground">Expires in 24 hours</Text>
                    <Text
                      className={`text-[11px] font-mono ${
                        customText.length > 70 ? 'text-amber-500 font-bold' : 'text-muted-foreground'
                      }`}
                    >
                      {customText.length}/80
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Dynamic CTA Button */}
            <Button
              onPress={handlePost}
              disabled={mode === 'presets' ? !selectedPreset : !customText.trim()}
              leftIcon={Send}
              className={`h-12 rounded-xl mt-2 ${
                (mode === 'presets' ? selectedPreset : customText.trim())
                  ? 'bg-primary'
                  : 'bg-muted/60 opacity-60'
              }`}
            >
              {(mode === 'presets' ? selectedPreset : customText.trim())
                ? 'Post Pulse'
                : 'Select a Pulse'}
            </Button>
          </>
        )}
      </View>
    </BottomSheet>
  );
};

export default CreatePulseBottomSheet;
