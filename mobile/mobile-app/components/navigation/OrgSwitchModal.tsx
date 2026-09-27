import React from 'react';
import { View, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Building2, Check, X, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useDispatch, useSelector } from 'react-redux';
import {
  setActiveCommunityOrg,
  setActiveRolePersona,
  setActiveVillaUnit,
  switchWorkspaceContextThunk,
} from '../../src/features/auth/store/authSlice';
import { fetchQuickActionsThunk, resetQuickActionsForContext } from '../../src/features/dashboard/dashboardSlice';
import { useAuth } from '../../src/features/auth/hooks/useAuth';
import { useTranslation } from '@/src/utils/i18n';

export interface WorkspaceItem {
  orgId: string;
  name: string;
  roleName?: string;
  isPlatform?: boolean;
  villaId?: string;
  villaNumber?: string;
}

interface OrgSwitchModalProps {
  visible: boolean;
  onClose: () => void;
  activeCommunity: string;
  onSelectCommunity: (orgName: string, orgId: string) => void;
}

export const CANONICAL_COMMUNITIES: WorkspaceItem[] = [];
export const OrgSwitchModal: React.FC<OrgSwitchModalProps> = ({
  visible,
  onClose,
  activeCommunity,
  onSelectCommunity,
}) => {
  const { user } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch<any>();
  const { t, tRole } = useTranslation();
  const reduxWorkspaces = useSelector((state: any) => state.auth?.user?.availableWorkspaces || state.workspace?.availableWorkspaces);

  const activeOrgId = (user as any)?.orgId || (user as any)?.activeOrgId;
  const activeRole = user?.role || (user as any)?.activeRole;

  const [pendingOrg, setPendingOrg] = React.useState<WorkspaceItem | null>(null);
  const [isSwitching, setIsSwitching] = React.useState(false);

  const workspacesList: WorkspaceItem[] = React.useMemo(() => {
    const list = reduxWorkspaces || (user as any)?.availableWorkspaces;
    if (list && Array.isArray(list) && list.length > 0) {
      return list.map((w: any) => ({
        orgId: w.orgId || w._id,
        name: w.name || w.organizationName || w.orgName || w.communityOrg || (w.isPlatform ? 'System Platform' : 'Community Workspace'),
        roleName: w.roleName || (w.roles ? w.roles.join(', ') : 'Admin'),
        isPlatform: w.isPlatform || false,
        villaId: w.villaId || w.unitId,
        villaNumber: w.villaNumber || w.unitNumber,
      }));
    }
    return [];
  }, [reduxWorkspaces, user]);

  const handleSelect = (ws: WorkspaceItem) => {
    if (ws.orgId === activeOrgId) {
      onClose();
      return;
    }
    setPendingOrg(ws);
  };

  const handleConfirmSwitch = async () => {
    if (!pendingOrg) return;
    const ws = pendingOrg;
    setIsSwitching(true);

    try {
      // 1. Reset quick actions and update active context locally in Redux
      dispatch(resetQuickActionsForContext());
      const targetRole = ws.roleName ? ws.roleName.split(',')[0].trim() : undefined;
      
      dispatch(setActiveCommunityOrg({ orgId: ws.orgId, orgName: ws.name }));
      if (targetRole) {
        dispatch(setActiveRolePersona({ role: targetRole }));
      }
      if (ws.villaNumber) {
        dispatch(setActiveVillaUnit({ villaNumber: ws.villaNumber, villaId: ws.villaId }));
      }

      // 2. Notify parent callback & close modal
      onSelectCommunity(ws.name, ws.orgId);
      setPendingOrg(null);
      onClose();

      // 3. Dispatch backend workspace context sync in background
      try {
        const payload: any = { targetOrgId: ws.orgId };
        if (targetRole) payload.targetRole = targetRole;
        if (ws.villaId && /^[0-9a-fA-F]{24}$/.test(ws.villaId)) {
          payload.targetVillaId = ws.villaId;
        }
        await dispatch(switchWorkspaceContextThunk(payload));
      } catch (e) {
        console.warn('Background workspace context sync error:', e);
      }

      dispatch(
        fetchQuickActionsThunk({
          orgId: ws.orgId,
          villaId: ws.villaId,
          villaNumber: ws.villaNumber,
        })
      );
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-center items-center p-4">
        <View className="bg-card border border-border rounded-3xl w-full max-w-sm p-6 shadow-xl gap-3.5">
          {pendingOrg ? (
            /* Inline Confirmation View */
            <View className="gap-4 py-1">
              <View className="items-center gap-2">
                <View className="bg-indigo-500/15 border border-indigo-500/25 p-3.5 rounded-2xl">
                  <Building2 size={26} color="#6366f1" />
                </View>
                <Text className="text-base font-bold text-foreground text-center">
                  {t('confirm_switch_org_title', 'Switch Community Workspace?')}
                </Text>
                <Text className="text-xs text-muted-foreground text-center px-2">
                  {t('confirm_switch_org_msg', 'Are you sure you want to switch to')}{' '}
                  <Text className="font-bold text-foreground">{pendingOrg.name}</Text>?
                </Text>
              </View>

              {/* Summary Details */}
              <View className="bg-secondary/60 border border-border/80 rounded-2xl p-3.5 gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-muted-foreground">{t('community', 'Community')}</Text>
                  <Text className="text-xs font-bold text-foreground">{pendingOrg.name}</Text>
                </View>
                {pendingOrg.roleName ? (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted-foreground">{t('role', 'Role')}</Text>
                    <Text className="text-xs font-semibold text-foreground">
                      {tRole(pendingOrg.roleName, pendingOrg.roleName)}
                    </Text>
                  </View>
                ) : null}
                {pendingOrg.villaNumber ? (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted-foreground">{t('unit_label', 'Unit')}</Text>
                    <Text className="text-xs font-semibold text-foreground">{pendingOrg.villaNumber}</Text>
                  </View>
                ) : null}
              </View>

              <View className="gap-2 pt-1">
                <Button
                  onPress={handleConfirmSwitch}
                  loading={isSwitching}
                  className="h-11 bg-primary"
                >
                  <Text className="font-bold text-primary-foreground text-sm">
                    {t('yes_switch', 'Yes, Switch')}
                  </Text>
                </Button>
                <Button
                  onPress={() => {
                    if (isSwitching) return;
                    setPendingOrg(null);
                  }}
                  variant="secondary"
                  className="h-11"
                  disabled={isSwitching}
                >
                  <Text className="font-bold text-foreground text-sm">
                    {t('no_cancel', 'No, Cancel')}
                  </Text>
                </Button>
              </View>
            </View>
          ) : (
            /* Workspaces List View */
            <>
              {/* Header */}
              <View className="flex-row justify-between items-center pb-2.5 border-b border-border/80">
                <View className="flex-row items-center gap-2">
                  <View className="bg-indigo-500/15 border border-indigo-500/25 p-2 rounded-xl">
                    <Building2 size={19} color="#6366f1" />
                  </View>
                  <Text className="text-lg font-bold text-foreground">{t('switch_community', 'Switch Community')}</Text>
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
                {t('select_community_org_sub', 'Select a community organization to switch your workspace context:')}
              </Text>

              {/* Workspaces List */}
              <ScrollView className="max-h-60" showsVerticalScrollIndicator={false}>
                <View className="gap-2.5">
                  {workspacesList.length === 0 ? (
                    <View className="py-6 items-center justify-center">
                      <Text className="text-xs text-muted-foreground text-center">
                        {t('no_workspaces_found', 'No other community workspaces found for this account.')}
                      </Text>
                    </View>
                  ) : (
                    workspacesList.map((ws, index) => {
                    const isOrgMatch = ws.orgId ? ws.orgId === activeOrgId : ws.name === activeCommunity;
                    const isRoleMatch = !ws.roleName || !activeRole || 
                      ws.roleName.toLowerCase().includes(activeRole.toLowerCase()) || 
                      activeRole.toLowerCase().includes(ws.roleName.toLowerCase());
                    const isSelected = isOrgMatch && isRoleMatch;

                    return (
                      <TouchableOpacity
                        key={`${ws.orgId || 'ws'}-${ws.roleName || ''}-${index}`}
                        onPress={() => handleSelect(ws)}
                        activeOpacity={0.8}
                        className={`flex-row items-center justify-between p-3.5 rounded-2xl border shadow-xs ${
                          isSelected
                            ? 'bg-primary/10 border-primary/40'
                            : 'bg-card border-border/80 active:bg-secondary/50'
                        }`}
                      >
                        <View className="flex-row items-center gap-3 flex-1">
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
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2">
                              <Text
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                className={`text-sm font-bold flex-1 ${
                                  isSelected ? 'text-primary font-extrabold' : 'text-foreground'
                                }`}
                              >
                                {ws.name}
                              </Text>
                              {ws.isPlatform && (
                                <View className="bg-primary/15 border border-primary/25 px-1.5 py-0.5 rounded-md">
                                  <Text className="text-primary text-[9px] font-bold">{t('platform_badge', 'Platform')}</Text>
                                </View>
                              )}
                            </View>
                            <Text className="text-[10px] text-muted-foreground mt-0.5">
                              {t('role_label_prefix', 'Role:')} {tRole(ws.roleName, ws.roleName || 'Member')}{ws.villaNumber ? ` • ${t('unit_label', 'Unit')} ${ws.villaNumber}` : ''}
                            </Text>
                          </View>
                        </View>

                        {isSelected && <Check size={18} className="text-primary" />}
                      </TouchableOpacity>
                    );
                  }))}
                </View>
              </ScrollView>

              {/* Create New Organization CTA */}
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/(auth)/setup-organization' as any,
                    params: { intent: 'create-org', canGoBack: 'true' },
                  });
                }}
                activeOpacity={0.8}
                className="flex-row min-h-11 items-center justify-center p-3 rounded-2xl border border-dashed border-primary/50 bg-primary/5 active:bg-primary/10 mt-1 gap-2"
                accessibilityRole="button"
                accessibilityLabel={t('create_new_organization', '+ Create New Organization')}
              >
                <Plus size={16} color="#03A9F4" />
                <Text className="text-xs font-bold text-primary">
                  {t('create_new_organization', '+ Create New Organization')}
                </Text>
              </TouchableOpacity>

              <Button onPress={onClose} variant="secondary" className="mt-1 h-11">
                <Text className="font-bold text-foreground text-sm">{t('cancel', 'Cancel')}</Text>
              </Button>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default OrgSwitchModal;
