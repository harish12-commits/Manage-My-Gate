import React from 'react';
import { View, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Home, Check, X, Building2 } from 'lucide-react-native';

import { useDispatch, useSelector } from 'react-redux';
import { switchWorkspaceContextThunk, setActiveUnitContext } from '../../src/features/auth/store/authSlice';
import { fetchQuickActionsThunk, resetQuickActionsForContext } from '../../src/features/dashboard/dashboardSlice';

import { useAuth } from '../../src/features/auth/hooks/useAuth';
import { useTranslation } from '@/src/utils/i18n';

interface VillaUnit {
  id: string;
  unitNumber: string;
  block?: string;
  residencyType?: string;
}

interface VillaSwitchModalProps {
  visible: boolean;
  onClose: () => void;
  activeVilla: string;
  onSelectVilla: (villaNumber: string) => void;
  communityName?: string;
  onOpenOrgModal?: () => void;
}

// Purely dynamic user units interface
export const VillaSwitchModal: React.FC<VillaSwitchModalProps> = ({
  visible,
  onClose,
  activeVilla,
  onSelectVilla,
  communityName = '',
  onOpenOrgModal,
}) => {
  const { user } = useAuth();
  const dispatch = useDispatch<any>();
  const { t, tRole } = useTranslation();
  const reduxWorkspaces = useSelector((state: any) => state.auth?.user?.availableWorkspaces || state.workspace?.availableWorkspaces);

  const activeOrgId = (user as any)?.orgId || (user as any)?.activeOrgId;
  const activeVillaId = (user as any)?.villaId;


  const userUnits: VillaUnit[] = React.useMemo(() => {
    const userAny = user as any;
    const roleLower = (userAny?.role || (Array.isArray(userAny?.roles) ? userAny?.roles[0] : '') || '').toLowerCase();
    const isResidentRole = /resident|tenant|owner|family/i.test(roleLower);

    // Strictly resident roles have villa units
    if (!isResidentRole) {
      return [];
    }

    const unitsMap = new Map<string, VillaUnit>();

    // 1. Extract from accessibleUnits
    if (userAny?.accessibleUnits && Array.isArray(userAny.accessibleUnits)) {
      userAny.accessibleUnits.forEach((u: any, idx: number) => {
        const uOrg = u.orgId || u.organizationId;
        if (activeOrgId && uOrg && uOrg !== activeOrgId) return;
        const uId = u.villaId || u.id || String(idx + 1);
        const uNum = u.villaNumber || u.unitNumber;
        if (uNum) {
          unitsMap.set(uId, {
            id: uId,
            unitNumber: uNum,
            block: u.block || u.villaBlock || '',
            residencyType: u.residentType || u.residencyType || 'Resident',
          });
        }
      });
    }

    // 2. Extract from availableWorkspaces matching current active organization ONLY if resident role
    const workspaces = userAny?.availableWorkspaces || reduxWorkspaces;
    if (Array.isArray(workspaces)) {
      workspaces.forEach((w: any, idx: number) => {
        const matchesOrg = !activeOrgId || w.orgId === activeOrgId || w._id === activeOrgId;
        const wsHasResident = (w.roles && Array.isArray(w.roles) && w.roles.some((r: string) => /resident|tenant|owner|family/i.test(r))) ||
          /resident|tenant|owner|family/i.test(w.roleName || '');
        if (matchesOrg && wsHasResident && (w.villaId || w.unitId || w.villaNumber || w.unitNumber)) {
          const uId = w.villaId || w.unitId || `ws-unit-${idx}`;
          const uNum = w.villaNumber || w.unitNumber;
          if (uNum && !unitsMap.has(uId)) {
            unitsMap.set(uId, {
              id: uId,
              unitNumber: uNum,
              block: w.block || w.villaBlock || '',
              residencyType: w.residentType || 'Resident',
            });
          }
        }
      });
    }

    return Array.from(unitsMap.values());
  }, [user, reduxWorkspaces, activeOrgId]);

  const handleSelect = (unit: VillaUnit) => {
    // 1. Reset quick actions and set active unit context
    dispatch(resetQuickActionsForContext());

    dispatch(
      setActiveUnitContext({
        villaId: unit.id,
        villaNumber: unit.unitNumber,
        orgId: activeOrgId,
      })
    );

    // 2. Dispatch backend workspace switch if valid ObjectId
    const payload: any = {};
    if (unit.id && /^[0-9a-fA-F]{24}$/.test(unit.id)) {
      payload.targetVillaId = unit.id;
    }
    if (activeOrgId && /^[0-9a-fA-F]{24}$/.test(activeOrgId)) {
      payload.targetOrgId = activeOrgId;
    }
    if (Object.keys(payload).length > 0) {
      dispatch(switchWorkspaceContextThunk(payload));
    }

    dispatch(
      fetchQuickActionsThunk({
        orgId: activeOrgId,
        villaId: unit.id,
        villaNumber: unit.unitNumber,
      })
    );

    onSelectVilla(unit.unitNumber);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-center items-center p-4">
        <View className="bg-card border border-border rounded-3xl w-full max-w-sm p-6 shadow-xl gap-3.5">
          {/* Header */}
          <View className="flex-row justify-between items-center pb-2 border-b border-border">
            <View className="flex-row items-center gap-2">
              <View className="bg-primary/10 p-2 rounded-xl">
                <Home size={20} color="#03A9F4" />
              </View>
              <Text className="text-lg font-bold text-foreground">{t('switch_unit', 'Switch Villa Unit')}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              className="h-11 w-11 items-center justify-center rounded-full bg-secondary active:bg-muted"
              accessibilityRole="button"
              accessibilityLabel={t('close', 'Close')}
            >
              <X size={16} className="text-muted-foreground" />
            </TouchableOpacity>
          </View>


          <Text className="text-xs text-muted-foreground">
            {t('select_property_unit_context', 'Select a property unit context in')} <Text className="font-bold text-foreground">{communityName}</Text>:
          </Text>

          {/* Villa Units List */}
          <ScrollView className="max-h-60" showsVerticalScrollIndicator={false}>
            <View className="gap-2.5">
              {userUnits.length > 0 ? (
                userUnits.map((unit, index) => {
                  const isUnitIdMatch = Boolean(activeVillaId && unit.id && activeVillaId === unit.id);
                  const isUnitNumberMatch = unit.unitNumber === activeVilla;
                  const isBlockMatch = !unit.block || !(user as any)?.villaBlock || unit.block === (user as any)?.villaBlock;
                  const isRoleMatch = !unit.residencyType || !(user as any)?.residentType || unit.residencyType === (user as any)?.residentType;
                  const isSelected = isUnitIdMatch || (isUnitNumberMatch && isBlockMatch && isRoleMatch);
                  return (
                    <TouchableOpacity
                      key={`${unit.id || 'unit'}-${index}`}
                      onPress={() => handleSelect(unit)}
                      activeOpacity={0.8}
                      className={`flex-row items-center justify-between p-3.5 rounded-2xl border shadow-xs ${
                        isSelected
                          ? 'bg-primary/10 border-primary/40'
                          : 'bg-card border-border/80 active:bg-secondary/50'
                      }`}
                    >
                      <View className="flex-row items-center gap-3">
                        <View
                          className={`p-2.5 rounded-xl border ${
                            isSelected ? 'bg-primary/20 border-primary/30' : 'bg-secondary border-border/50'
                          }`}
                        >
                          <Building2
                            size={18}
                            color={isSelected ? '#EA580C' : '#a1a1aa'}
                          />
                        </View>
                        <View>
                          <Text
                            className={`text-sm font-bold ${
                              isSelected ? 'text-primary' : 'text-foreground'
                            }`}
                          >
                            {unit.unitNumber}
                          </Text>
                          <Text className="text-[10px] text-muted-foreground">
                            {unit.block ? `${unit.block} • ` : ''}{tRole(unit.residencyType, unit.residencyType)}
                          </Text>
                        </View>
                      </View>

                      {isSelected && <Check size={18} className="text-primary" />}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View className="bg-secondary/40 border border-dashed border-border/80 rounded-2xl p-5 items-center justify-center gap-1.5 my-2">
                  <Home size={24} className="text-muted-foreground" />
                  <Text className="text-xs font-bold text-foreground text-center">
                    {t('no_unit_assigned_title', 'No Unit Assigned')}
                  </Text>
                  <Text className="text-[10px] text-muted-foreground text-center">
                    {t('no_unit_assigned_sub', 'Your profile is not assigned to a property unit in this workspace.')}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {onOpenOrgModal && Array.isArray(reduxWorkspaces) && reduxWorkspaces.length > 1 && (
            <TouchableOpacity
              onPress={() => {
                onClose();
                setTimeout(() => {
                  if (onOpenOrgModal) onOpenOrgModal();
                }, 250);
              }}
              activeOpacity={0.8}
              className="flex-row items-center justify-between p-3 rounded-2xl bg-secondary/80 border border-border/80"
            >
              <View className="flex-row items-center gap-2">
                <Building2 size={16} color="#6366f1" />
                <Text className="text-xs font-bold text-foreground">{t('switch_community', 'Switch Community / Workspace')}</Text>
              </View>
              <Text className="text-[11px] font-bold text-primary">{t('switch', 'Switch')}</Text>
            </TouchableOpacity>
          )}

          <Button onPress={onClose} variant="secondary" className="h-11">
            <Text className="font-bold text-foreground text-sm">{t('cancel', 'Cancel')}</Text>
          </Button>
        </View>
      </View>

    </Modal>
  );
};

export default VillaSwitchModal;
