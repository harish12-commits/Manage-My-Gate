import React from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import {
  Wrench,
  Zap,
  Hammer,
  ArrowUpDown,
  Wind,
  ShieldAlert,
  Sparkles,
  Car,
  Dumbbell,
  HelpCircle,
  ChevronRight,
} from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

export interface ComplaintCategoryOption {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  iconColor?: string;
  iconBg?: string;
  badge?: string;
}

export const COMPLAINT_CATEGORY_OPTIONS: ComplaintCategoryOption[] = [
  {
    id: 'Plumbing',
    title: 'Plumbing & Water',
    description: 'Water leakages, tap repairs, flush tanks, drainage & water pressure',
    icon: Wrench,
    iconColor: '#0284c7',
    iconBg: 'bg-sky-500/10',
    badge: 'Urgent Available',
  },
  {
    id: 'Electrical',
    title: 'Electrical & Power',
    description: 'Power trips, switchboard sparking, lighting replacement & intercom',
    icon: Zap,
    iconColor: '#eab308',
    iconBg: 'bg-amber-500/10',
    badge: 'Priority Support',
  },
  {
    id: 'Carpentry',
    title: 'Carpentry & Woodwork',
    description: 'Door latches, lock repairs, cabinet hinges, window tracks & woodwork',
    icon: Hammer,
    iconColor: '#d97706',
    iconBg: 'bg-amber-600/10',
  },
  {
    id: 'Elevators',
    title: 'Elevator & Lifts',
    description: 'Lift stuck, buttons unresponsive, fan or lighting faults in lift cabin',
    icon: ArrowUpDown,
    iconColor: '#ef4444',
    iconBg: 'bg-rose-500/10',
    badge: 'Safety Critical',
  },
  {
    id: 'AC & HVAC',
    title: 'AC & Cooling',
    description: 'AC water leakage, cooling issues, compressor noise & filter service',
    icon: Wind,
    iconColor: '#06b6d4',
    iconBg: 'bg-cyan-500/10',
  },
  {
    id: 'Security',
    title: 'Security & Access Gate',
    description: 'Main gate boom barrier, guard attendance, CCTV coverage, access cards',
    icon: ShieldAlert,
    iconColor: '#8b5cf6',
    iconBg: 'bg-violet-500/10',
  },
  {
    id: 'Housekeeping',
    title: 'Housekeeping & Cleanliness',
    description: 'Common area sweeping, garbage collection, staircase dustbins & pest spray',
    icon: Sparkles,
    iconColor: '#10b981',
    iconBg: 'bg-emerald-500/10',
  },
  {
    id: 'Parking',
    title: 'Parking & Basement',
    description: 'Wrong vehicle in bay, visitor parking issues, basement lighting',
    icon: Car,
    iconColor: '#6366f1',
    iconBg: 'bg-indigo-500/10',
  },
  {
    id: 'Amenities',
    title: 'Amenities & Facilities',
    description: 'Clubhouse, gym equipment, swimming pool, badminton court upkeep',
    icon: Dumbbell,
    iconColor: '#f97316',
    iconBg: 'bg-orange-500/10',
  },
  {
    id: 'Others',
    title: 'General Issue / Other',
    description: 'General community suggestions, landscaping, or custom upkeep issues',
    icon: HelpCircle,
    iconColor: '#64748b',
    iconBg: 'bg-slate-500/10',
  },
];

export interface ComplaintTypeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectCategory: (category: string) => void;
}

export const ComplaintTypeSheet: React.FC<ComplaintTypeSheetProps> = ({
  visible,
  onClose,
  onSelectCategory,
}) => {
  const { t, translateText } = useTranslation();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('select_issue_category', 'Select Issue Category')}
    >
      <View className="gap-3 pb-6 px-1 py-2">
        <Text variant="muted" className="text-xs px-1">
          {t(
            'select_issue_category_desc',
            'Choose an issue category to launch the guided ticket creation wizard.'
          )}
        </Text>

        {COMPLAINT_CATEGORY_OPTIONS.map((option) => {
          const IconComp = option.icon;
          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => {
                onSelectCategory(option.id);
                onClose();
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={option.title}
              className="flex-row items-center bg-card border border-border rounded-2xl p-3.5 gap-3.5 active:bg-muted/40"
            >
              <View
                className={`w-11 h-11 rounded-xl ${
                  option.iconBg || 'bg-primary/10'
                } items-center justify-center`}
              >
                <IconComp size={22} color={option.iconColor || 'hsl(var(--primary))'} />
              </View>

              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-bold text-foreground">
                    {translateText(option.title)}
                  </Text>
                  {option.badge ? (
                    <View className="bg-secondary px-2 py-0.5 rounded-full border border-border">
                      <Text className="text-[10px] font-semibold text-secondary-foreground">
                        {translateText(option.badge)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text variant="muted" className="text-xs leading-4">
                  {translateText(option.description)}
                </Text>
              </View>

              <ChevronRight size={18} className="text-muted-foreground" />
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
};

export default ComplaintTypeSheet;
