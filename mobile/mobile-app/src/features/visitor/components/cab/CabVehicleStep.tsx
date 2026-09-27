import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Car, Bike } from 'lucide-react-native';

export interface CabVehicleData {
  vehicleNo: string;
  vehicleType: 'CAB' | 'AUTO' | 'BIKE';
  driverPhone?: string;
}

export interface CabVehicleStepProps {
  data: CabVehicleData;
  onChange: (data: CabVehicleData) => void;
  error?: string;
}

export const CabVehicleStep: React.FC<CabVehicleStepProps> = ({
  data,
  onChange,
  error,
}) => {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 gap-4">
      <View className="gap-1">
        <Text variant="large" className="font-bold text-foreground">
          Vehicle Registration Details
        </Text>
        <Text variant="muted" className="text-xs">
          Enter the license plate number for automatic barrier gate recognition.
        </Text>
      </View>

      <View className="bg-card border border-border rounded-2xl p-4 gap-4">
        {/* Vehicle Type Selection */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Vehicle Type</Text>
          <View className="flex-row gap-2">
            {[
              { id: 'CAB', label: 'Cab / Taxi', icon: Car },
              { id: 'AUTO', label: 'Auto Rickshaw', icon: Car },
              { id: 'BIKE', label: 'Bike / Scooter', icon: Bike },
            ].map((type) => {
              const isSelected = data.vehicleType === type.id;
              const IconComp = type.icon;
              return (
                <TouchableOpacity
                  key={type.id}
                  onPress={() => onChange({ ...data, vehicleType: type.id as any })}
                  activeOpacity={0.8}
                  className={`flex-1 min-h-11 py-2.5 px-2 rounded-xl border items-center justify-center gap-1 ${
                    isSelected
                      ? 'bg-primary/10 border-primary'
                      : 'bg-background border-border'
                  }`}
                >
                  <IconComp
                    size={18}
                    className={isSelected ? 'text-primary' : 'text-muted-foreground'}
                  />
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Vehicle Number */}
        <Input
          label="License Plate Number"
          placeholder="e.g. KA-01-MJ-4920"
          leftIcon={<Car size={18} className="text-muted-foreground" />}
          value={data.vehicleNo}
          onChangeText={(val) => onChange({ ...data, vehicleNo: val.toUpperCase() })}
          error={error}
        />

        {/* Driver Phone Number */}
        <Input
          label="Driver Contact Phone (Optional)"
          placeholder="9876543210"
          keyboardType="phone-pad"
          maxLength={10}
          value={data.driverPhone || ''}
          onChangeText={(val) => onChange({ ...data, driverPhone: val })}
        />
      </View>
    </ScrollView>
  );
};
