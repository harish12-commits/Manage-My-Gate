import React from 'react';
import { View } from 'react-native';
import { ListCard } from '@/components/ui/ListCard';
import { StatusVariant } from '@/components/ui/StatusBadge';
import { Text } from '@/components/ui/text';
import { Villa } from '../store/villaSlice';

interface VillaCardProps {
  villa: Villa;
  onPress: (villa: Villa) => void;
}

export const VillaCard: React.FC<VillaCardProps> = ({ villa, onPress }) => {
  const getStatusVariant = (status?: string): StatusVariant => {
    switch (status) {
      case 'Occupied':
        return 'success';
      case 'Vacant':
        return 'neutral';
      case 'Under Maintenance':
      case 'Under Renovation':
        return 'warning';
      case 'For Sale':
      case 'For Rent':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const occupantCount = villa.residents?.length || 0;
  const areaVal = villa.floorAreaSqFt || villa.squareFeetArea;

  const rawBlock = villa.blockOrBuilding?.trim();
  const blockText = rawBlock
    ? rawBlock.toLowerCase().startsWith('block') || rawBlock.toLowerCase().startsWith('tower')
      ? rawBlock
      : `Block ${rawBlock}`
    : 'Main Block';

  const floorText = villa.floor !== undefined && villa.floor !== null && String(villa.floor).trim() !== ''
    ? `Floor ${villa.floor}`
    : undefined;

  const areaText = areaVal ? `${areaVal} sq.ft` : undefined;

  const subtitleText = [blockText, floorText, areaText].filter(Boolean).join(' • ');

  const primaryResName = villa.primaryResident?.name || villa.primaryResident?.email;

  return (
    <ListCard
      title={`Unit ${villa.unitNumber}`}
      subtitle={subtitleText}
      leftIcon="Home"
      leftIconBgColor="bg-primary/10"
      leftIconColor="#0d9488"
      status={{
        label: villa.status || 'Vacant',
        variant: getStatusVariant(villa.status),
      }}
      showChevron
      onPress={() => onPress(villa)}
    >
      <View className="w-full flex-row items-center justify-between pt-2 border-t border-border/40 mt-2">
        <Text variant="muted" className="text-xs">
          Type: <Text className="font-semibold text-foreground">{villa.type || 'Apartment'}</Text>
        </Text>
        <Text variant="muted" className="text-xs">
          {primaryResName ? (
            <>Primary: <Text className="font-semibold text-primary">{primaryResName}</Text></>
          ) : (
            <>Occupants: <Text className="font-semibold text-foreground">{occupantCount}</Text></>
          )}
        </Text>
      </View>
    </ListCard>
  );
};

export default VillaCard;
