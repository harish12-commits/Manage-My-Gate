import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Text } from './text';
import { Button } from './button';
import { Chip } from '../common/Chip';
import { X, Check, RotateCcw } from 'lucide-react-native';
import { cn } from '../../lib/utils';
import { SheetGrabHandle } from './SheetGrabHandle';
import { useTranslation } from '../../src/utils/i18n';

export interface FilterOption {
  id: string;
  label: string;
  count?: number | string;
  color?: string;
  icon?: any;
  description?: string;
}

export interface FilterCategoryConfig {
  id: string;
  label: string;
  icon?: any;
  type?: 'checkbox' | 'radio' | 'toggle' | 'chips' | 'custom';
  options?: FilterOption[];
  selectedValues?: string[] | string | boolean;
  selectedCount?: number;
  onOptionToggle?: (optionId: string) => void;
  onOptionSelect?: (optionId: string) => void;
  onToggleChange?: (val: boolean) => void;
  renderCustom?: () => React.ReactNode;
}

export interface GlobalFilterPanelProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  categories: FilterCategoryConfig[];
  selectedCategoryId?: string;
  onSelectCategory?: (categoryId: string) => void;
  onApply: () => void;
  onClearAll: () => void;
  totalActiveCount?: number;
  applyLabel?: string;
  clearLabel?: string;
}

