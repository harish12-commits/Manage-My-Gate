import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { Building2, Check, User, ChevronRight } from 'lucide-react-native';

import { useSelector } from 'react-redux';
import { RootState } from '@/src/store/store';
import { useVilla } from '../../../villa/hooks/useVilla';

export interface VillaResidentOption {
  id: string; // User ID
  name: string; // User Name
  type: string; // Residency Type e.g. Primary Resident, Owner, Tenant
  phone?: string;
}

export interface VillaOption {
  id: string; // Villa ID
  name: string; // e.g. "Villa 101 - Block A"
  primaryResidentId?: string;
  primaryResidentName?: string;
  residents: VillaResidentOption[];
}

export interface AdminVillaFilterSheetProps {
  visible: boolean;
  selectedVillaId?: string;
  selectedResidentId?: string;
  onClose: () => void;
  onSelectVilla: (
    villaId: string | undefined,
    villaName?: string,
    residentId?: string,
    residentName?: string
  ) => void;
}

export const AdminVillaFilterSheet: React.FC<AdminVillaFilterSheetProps> = ({
  visible,
  selectedVillaId,
  selectedResidentId,
  onClose,
  onSelectVilla,
}) => {
  const [search, setSearch] = useState('');
  const [expandedVillaId, setExpandedVillaId] = useState<string | null>(null);

  const { fetchVillas, loading } = useVilla();
  const reduxVillas = useSelector((state: RootState) => (state as any).villa?.villas);

  useEffect(() => {
    if (visible && (!reduxVillas || reduxVillas.length === 0)) {
      fetchVillas({ page: 1, limit: 200 });
    }
  }, [visible, reduxVillas, fetchVillas]);

  const villaOptions: VillaOption[] = React.useMemo(() => {
    if (Array.isArray(reduxVillas) && reduxVillas.length > 0) {
      return reduxVillas.map((v: any) => {
        const villaId = v._id || v.id;
        const rawUnit = (v.unitNumber || v.name || '').trim();
        const formattedUnit = rawUnit.toLowerCase().startsWith('villa') ? rawUnit : `Villa ${rawUnit}`;
        // Block names are often stored as "Block A"; don't prefix a second "Block".
        const blockLabel = v.blockOrBuilding
          ? (/^block\b/i.test(v.blockOrBuilding.trim()) ? v.blockOrBuilding.trim() : `Block ${v.blockOrBuilding.trim()}`)
          : '';
        const villaName = `${formattedUnit}${blockLabel ? ` - ${blockLabel}` : ''}`;
        
        const primaryRes = v.primaryResidentId || (v.residents && v.residents[0]?.userId);
        const primaryResId = typeof primaryRes === 'object' ? (primaryRes._id || primaryRes.id) : primaryRes;
        const primaryResName = typeof primaryRes === 'object' ? (primaryRes.name || primaryRes.username) : 'Primary Resident';

        const residentsList: VillaResidentOption[] = [];

        if (Array.isArray(v.residents) && v.residents.length > 0) {
          v.residents.forEach((r: any) => {
            const userObj = typeof r.userId === 'object' ? r.userId : null;
            const rId = userObj?._id || userObj?.id || r.userId || r.id;
            const rName = userObj?.name || userObj?.username || userObj?.phone || 'Resident';
            if (rId) {
              residentsList.push({
                id: rId,
                name: rName,
                type: r.residencyType || (r.isPrimary ? 'Primary Resident' : 'Resident'),
                phone: userObj?.phone,
              });
            }
          });
        }

        if (residentsList.length === 0 && primaryResId) {
          residentsList.push({
            id: primaryResId,
            name: primaryResName,
            type: 'Primary Resident',
          });
        }

        return {
          id: villaId,
          name: villaName,
          primaryResidentId: primaryResId,
          primaryResidentName: primaryResName,
          residents: residentsList,
        };
      });
    }
    return [];
  }, [reduxVillas]);

  const filteredVillas = villaOptions.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.residents.some((r) => r.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Select Villa & Resident Host"
    >
      <View className="gap-3 pb-4">
        {/* Search */}
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search villa number or resident name..."
          variant="bordered"
        />

        {/* Options */}
        <ScrollView className="max-h-[55vh]" contentContainerClassName="gap-2 pb-2" showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => {
              onSelectVilla(undefined, 'All Villas', undefined, undefined);
              onClose();
            }}
            className={`p-3.5 rounded-xl border flex-row items-center justify-between ${
              !selectedVillaId ? 'bg-primary/10 border-primary' : 'bg-card border-border'
            }`}
          >
            <Text className={`text-sm font-semibold ${!selectedVillaId ? 'text-primary' : 'text-foreground'}`}>
              All Villas & Common Areas
            </Text>
            {!selectedVillaId && <Check size={16} className="text-primary" />}
          </TouchableOpacity>

          {filteredVillas.map((villa) => {
            const isVillaSelected = selectedVillaId === villa.id;
            const isExpanded = expandedVillaId === villa.id || search.trim().length > 0;

            return (
              <View key={villa.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Villa Header Row */}
                <TouchableOpacity
                  onPress={() => {
                    const primaryRes = villa.residents[0] || {
                      id: villa.primaryResidentId || villa.id,
                      name: villa.primaryResidentName || 'Primary Resident',
                    };
                    onSelectVilla(villa.id, villa.name, primaryRes.id, `${primaryRes.name} (${villa.name})`);
                    onClose();
                  }}
                  className={`p-3.5 flex-row items-center justify-between ${
                    isVillaSelected ? 'bg-primary/5' : ''
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-foreground">{villa.name}</Text>
                    {villa.residents.length > 0 && (
                      <Text className="text-xs text-muted-foreground mt-0.5">
                        {villa.residents.length} Resident occupant{villa.residents.length > 1 ? 's' : ''} tied to unit
                      </Text>
                    )}
                  </View>
                  <View className="flex-row items-center gap-2">
                    {isVillaSelected && <Check size={16} className="text-primary" />}
                    {villa.residents.length > 0 ? (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setExpandedVillaId(expandedVillaId === villa.id ? null : villa.id);
                        }}
                        className="p-1 rounded-lg bg-muted/60"
                        accessibilityRole="button"
                        accessibilityLabel="Toggle resident hosts"
                      >
                        <ChevronRight
                          size={16}
                          className={`text-muted-foreground ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* Residents Sub-List */}
                {isExpanded && villa.residents.length > 0 && (
                  <View className="bg-muted/40 border-t border-border/50 p-2 gap-1.5">
                    <Text className="text-[10px] font-bold text-muted-foreground uppercase px-2 pt-1">
                      Select Specific Resident Host:
                    </Text>
                    {villa.residents.map((resident) => {
                      const isResSelected = selectedResidentId === resident.id;
                      return (
                        <TouchableOpacity
                          key={resident.id}
                          onPress={() => {
                            onSelectVilla(
                              villa.id,
                              villa.name,
                              resident.id,
                              `${resident.name} (${villa.name})`
                            );
                            onClose();
                          }}
                          className={`p-2.5 rounded-lg border flex-row items-center justify-between ${
                            isResSelected
                              ? 'bg-primary/10 border-primary'
                              : 'bg-card border-border/70'
                          }`}
                        >
                          <View className="flex-row items-center gap-2.5 flex-1">
                            <View className="w-7 h-7 rounded-full bg-primary/10 items-center justify-center">
                              <User size={14} className="text-primary" />
                            </View>
                            <View className="flex-1">
                              <Text className={`text-xs font-semibold ${isResSelected ? 'text-primary' : 'text-foreground'}`}>
                                {resident.name}
                              </Text>
                              <Text className="text-[10px] text-muted-foreground">
                                {resident.type} {resident.phone ? `• ${resident.phone}` : ''}
                              </Text>
                            </View>
                          </View>
                          {isResSelected ? (
                            <Check size={14} className="text-primary" />
                          ) : (
                            <Text className="text-[10px] font-bold text-primary">Select Host</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <Button variant="outline" onPress={onClose} className="h-11 rounded-xl">
          <Text className="text-xs font-semibold text-foreground">Cancel</Text>
        </Button>
      </View>
    </BottomSheet>
  );
};

export default AdminVillaFilterSheet;

