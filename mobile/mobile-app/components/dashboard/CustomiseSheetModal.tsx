import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Modal, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Text } from '../ui/text';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Sparkles, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import CustomiseDeckZone from './CustomiseDeckZone';
import CustomiseAvailableZone, { AvailableFeatureCardItem } from './CustomiseAvailableZone';
import FeatureIcon from '../ui/FeatureIcon';
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
  const { t, tFeatureName, language } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const availableFeaturesForUser = useMemo(() => {
    return (availableFeatures || ALL_AVAILABLE_FEATURES).filter((item: any) =>
      isFeatureAllowedForUser(item, user)
    );
  }, [availableFeatures, user]);

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
  const [deckHeight, setDeckHeight] = useState(190);

  // Drag & drop floating state
  const [draggingFeature, setDraggingFeature] = useState<AvailableFeatureCardItem | null>(null);
  const [isOverDeck, setIsOverDeck] = useState(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

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

  const handleReorder = (fromIndex: number, toIndex: number) => {
    setSelectedIds((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, removed);
      return copy;
    });
  };

  const handleSave = () => {
    if (onSave) onSave(selectedIds.slice(0, MAX_QUICK_ACTIONS));
    onClose();
  };

  // Drag handlers from available cards
  const handleDragStart = (feature: AvailableFeatureCardItem, absX: number, absY: number) => {
    dragX.value = absX - 38;
    dragY.value = absY - 38;
    setDraggingFeature(feature);
  };

  const handleDragMove = (absX: number, absY: number) => {
    dragX.value = absX - 38;
    dragY.value = absY - 38;

    // Deck is pinned at top of the bottom sheet
    const sheetTop = SCREEN_HEIGHT - SHEET_HEIGHT;
    const deckZoneThreshold = sheetTop + 54 + deckHeight + 40;
    setIsOverDeck(absY > 0 && absY < deckZoneThreshold);
  };

  const handleDragEnd = (feature: AvailableFeatureCardItem, absX: number, absY: number) => {
    const sheetTop = SCREEN_HEIGHT - SHEET_HEIGHT;
    const deckZoneThreshold = sheetTop + 54 + deckHeight + 40;

    if (absY > 0 && absY < deckZoneThreshold && !selectedIds.includes(feature.id) && selectedIds.length < MAX_QUICK_ACTIONS) {
      setSelectedIds((prev) => [...prev, feature.id]);
    }
    setDraggingFeature(null);
    setIsOverDeck(false);
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

  const animatedDragPreviewStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { scale: 1.12 },
    ],
    opacity: 0.95,
  }));

  // Active selected items (up to seven, strictly permitted)
  const activeItems = useMemo(() => {
    return selectedIds
      .map((id) => ALL_AVAILABLE_FEATURES.find((f) => f.id === id))
      .filter((item): item is typeof ALL_AVAILABLE_FEATURES[0] =>
        Boolean(item && isFeatureAllowedForUser(item, user))
      )
      .slice(0, MAX_QUICK_ACTIONS);
  }, [selectedIds, user]);

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
            {/* Top Pill Handle & Header with Pull-Down Pan Gesture */}
            <GestureDetector gesture={headerPanGesture}>
              <View
                style={{ backgroundColor: isDark ? '#1C1917' : '#FFFFFF' }}
                className="bg-card"
              >
                <View className="items-center pt-2.5 pb-1">
                  <View className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
                </View>

                <View className="px-5 pt-2 pb-4 border-b border-border">
                  <TouchableOpacity
                    onPress={onClose}
                    className="absolute right-4 top-1 size-10 rounded-full items-center justify-center active:bg-secondary"
                    accessibilityRole="button"
                    accessibilityLabel={t('close', 'Close')}
                  >
                    <X size={26} className="text-foreground" strokeWidth={2.5} />
                  </TouchableOpacity>
                  <Text className="text-center text-[25px] font-extrabold text-foreground tracking-tight">
                    {t('customise_quick_actions', 'Customise Quick Actions')}
                  </Text>
                  <Text className="mt-2 px-7 text-center text-base leading-6 text-muted-foreground">
                    {t('quick_actions_reorder_hint', 'Press and hold to arrange your first 7 actions')}
                  </Text>
                </View>
              </View>
            </GestureDetector>

            {/* Pinned active selection zone, always visible at the top of the sheet. */}
            <View
              style={{ backgroundColor: isDark ? '#292524' : '#F5F5F4' }}
              onLayout={(e) => setDeckHeight(e.nativeEvent.layout.height)}
            >
              <CustomiseDeckZone
                activeItems={activeItems}
                maxCapacity={MAX_QUICK_ACTIONS}
                onRemoveItem={toggleSelect}
                onReorderItem={handleReorder}
                isDropTargetActive={isOverDeck || (Boolean(draggingFeature) && selectedIds.length < MAX_QUICK_ACTIONS)}
              />
            </View>

            {/* Divider Sub-header */}
            <View
              style={{ backgroundColor: isDark ? '#292524' : '#F5F5F4' }}
              className="px-4 py-2.5 border-b border-border flex-row items-center justify-between"
            >
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t('available_actions', 'Available Actions')}
              </Text>
              <Sparkles size={14} color="#C2410C" />
            </View>

            {/* Scrollable Available Features Body */}
            <ScrollView
              style={{ flex: 1, backgroundColor: isDark ? '#1C1917' : '#FFFFFF' }}
              contentContainerStyle={{ paddingBottom: 18, backgroundColor: isDark ? '#1C1917' : '#FFFFFF' }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={!draggingFeature}
            >
              <CustomiseAvailableZone
                features={availableFeaturesForUser}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
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

          {/* Floating Card Drag Preview: Never clipped, floats directly under user's finger */}
          {draggingFeature ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 76,
                  height: 76,
                  borderRadius: 20,
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderWidth: 2.5,
                  borderColor: '#FF6A00',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.45,
                  shadowRadius: 14,
                  elevation: 24,
                  zIndex: 99999,
                },
                animatedDragPreviewStyle,
              ]}
            >
              <FeatureIcon
                iconName={draggingFeature.iconName}
                color={draggingFeature.colorIcon || '#FF6A00'}
                size={30}
              />
              <Text
                numberOfLines={1}
                className="text-[9px] font-bold font-sans text-foreground text-center mt-1 px-1"
              >
                {tFeatureName(draggingFeature.id, draggingFeature.name)}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default CustomiseSheetModal;
