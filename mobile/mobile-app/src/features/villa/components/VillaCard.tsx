import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Home, User, Edit2, Search, MoreVertical } from 'lucide-react-native';
import { StatusBadge, StatusVariant } from '@/components/ui/StatusBadge';
import { Villa } from '../store/villaSlice';
import { useTranslation } from '@/src/utils/i18n';

interface VillaCardProps {
  villa: Villa;
  onPress: (villa: Villa) => void;
  onEdit: (villa: Villa) => void;
  className?: string;
}

export const VillaCard: React.FC<VillaCardProps> = ({ 
  villa, 
  onPress, 
  onEdit,
  className = '' 
}) => {
  const { t } = useTranslation();

  const getStatusVariant = (status?: string): StatusVariant => {
    switch (status) {
      case 'Occupied':
        return 'success';
      case 'Vacant':
        return 'warning';
      case 'Under Maintenance':
      case 'Under Renovation':
        return 'danger';
      case 'For Sale':
      case 'For Rent':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const rawBlock = villa.blockOrBuilding?.trim();
  const blockText = rawBlock
    ? rawBlock.toLowerCase().startsWith('block') || rawBlock.toLowerCase().startsWith('tower')
      ? rawBlock
      : `Block ${rawBlock}`
    : 'Main Block';

  const floorText = villa.floor !== undefined && villa.floor !== null && String(villa.floor).trim() !== ''
    ? `Floor ${villa.floor}`
    : undefined;

  const areaVal = villa.floorAreaSqFt || villa.squareFeetArea;
  const areaText = areaVal ? `${areaVal} sq.ft` : undefined;

  const subtitleText = [blockText, floorText, areaText].filter(Boolean).join(' ? ');
  const primaryResName = villa.primaryResident?.name || villa.primaryResident?.email;

  return (
    <View className={`mb-4 p-4 bg-card border border-border/40 rounded-3xl shadow-sm ${className}`}>
      {/* Top Section: Avatar + Details (Left) and Status (Right) */}
      <View className="flex-row items-start justify-between">
        {/* Left: Avatar + Identity */}
        <View className="flex-row items-start flex-1 me-2">
          {/* Premium Circular Avatar */}
          <View className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 items-center justify-center me-3.5 shrink-0 shadow-sm">
            <Home size={20} className="text-primary" />
          </View>

          {/* Unit Number, Block, Type */}
          <View className="flex-1 mt-0.5">
            <Text
              className="text-[15px] font-bold text-foreground font-sans tracking-tight"
              numberOfLines={1}
            >
              {t('unit_label', 'Unit')} {villa.unitNumber}
            </Text>

            <Text
              className="text-[13px] text-muted-foreground font-sans mt-0.5"
              numberOfLines={1}
            >
              {subtitleText}
            </Text>

            {/* Tags Row */}
            <View className="flex-row items-center flex-wrap gap-2 mt-2">
              <View className="bg-secondary px-2.5 py-1 rounded-full border border-border/50">
                <Text className="text-[10px] font-bold text-secondary-foreground uppercase tracking-wider font-sans">
                  {villa.type || 'Apartment'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Right: Status */}
        <View className="items-end shrink-0">
          <StatusBadge
            label={villa.status || 'Vacant'}
            variant={getStatusVariant(villa.status)}
            size="sm"
          />
        </View>
      </View>

      {/* Middle Section: Assigned Resident Box (Mimicking User's Assigned Unit Box) */}
      {primaryResName ? (
        <View className="mt-3.5 pt-3.5 border-t border-border/40 gap-2">
          <View className="flex-row items-center justify-between p-2.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-900/20 border border-emerald-500/20 shadow-sm">
            <View className="flex-row items-center flex-1 shrink me-2">
              <View className="w-6 h-6 rounded-full bg-emerald-500/20 items-center justify-center shrink-0 me-2">
                <User size={12} color="#10b981" />
              </View>
              <View className="flex-row items-center flex-1 shrink">
                <Text 
                  className="text-xs font-bold text-emerald-800 dark:text-emerald-300 font-sans shrink"
                  numberOfLines={1}
                >
                  {primaryResName}
                </Text>
                <Text 
                  className="text-[11px] text-muted-foreground font-sans font-medium shrink-0 ms-1"
                >
                  | {t('resident', 'Resident')}
                </Text>
              </View>
            </View>

            <View className="bg-card border border-border/60 px-2 py-1 rounded-lg shadow-sm shrink">
              <Text 
                className="text-[10px] font-bold text-foreground font-sans tracking-wide text-center"
                numberOfLines={2}
              >
                {t('primary', 'Primary')}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Premium Inline Action Buttons */}
      <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-border/40">
        <TouchableOpacity 
          onPress={() => onPress(villa)} 
          activeOpacity={0.7}
          className="flex-1 py-3.5 rounded-2xl bg-secondary/80 border border-border/50 active:bg-secondary flex-row items-center justify-center transition-all me-1.5"
        >
          <View className="w-6 h-6 rounded-full bg-foreground/5 items-center justify-center shrink-0 me-2">
            <Search size={13} className="text-foreground" />
          </View>
          <Text className="text-[13px] font-extrabold text-foreground tracking-wide shrink" numberOfLines={1}>{t('view_details', 'View Details')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => onEdit(villa)} 
          activeOpacity={0.7}
          className="flex-1 py-3.5 rounded-2xl bg-primary/10 border border-primary/20 active:bg-primary/20 flex-row items-center justify-center transition-all ms-1.5"
        >
          <View className="w-6 h-6 rounded-full bg-primary/10 items-center justify-center shrink-0 me-2">
            <Edit2 size={13} className="text-primary" />
          </View>
          <Text className="text-[13px] font-extrabold text-primary tracking-wide shrink" numberOfLines={1}>{t('edit_unit', 'Edit Unit')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
