import React from 'react';
import { View, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useDispatch } from 'react-redux';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Check, X, UserCheck } from 'lucide-react-native';
import { useAuth } from '../../src/features/auth/hooks/useAuth';
import {
  setActiveRolePersona,
  switchWorkspaceContextThunk,
} from '../../src/features/auth/store/authSlice';
import {
  fetchQuickActionsThunk,
  resetQuickActionsForContext,
} from '../../src/features/dashboard/dashboardSlice';
import { useTranslation } from '@/src/utils/i18n';
import authService from '../../src/features/auth/services/authService';

interface RoleSwitchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectRole?: (role: string) => void;
}

interface RoleContextItem {
  roleId?: string | null;
  roleName: string;
  scopeType?: string;
  isAssigned?: boolean;
  units?: any[];
}

export const RoleSwitchModal: React.FC<RoleSwitchModalProps> = ({ visible, onClose, onSelectRole }) => {
  const { user } = useAuth();
  const dispatch = useDispatch<any>();
  const { t, tRole } = useTranslation();

  const [pendingRole, setPendingRole] = React.useState<string | null>(null);
  const [isSwitching, setIsSwitching] = React.useState(false);
  const [isLoadingContext, setIsLoadingContext] = React.useState(false);
  const [backendRoles, setBackendRoles] = React.useState<RoleContextItem[]>([]);

  const activeOrgId = (user as any)?.activeOrgId || (user as any)?.orgId;
  const activeRole = user?.role || (user as any)?.activeRole || '';

  // Synchronous fallback derived strictly from active workspace in availableWorkspaces
  const syncRoleNames: string[] = React.useMemo(() => {
    if (!user) return [];
    const userAny = user as any;
    const wsList = userAny.availableWorkspaces || [];
    const currentWs = wsList.find((w: any) => {
      const wId = w.orgId || w._id || w.id;
      return activeOrgId && wId ? wId.toString() === activeOrgId.toString() : false;
    });

    if (currentWs?.roles && Array.isArray(currentWs.roles) && currentWs.roles.length > 0) {
      return Array.from(new Set(currentWs.roles.filter((r: any): r is string => Boolean(r && typeof r === 'string'))));
    }
    if (userAny.roles && Array.isArray(userAny.roles) && userAny.orgId === activeOrgId) {
      return Array.from(new Set(userAny.roles.filter((r: any): r is string => Boolean(r && typeof r === 'string'))));
    }
    return user?.role ? [user.role] : [];
  }, [user, activeOrgId]);

  // Fetch active user assigned role context from backend whenever modal opens
  React.useEffect(() => {
    let isMounted = true;
    if (visible && activeOrgId) {
      setIsLoadingContext(true);
      authService
        .getCurrentContext(activeOrgId)
        .then((res: any) => {
          if (!isMounted) return;
          const body = res?.data?.data || res?.data || res;
          const roles = body?.roles;
          if (Array.isArray(roles) && roles.length > 0) {
            setBackendRoles(roles);
          }
        })
        .catch((err) => {
          console.warn('Could not fetch active roles from getCurrentContext, using workspace roles:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingContext(false);
        });
    } else if (!visible) {
      setBackendRoles([]);
    }
    return () => {
      isMounted = false;
    };
  }, [visible, activeOrgId]);

  // Combined roles list: prioritize backend data, fallback to strictly filtered sync roles
  const roles: RoleContextItem[] = React.useMemo(() => {
    if (backendRoles.length > 0) {
      return backendRoles;
    }
    return syncRoleNames.map((name) => {
      const isResident = /resident|tenant|owner|family/i.test(name);
      const isSecurity = /guard|security/i.test(name);
      const isFacility = /facility|amenity|staff|maintenance/i.test(name);
      let scopeType = 'ORGANISATION';
      if (isResident) scopeType = 'VILLA';
      else if (isSecurity) scopeType = 'GATE';
      else if (isFacility) scopeType = 'FACILITY';
      return {
        roleId: null,
        roleName: name,
        scopeType,
        isAssigned: true,
        units: [],
      };
    });
  }, [backendRoles, syncRoleNames]);

  const handleSelectRole = (selectedRole: string) => {
    if (selectedRole === activeRole) {
      onClose();
      return;
    }
    setPendingRole(selectedRole);
  };

  const handleConfirmSwitch = async () => {
    if (!pendingRole) return;
    const selectedRole = pendingRole;
    setIsSwitching(true);
    try {
      // 1. Update active role persona locally in Redux
      dispatch(setActiveRolePersona({ role: selectedRole }));
      dispatch(resetQuickActionsForContext());

      // 2. Dispatch backend workspace context sync
      const switchPayload: { targetOrgId?: string; targetRole?: string } = {};
      if (activeOrgId && typeof activeOrgId === 'string' && /^[0-9a-fA-F]{24}$/.test(activeOrgId.trim())) {
        switchPayload.targetOrgId = activeOrgId.trim();
      }
      if (selectedRole && typeof selectedRole === 'string' && selectedRole.trim()) {
        switchPayload.targetRole = selectedRole.trim();
      }
      await dispatch(switchWorkspaceContextThunk(switchPayload)).unwrap();

      // 3. Refresh quick actions for newly selected role
      dispatch(
        fetchQuickActionsThunk({
          orgId: activeOrgId,
          villaId: (user as any)?.activeVillaId || (user as any)?.villaId,
          villaNumber: (user as any)?.activeVillaNumber || (user as any)?.villaNumber,
        })
      );

      if (onSelectRole) onSelectRole(selectedRole);
      setPendingRole(null);
      onClose();
    } catch (err) {
      console.warn('Failed to switch role context via backend, applying local selection:', err);
      if (onSelectRole) onSelectRole(selectedRole);
      setPendingRole(null);
      onClose();
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-center items-center p-4">
        <View className="bg-card border border-border rounded-3xl w-full max-w-sm p-6 shadow-xl gap-3.5">
          {pendingRole ? (
            /* Inline Confirmation View */
            <View className="gap-4 py-1">
              <View className="items-center gap-2">
                <View className="bg-primary/10 border border-primary/20 p-3.5 rounded-2xl">
                  <ShieldCheck size={26} color="#03A9F4" />
                </View>
                <Text className="text-base font-bold text-foreground text-center">
                  {t('confirm_switch_role_title', 'Switch Role Persona?')}
                </Text>
                <Text className="text-xs text-muted-foreground text-center px-2">
                  {t('confirm_switch_role_msg', 'Are you sure you want to switch to')}{' '}
                  <Text className="font-bold text-foreground">{tRole(pendingRole, pendingRole)}</Text>?
                </Text>
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
                    setPendingRole(null);
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
            /* Roles List View */
            <>
              {/* Header */}
              <View className="flex-row justify-between items-center pb-2 border-b border-border">
                <View className="flex-row items-center gap-2">
                  <View className="bg-primary/10 p-2 rounded-xl">
                    <ShieldCheck size={20} color="#03A9F4" />
                  </View>
                  <Text className="text-lg font-bold text-foreground">{t('switch_role', 'Switch Role Context')}</Text>
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
                {t('select_role_persona_sub', 'Select an active role persona to customize your mobile tools & permissions:')}
              </Text>

              {/* Roles List */}
              <ScrollView className="max-h-60">
                <View className="gap-2.5">
                  {isLoadingContext && roles.length === 0 ? (
                    <View className="py-8 items-center justify-center gap-2">
                      <ActivityIndicator size="small" color="#03A9F4" />
                      <Text className="text-xs text-muted-foreground">
                        {t('loading_roles', 'Loading assigned roles...')}
                      </Text>
                    </View>
                  ) : roles.length === 0 ? (
                    <View className="py-6 items-center justify-center">
                      <Text className="text-xs text-muted-foreground text-center">
                        {t('no_roles_found', 'No roles assigned to this account in the current organisation.')}
                      </Text>
                    </View>
                  ) : (
                    roles.map((item, idx) => {
                      const roleName = item.roleName;
                      const isSelected = roleName === activeRole;
                      const localizedRole = tRole(roleName, roleName);

                      let scopeSubtitle = tRole(roleName, `${roleName} Role`);
                      if (item.scopeType === 'ORGANISATION') {
                        scopeSubtitle = t('org_level_access', 'Organisation-level access');
                      } else if (item.scopeType === 'VILLA') {
                        if (item.units && item.units.length > 0) {
                          scopeSubtitle = item.units.map((u: any) => u.villaNumber ? `${t('villa', 'Villa')} ${u.villaNumber}` : u.block).filter(Boolean).join(', ') || t('unit_level_access', 'Property Unit access');
                        } else {
                          scopeSubtitle = t('unit_level_access', 'Property Unit access');
                        }
                      } else if (item.scopeType === 'GATE') {
                        scopeSubtitle = t('gate_level_access', 'Gate security access');
                      } else if (item.scopeType === 'FACILITY') {
                        scopeSubtitle = t('facility_level_access', 'Facility management access');
                      }

                      return (
                        <TouchableOpacity
                          key={`${roleName}-${idx}`}
                          onPress={() => handleSelectRole(roleName)}
                          activeOpacity={0.8}
                          className={`flex-row items-center justify-between p-3.5 rounded-2xl border shadow-xs ${
                            isSelected
                              ? 'bg-primary/10 border-primary/40'
                              : 'bg-card border-border/80 active:bg-secondary/50'
                          }`}
                        >
                          <View className="flex-row items-center gap-3">
                            <View
                              className={`p-2 rounded-xl border ${
                                isSelected ? 'bg-primary/20 border-primary/30' : 'bg-secondary border-border/50'
                              }`}
                            >
                              <UserCheck
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
                                {localizedRole}
                              </Text>
                              <Text className="text-[10px] text-muted-foreground">
                                {scopeSubtitle}
                              </Text>
                            </View>
                          </View>

                          {isSelected && <Check size={18} className="text-primary" />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </ScrollView>

              <Button onPress={onClose} variant="secondary" className="mt-2 h-11">
                <Text className="font-bold text-foreground text-sm">{t('cancel', 'Cancel')}</Text>
              </Button>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default RoleSwitchModal;
