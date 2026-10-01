import React, { useState, useEffect, useMemo } from 'react';
import { View, Modal, TouchableOpacity, Pressable, ScrollView, Dimensions } from 'react-native';
import { Text } from '../ui/text';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { SearchFilterBar } from '../ui/SearchFilterBar';
import CustomiseAvailableZone from './CustomiseAvailableZone';
import { useAuth } from '../../src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser, getDefaultQuickActionsForUser } from '../../src/utils/rbac';
import { useTranslation } from '../../src/utils/i18n';
import {
  ALL_AVAILABLE_FEATURES,
  REAL_APP_FEATURES,
  AppFeatureItem,
} from '../../src/features/dashboard/dashboardCatalog';

export { ALL_AVAILABLE_FEATURES, REAL_APP_FEATURES, AppFeatureItem };

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.85);
const MAX_QUICK_ACTIONS = 7;

interface CustomiseSheetModalProps {
  visible: boolean;
  onClose: () => void;
  activeFeatureIds?: string[];
  availableFeatures?: any[];
  onToggleFeature?: (featureId: string) => void;
  onSave?: (selectedIds: string[]) => void;
}

export const CustomiseSheetModal: React.FC<CustomiseSheetModalProps> = ({
  visible,
  onClose,
  activeFeatureIds,
  availableFeatures,
  onToggleFeature,
  onSave,
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');

  const rawAvailableFeaturesForUser = useMemo(() => {
    return (availableFeatures || ALL_AVAILABLE_FEATURES).filter((item: any) =>
      isFeatureAllowedForUser(item, user)
    );
  }, [availableFeatures, user]);

  const availableFeaturesForUser = useMemo(() => {
    if (!searchQuery) return rawAvailableFeaturesForUser;
    const lowerQ = searchQuery.toLowerCase();
    return rawAvailableFeaturesForUser.filter((f) => 
      f.name.toLowerCase().includes(lowerQ) || (f.subtitle && f.subtitle.toLowerCase().includes(lowerQ))
    );
  }, [rawAvailableFeaturesForUser, searchQuery]);

  const defaultRoleQuickActions = useMemo(() => {
    return getDefaultQuickActionsForUser(user).slice(0, MAX_QUICK_ACTIONS);
  }, [user]);

  // Sanitize incoming IDs to ensure only valid current catalog items allowed for this user are retained.
  const sanitizedActiveIds = useMemo(() => {
    if (!activeFeatureIds || activeFeatureIds.length === 0) {
      return defaultRoleQuickActions;
    }
    const valid = activeFeatureIds.filter((id) => {
      const item = ALL_AVAILABLE_FEATURES.find((f) => f.id === id);
      return item && isFeatureAllowedForUser(item, user);
    }).slice(0, MAX_QUICK_ACTIONS);
    return valid.length > 0 ? valid : defaultRoleQuickActions;
  }, [activeFeatureIds, defaultRoleQuickActions, user]);

  const [selectedIds, setSelectedIds] = useState<string[]>(sanitizedActiveIds);
  // Pull down to dismiss sheet transform
  const sheetTranslateY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setSelectedIds(sanitizedActiveIds);
      sheetTranslateY.value = 0;
    }
  }, [visible, sanitizedActiveIds]);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    } else if (selectedIds.length < MAX_QUICK_ACTIONS) {
      setSelectedIds((prev) => [...prev, id]);
    }
    if (onToggleFeature) onToggleFeature(id);
  };

  const handleSave = () => {
    if (onSave) onSave(selectedIds.slice(0, MAX_QUICK_ACTIONS));
    onClose();
  };

  const handleClose = () => {
    sheetTranslateY.value = 0;
    onClose();
  };

  // Pan gesture on modal header for pull-down to dismiss
  const headerPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onUpdate((e) => {
          if (e.translationY > 0) {
            sheetTranslateY.value = e.translationY;
          }
        })
        .onEnd((e) => {
          if (e.translationY > 120 || e.velocityY > 600) {
            sheetTranslateY.value = withTiming(SHEET_HEIGHT, { duration: 220 }, (finished) => {
              if (finished) {
                runOnJS(onClose)();
              }
            });
          } else {
            sheetTranslateY.value = withSpring(0, { damping: 18, stiffness: 220 });
          }
        }),
    [onClose]
  );

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-black/60 justify-end">
          {/* Backdrop dismiss touchable */}
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={onClose}
          />

          {/* Bottom Sheet Container with guaranteed height */}
          <Animated.View
            style={[
              {
                height: SHEET_HEIGHT,
                backgroundColor: isDark ? '#1C1917' : '#FFFFFF',
              },
              animatedSheetStyle,
            ]}
            className="border-t border-border rounded-t-3xl shadow-2xl overflow-hidden flex-col"
          >
            {/* Keep the drag gesture on the handle only, so the close control remains tappable. */}
            <View style={{ backgroundColor: isDark ? '#1C1917' : '#FFFFFF' }} className="bg-card">
              <GestureDetector gesture={headerPanGesture}>
                <View className="items-center pt-2.5 pb-1">
                  <View className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
                </View>
              </GestureDetector>

              <View className="px-5 pt-3 pb-3 border-b border-border gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[20px] leading-7 font-extrabold text-foreground tracking-tight">
                    {t('customise_quick_actions', 'Customise Quick Actions')}
                  </Text>
                  <Pressable
                    onPress={handleClose}
                    className="size-9 rounded-full bg-secondary/80 items-center justify-center active:bg-secondary border border-border/60"
                    accessibilityRole="button"
                    accessibilityLabel={t('close', 'Close')}
                    hitSlop={12}
                  >
                    <X size={20} className="text-foreground" strokeWidth={2.5} />
                  </Pressable>
                </View>

                {/* Search Bar inside Customise Modal */}
                <SearchFilterBar
                  searchValue={searchQuery}
                  onSearchChange={setSearchQuery}
                  searchPlaceholder={t('search_features', 'Search actions...')}
                  className="px-0 py-0"
                />
              </View>
            </View>

            {/* One grid: starred tiles are selected Quick Actions; all other actions remain selectable here. */}
            <ScrollView
              style={{ flex: 1, backgroundColor: isDark ? '#1C1917' : '#F5F3EF' }}
              contentContainerStyle={{ paddingBottom: 18, backgroundColor: isDark ? '#1C1917' : '#F5F3EF' }}
              showsVerticalScrollIndicator={false}
            >
              <CustomiseAvailableZone
                features={availableFeaturesForUser}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            </ScrollView>

            <View className="flex-row gap-3 border-t border-border bg-card px-4 py-3">
              <TouchableOpacity
                onPress={() => setSelectedIds(defaultRoleQuickActions)}
                className="h-12 flex-1 items-center justify-center rounded-2xl border border-border active:bg-secondary"
                accessibilityRole="button"
                accessibilityLabel={t('reset', 'Reset')}
              >
                <Text className="text-sm font-bold text-foreground">{t('reset', 'Reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                className="h-12 flex-1 items-center justify-center rounded-2xl bg-primary active:bg-primary/90"
                accessibilityRole="button"
                accessibilityLabel={t('save', 'Save')}
              >
                <Text className="text-sm font-bold text-primary-foreground">{t('save', 'Save')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default CustomiseSheetModal;