export const GlobalFilterPanel: React.FC<GlobalFilterPanelProps> = ({
  visible,
  onClose,
  title = 'Filter by',
  categories = [],
  selectedCategoryId,
  onSelectCategory,
  onApply,
  onClearAll,
  totalActiveCount = 0,
  applyLabel,
  clearLabel = 'Clear all',
}) => {
  const { t, translateText } = useTranslation();

  // Internal category selection state if not controlled externally
  const [internalSelectedCat, setInternalSelectedCat] = useState<string>(
    categories[0]?.id || ''
  );

  useEffect(() => {
    if (selectedCategoryId) {
      setInternalSelectedCat(selectedCategoryId);
    } else if (categories.length > 0 && !categories.some((c) => c.id === internalSelectedCat)) {
      setInternalSelectedCat(categories[0].id);
    }
  }, [selectedCategoryId, categories]);

  if (!visible) return null;

  const currentCategory =
    categories.find((c) => c.id === internalSelectedCat) || categories[0];

  const handleCategoryPress = (catId: string) => {
    setInternalSelectedCat(catId);
    onSelectCategory?.(catId);
  };

  const screenHeight = Dimensions.get('window').height;
  const panelMaxHeight = Platform.OS === 'web'
    ? Math.min(Math.round(screenHeight * 0.85), 620)
    : Math.round(screenHeight * 0.82);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'android' ? 'height' : undefined}
        style={{ flex: 1 }}
        className="flex-1 justify-end items-center"
      >
        {/* Dark Backdrop */}
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />

        {/* Two-Pane Filter Panel Container */}
        <View
          style={{ maxHeight: panelMaxHeight, height: panelMaxHeight, maxWidth: '100%' }}
          className="bg-card border-t border-border/80 rounded-t-3xl sm:rounded-3xl sm:border sm:mb-4 shadow-2xl overflow-hidden flex-col w-full max-w-lg mx-auto"
        >
          {/* Top Grab Handle */}
          <SheetGrabHandle onClose={onClose} />

          {/* 1. Header */}
          <View className="w-full pb-3 border-b border-border/80 items-center justify-between flex-row px-5 py-3 bg-card">
            <View className="flex-row items-center gap-2">
              <Text className="text-[17px] font-bold font-sans text-foreground tracking-tight">
                {translateText(title)}
              </Text>
              {totalActiveCount > 0 && (
                <View className="bg-primary/15 px-2 py-0.5 rounded-full border border-primary/30">
                  <Text className="text-primary text-[11px] font-bold font-sans">
                    {totalActiveCount}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              className="p-1.5 rounded-full bg-secondary border border-border/60"
              accessibilityRole="button"
              accessibilityLabel="Close filter panel"
            >
              <X size={16} className="text-foreground" />
            </TouchableOpacity>
          </View>

          {/* 2. Two-Pane Body */}
          <View className="flex-1 flex-row bg-background">
            {/* Left Pane: Category Navigation List */}
            <View className="w-[36%] border-e border-border/80 bg-muted/25">
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerClassName="py-1"
              >
                {categories.map((category) => {
                  const isSelected = category.id === currentCategory?.id;
                  const CategoryIcon = category.icon;
                  const count =
                    category.selectedCount !== undefined
                      ? category.selectedCount
                      : Array.isArray(category.selectedValues)
                      ? category.selectedValues.length
                      : category.selectedValues && category.selectedValues !== 'ALL' && category.selectedValues !== ''
                      ? 1
                      : 0;

                  return (
                    <TouchableOpacity
                      key={category.id}
                      onPress={() => handleCategoryPress(category.id)}
                      activeOpacity={0.75}
                      className={cn(
                        'flex-row items-center justify-between px-3.5 py-3.5 border-b border-border/30 relative transition-all',
                        isSelected
                          ? 'bg-primary/10 border-s-[3.5px] border-s-primary'
                          : 'bg-transparent border-s-[3.5px] border-s-transparent'
                      )}
                      accessibilityRole="button"
                      accessibilityLabel={`${category.label} category`}
                    >
                      <View className="flex-1 me-1">
                        <View className="flex-row items-center gap-1.5">
                          {CategoryIcon && (
                            <CategoryIcon
                              size={14}
                              className={isSelected ? 'text-primary' : 'text-muted-foreground'}
                            />
                          )}
                          <Text
                            numberOfLines={2}
                            className={cn(
                              'text-xs leading-snug font-sans',
                              isSelected
                                ? 'font-bold text-primary'
                                : 'font-medium text-foreground/80'
                            )}
                          >
                            {translateText(category.label)}
                          </Text>
                        </View>
                      </View>

                      {count > 0 && (
                        <View className="bg-primary/20 px-1.5 py-0.2 rounded-full min-w-[18px] items-center justify-center">
                          <Text className="text-[10px] font-bold text-primary font-sans">
                            {count}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Right Pane: Option Area for Active Category */}
            <View className="flex-1 bg-card">
              <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerClassName="p-4 gap-2.5 pb-8 flex-grow"
                keyboardShouldPersistTaps="handled"
              >
                {/* Category Header Title */}
                <View className="pb-1 mb-1 border-b border-border/40 flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                    {translateText(currentCategory?.label ? `${currentCategory.label} Options` : 'Options')}
                  </Text>
                </View>

                {/* Custom Content View */}
                {currentCategory?.type === 'custom' && currentCategory.renderCustom ? (
                  currentCategory.renderCustom()
                ) : currentCategory?.type === 'chips' ? (
                  /* Chips Grid */
                  <View className="flex-row flex-wrap gap-2 pt-1">
                    {currentCategory.options?.map((opt) => {
                      const isSelected = Array.isArray(currentCategory.selectedValues)
                        ? currentCategory.selectedValues.includes(opt.id)
                        : currentCategory.selectedValues === opt.id;
                      const OptionIcon = opt.icon;

                      return (
                        <Chip
                          key={opt.id}
                          label={opt.label}
                          icon={OptionIcon}
                          selected={isSelected}
                          onPress={() => {
                            if (currentCategory.onOptionToggle) {
                              currentCategory.onOptionToggle(opt.id);
                            } else if (currentCategory.onOptionSelect) {
                              currentCategory.onOptionSelect(opt.id);
                            }
                          }}
                          className="py-1.5 px-3"
                        />
                      );
                    })}
                  </View>
                ) : currentCategory?.type === 'toggle' ? (
                  /* Toggle Rows */
                  <View className="gap-2.5 pt-1">
                    {currentCategory.options?.map((opt) => {
                      const isChecked = Boolean(
                        Array.isArray(currentCategory.selectedValues)
                          ? currentCategory.selectedValues.includes(opt.id)
                          : currentCategory.selectedValues === opt.id || currentCategory.selectedValues === true
                      );

                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => currentCategory.onOptionToggle?.(opt.id)}
                          activeOpacity={0.7}
                          className={cn(
                            'flex-row items-center justify-between p-3 rounded-2xl border transition-all',
                            isChecked
                              ? 'bg-primary/10 border-primary/40'
                              : 'bg-card border-border/80'
                          )}
                        >
                          <View className="flex-1 me-2">
                            <Text className="text-xs font-bold text-foreground font-sans">
                              {translateText(opt.label)}
                            </Text>
                            {opt.description && (
                              <Text className="text-[11px] text-muted-foreground font-sans mt-0.5">
                                {translateText(opt.description)}
                              </Text>
                            )}
                          </View>
                          <Switch
                            value={isChecked}
                            onValueChange={() => currentCategory.onOptionToggle?.(opt.id)}
                            trackColor={{ false: '#e2e8f0', true: '#FF6A00' }}
                            thumbColor={isChecked ? '#ffffff' : '#f8fafc'}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : currentCategory?.type === 'radio' ? (
                  /* Radio Options List */
                  <View className="gap-2 pt-1">
                    {currentCategory?.options?.map((opt) => {
                      const isSelected = currentCategory.selectedValues === opt.id;
                      const OptionIcon = opt.icon;

                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => currentCategory.onOptionSelect?.(opt.id)}
                          activeOpacity={0.7}
                          className={cn(
                            'flex-row items-center justify-between p-3 rounded-xl border transition-all',
                            isSelected
                              ? 'bg-primary/10 border-primary shadow-2xs'
                              : 'bg-card border-border/70 active:bg-secondary/40'
                          )}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSelected }}
                        >
                          <View className="flex-row items-center gap-2.5 flex-1 me-2">
                            {/* Radio Circle Indicator */}
                            <View
                              className={cn(
                                'w-4 h-4 rounded-full border items-center justify-center shrink-0',
                                isSelected
                                  ? 'border-primary bg-card'
                                  : 'border-muted-foreground/40 bg-card'
                              )}
                            >
                              {isSelected && (
                                <View className="w-2 h-2 rounded-full bg-primary" />
                              )}
                            </View>

                            {OptionIcon && (
                              <OptionIcon
                                size={14}
                                className={isSelected ? 'text-primary' : 'text-muted-foreground'}
                              />
                            )}

                            <Text
                              className={cn(
                                'text-xs font-sans',
                                isSelected
                                  ? 'font-bold text-primary'
                                  : 'font-medium text-foreground'
                              )}
                            >
                              {translateText(opt.label)}
                            </Text>
                          </View>

                          {opt.count !== undefined && (
                            <Text
                              className={cn(
                                'text-xs font-mono',
                                isSelected ? 'text-primary font-bold' : 'text-muted-foreground'
                              )}
                            >
                              {opt.count}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  /* Default: Checkbox Multi-Select Option List */
                  <View className="gap-2 pt-1">
                    {currentCategory?.options?.map((opt) => {
                      const isChecked = Array.isArray(currentCategory?.selectedValues)
                        ? currentCategory.selectedValues.includes(opt.id)
                        : currentCategory?.selectedValues === opt.id;
                      const OptionIcon = opt.icon;

                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => currentCategory?.onOptionToggle?.(opt.id)}
                          activeOpacity={0.7}
                          className={cn(
                            'flex-row items-center justify-between p-3 rounded-xl border transition-all',
                            isChecked
                              ? 'bg-primary/10 border-primary shadow-2xs'
                              : 'bg-card border-border/70 active:bg-secondary/40'
                          )}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isChecked }}
                        >
                          <View className="flex-row items-center gap-2.5 flex-1 me-2">
                            {/* Square Checkbox Indicator */}
                            <View
                              className={cn(
                                'w-4 h-4 rounded-md border items-center justify-center shrink-0',
                                isChecked
                                  ? 'bg-primary border-primary'
                                  : 'border-muted-foreground/40 bg-card'
                              )}
                            >
                              {isChecked && <Check size={11} color="#ffffff" strokeWidth={3} />}
                            </View>

                            {OptionIcon && (
                              <OptionIcon
                                size={14}
                                className={isChecked ? 'text-primary' : 'text-muted-foreground'}
                              />
                            )}

                            <Text
                              className={cn(
                                'text-xs font-sans',
                                isChecked
                                  ? 'font-bold text-primary'
                                  : 'font-medium text-foreground'
                              )}
                            >
                              {translateText(opt.label)}
                            </Text>
                          </View>

                          {opt.count !== undefined && (
                            <Text
                              className={cn(
                                'text-xs font-mono',
                                isChecked ? 'text-primary font-bold' : 'text-muted-foreground'
                              )}
                            >
                              {opt.count}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>

          {/* 3. Bottom Action Footer */}
          <View className="flex-row items-center justify-between px-5 py-3.5 border-t border-border/80 bg-card">
            {/* Clear All Action */}
            <TouchableOpacity
              onPress={onClearAll}
              activeOpacity={0.7}
              className="py-2 px-1 flex-row items-center gap-1.5"
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
            >
              <RotateCcw size={14} className="text-muted-foreground" />
              <Text className="font-semibold text-foreground/80 text-sm font-sans hover:text-primary">
                {translateText(clearLabel)}
              </Text>
            </TouchableOpacity>

            {/* Apply Action Button */}
            <Button
              variant="default"
              className="bg-primary px-7 h-11 rounded-xl shadow-xs flex-row items-center justify-center gap-2 min-w-[130px]"
              onPress={onApply}
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
            >
              <Check size={16} className="text-primary-foreground" />
              <Text className="font-bold text-primary-foreground text-sm font-sans">
                {applyLabel ||
                  (totalActiveCount > 0
                    ? `${t('apply', 'Apply')} (${totalActiveCount})`
                    : t('apply', 'Apply'))}
              </Text>
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default GlobalFilterPanel;
