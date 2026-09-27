import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { AdminVillaFilterSheet } from './AdminVillaFilterSheet';
import { Building2, Home, CheckCircle2, ChevronRight, Users, ShieldCheck } from 'lucide-react-native';

export interface AdminPassSetupData {
  scope: 'COMMUNITY' | 'VILLA';
  villaId?: string;
  villaName?: string;
  residentId?: string;
  residentName?: string;
}

interface AdminPassSetupStepProps {
  data: AdminPassSetupData;
  onChange: (data: AdminPassSetupData) => void;
}

export const AdminPassSetupStep: React.FC<AdminPassSetupStepProps> = ({
  data,
  onChange,
}) => {
  const [villaSheetOpen, setVillaSheetOpen] = useState(false);

  const handleSelectScope = (scope: 'COMMUNITY' | 'VILLA') => {
    if (scope === 'COMMUNITY') {
      onChange({
        scope: 'COMMUNITY',
        villaId: undefined,
        villaName: undefined,
        residentId: undefined,
        residentName: undefined,
      });
    } else {
      onChange({
        ...data,
        scope: 'VILLA',
      });
    }
  };

  const handleVillaSelected = (
    villaId?: string,
    villaName?: string,
    residentId?: string,
    residentName?: string
  ) => {
    onChange({
      scope: 'VILLA',
      villaId,
      villaName,
      residentId,
      residentName,
    });
  };

  return (
    <View className="gap-4">
      {/* Header Info Banner */}
      <View className="p-3.5 bg-primary/10 rounded-2xl border border-primary/20 flex-row items-center gap-3">
        <ShieldCheck size={22} className="text-primary shrink-0" />
        <View className="flex-1">
          <Text className="text-xs font-bold text-foreground">Admin Pass Setup</Text>
          <Text className="text-[11px] text-muted-foreground">
            Choose whether this pass is for estate common areas or a specific resident villa.
          </Text>
        </View>
      </View>

      {/* Option 1: Community / Common Area Pass */}
      <TouchableOpacity
        onPress={() => handleSelectScope('COMMUNITY')}
        activeOpacity={0.85}
        className={`p-4 rounded-2xl border-2 gap-2 ${
          data.scope === 'COMMUNITY'
            ? 'border-primary bg-primary/5'
            : 'border-border/80 bg-card'
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            <View
              className={`w-9 h-9 rounded-xl items-center justify-center ${
                data.scope === 'COMMUNITY' ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <Building2
                size={18}
                className={data.scope === 'COMMUNITY' ? 'text-primary-foreground' : 'text-muted-foreground'}
              />
            </View>
            <View>
              <Text className="text-sm font-bold text-foreground">
                Community / Event Pass
              </Text>
              <Text className="text-xs text-muted-foreground">
                Common Areas & Estate Premises
              </Text>
            </View>
          </View>
          {data.scope === 'COMMUNITY' && (
            <CheckCircle2 size={20} className="text-primary" />
          )}
        </View>
        <Text className="text-xs text-muted-foreground ms-11">
          Valid for Clubhouse gatherings, Society Events, Estate Landscaping, and Common Contractors.
        </Text>
      </TouchableOpacity>

      {/* Option 2: Specific Villa Unit Pass */}
      <TouchableOpacity
        onPress={() => handleSelectScope('VILLA')}
        activeOpacity={0.85}
        className={`p-4 rounded-2xl border-2 gap-3 ${
          data.scope === 'VILLA'
            ? 'border-primary bg-primary/5'
            : 'border-border/80 bg-card'
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            <View
              className={`w-9 h-9 rounded-xl items-center justify-center ${
                data.scope === 'VILLA' ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <Home
                size={18}
                className={data.scope === 'VILLA' ? 'text-primary-foreground' : 'text-muted-foreground'}
              />
            </View>
            <View>
              <Text className="text-sm font-bold text-foreground">
                Specific Villa Unit
              </Text>
              <Text className="text-xs text-muted-foreground">
                Generate on behalf of a resident
              </Text>
            </View>
          </View>
          {data.scope === 'VILLA' && (
            <CheckCircle2 size={20} className="text-primary" />
          )}
        </View>

        {/* Villa & Host Picker inside Option 2 */}
        {data.scope === 'VILLA' && (
          <View className="pt-2 border-t border-border/40 gap-2">
            <Text className="text-xs font-semibold text-foreground">
              Target Destination & Host Resident:
            </Text>
            <Button
              variant="outline"
              size="default"
              onPress={() => setVillaSheetOpen(true)}
              className="min-h-[72px] h-auto flex-row items-center justify-between px-3.5 py-2.5 rounded-xl border-primary/30 bg-card"
            >
              <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                <Home size={16} className="text-primary shrink-0" />
                <View className="flex-1 min-w-0 justify-center">
                  <Text className="text-xs leading-4 font-bold text-foreground" numberOfLines={2} ellipsizeMode="tail">
                    {data.villaName || 'Select Destination Unit & Host *'}
                  </Text>
                  {data.residentName && (
                    <Text className="text-[11px] leading-4 text-muted-foreground" numberOfLines={2} ellipsizeMode="tail">
                      Host: {data.residentName}
                    </Text>
                  )}
                </View>
              </View>
              <ChevronRight size={15} className="text-primary shrink-0 ms-2" />
            </Button>
          </View>
        )}
      </TouchableOpacity>

      {/* Villa Selection Sheet */}
      <AdminVillaFilterSheet
        visible={villaSheetOpen}
        onClose={() => setVillaSheetOpen(false)}
        selectedVillaId={data.villaId}
        onSelectVilla={handleVillaSelected}
      />
    </View>
  );
};

export default AdminPassSetupStep;
