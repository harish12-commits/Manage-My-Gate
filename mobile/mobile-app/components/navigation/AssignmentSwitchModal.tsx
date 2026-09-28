import React from 'react';
import { View, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { MapPin, DoorClosed, Building2, Home, Layers, Check, X } from 'lucide-react-native';
import { useAuth } from '../../src/features/auth/hooks/useAuth';
import {
  setActiveAssignment,
  setActiveVillaUnit,
  switchWorkspaceContextThunk,
} from '../../src/features/auth/store/authSlice';
import {
  fetchQuickActionsThunk,
  resetQuickActionsForContext,
} from '../../src/features/dashboard/dashboardSlice';
import { useTranslation } from '@/src/utils/i18n';

export interface AssignmentItem {
  id: string;
  name: string;
  type: 'gate' | 'facility' | 'villa' | 'general' | string;
  metadata?: Record<string, any>;
}

interface AssignmentSwitchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAssignment?: (asg: AssignmentItem) => void;
}

export const AssignmentSwitchModal: React.FC<AssignmentSwitchModalProps> = ({
  visible,
  onClose,
  onSelectAssignment,
}) => {
  const { user } = useAuth();
  const dispatch = useDispatch<any>();
  const { t } = useTranslation();

  const [pendingAssignment, setPendingAssignment] = React.useState<AssignmentItem | null>(null);
  const [isSwitching, setIsSwitching] = React.useState(false);

  const activeOrgId = (user as any)?.activeOrgId || (user as any)?.orgId;
  const activeRole = user?.role || (user as any)?.activeRole || '';
  const activeAssignment: AssignmentItem | null = (user as any)?.activeAssignment || null;

  // Extract available assignments for active role
  const assignments: AssignmentItem[] = React.useMemo(() => {
    if (!user) return [];
    const userAny = user as any;
    const rawList = userAny.availableAssignments || userAny.accessibleAssignments || [];
    if (!Array.isArray(rawList)) return [];

    return rawList.map((item: any) => {
      if (typeof item === 'string') {
        return { id: item, name: item, type: 'general' };
      }
      return {
        id: item.id || item._id || item.name || '',
        name: item.name || item.title || item.id || 'Unnamed Assignment',
        type: item.type || item.assignmentType || 'general',
        metadata: item.metadata || {},
      };
    });
  }, [user]);

  const getAssignmentIcon = (type: string, isSelected: boolean) => {
    const color = isSelected ? '#EA580C' : '#a1a1aa';
    const size = 18;
    switch (type?.toLowerCase()) {
      case 'gate':
        return <DoorClosed size={size} color={color} />;
      case 'facility':
        return <Building2 size={size} color={color} />;
      case 'villa':
        return <Home size={size} color={color} />;
      default:
        return <Layers size={size} color={color} />;
    }
  };

  const getAssignmentTypeLabel = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'gate':
        return t('assignment_type_gate', 'Security Gate');
      case 'facility':
        return t('assignment_type_facility', 'Amenity / Facility');
      case 'villa':
        return t('assignment_type_villa', 'Residence / Unit');
      default:
        return t('assignment_type_general', 'General Scope');
    }
  };

  const handleSelect = (item: AssignmentItem) => {
    if (activeAssignment && (activeAssignment.id === item.id || activeAssignment.name === item.name)) {
      onClose();
      return;
    }
    setPendingAssignment(item);
  };

  const handleConfirmSwitch = async () => {
    if (!pendingAssignment) return;
    const selected = pendingAssignment;
    setIsSwitching(true);

    try {
      // 1. Update active assignment locally in Redux
      dispatch(setActiveAssignment({ assignment: selected }));

      // If switching to a villa assignment, also update the active villa unit
      if (selected.type === 'villa') {
        dispatch(setActiveVillaUnit({ villaNumber: selected.name, villaId: selected.id }));
      }

      dispatch(resetQuickActionsForContext());

      // 2. Dispatch backend workspace context sync
      const switchPayload: any = {
        targetOrgId: activeOrgId,
        targetRole: activeRole,
        targetAssignmentId: selected.id,
        targetAssignmentName: selected.name,
        targetAssignmentType: selected.type,
      };

      await dispatch(switchWorkspaceContextThunk(switchPayload)).unwrap();

      // 3. Refresh quick actions for newly selected assignment
      dispatch(
        fetchQuickActionsThunk({
          orgId: activeOrgId,
          villaId: selected.type === 'villa' ? selected.id : ((user as any)?.activeVillaId || (user as any)?.villaId),
          villaNumber: selected.type === 'villa' ? selected.name : ((user as any)?.activeVillaNumber || (user as any)?.villaNumber),
        })
      );

      if (onSelectAssignment) onSelectAssignment(selected);
      setPendingAssignment(null);
      onClose();
    } catch (err) {
      console.warn('Failed to switch assignment context via backend, applying local selection:', err);
      if (onSelectAssignment) onSelectAssignment(selected);
      setPendingAssignment(null);
      onClose();
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-center items-center p-4">
        <View className="bg-card border border-border rounded-3xl w-full max-w-sm p-6 shadow-xl gap-3.5">
          {pendingAssignment ? (
            /* Inline Confirmation View */
            <View className="gap-4 py-1">
              <View className="items-center gap-2">
                <View className="bg-primary/10 border border-primary/20 p-3.5 rounded-2xl">
                  <MapPin size={26} color="#03A9F4" />
                </View>
                <Text className="text-base font-bold text-foreground text-center">
                  {t('confirm_switch_assignment_title', 'Switch Assignment / Scope?')}
                </Text>
                <Text className="text-xs text-muted-foreground text-center px-2">
                  {t('confirm_switch_assignment_msg', 'Are you sure you want to switch active assignment to')}{' '}
                  <Text className="font-bold text-foreground">{pendingAssignment.name}</Text>?
                </Text>
              </View>

              {/* Assignment Details */}
              <View className="bg-secondary/60 border border-border/80 rounded-2xl p-3.5 gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-muted-foreground">{t('assignment', 'Assignment')}</Text>
                  <Text className="text-xs font-bold text-foreground">{pendingAssignment.name}</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-muted-foreground">{t('type', 'Type')}</Text>
                  <Text className="text-xs font-semibold text-foreground">
                    {getAssignmentTypeLabel(pendingAssignment.type)}
                  </Text>
                </View>
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
                    setPendingAssignment(null);
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
            /* Assignments List View */
            <>
              {/* Header */}
              <View className="flex-row justify-between items-center pb-2 border-b border-border">
                <View className="flex-row items-center gap-2">
                  <View className="bg-primary/10 p-2 rounded-xl">
                    <MapPin size={20} color="#03A9F4" />
                  </View>
                  <Text className="text-lg font-bold text-foreground">
                    {t('switch_assignment', 'Switch Assignment')}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} activeOpacity={0.7} className="p-1.5 rounded-full bg-secondary">
                  <X size={16} className="text-muted-foreground" />
                </TouchableOpacity>
              </View>

              <Text className="text-xs text-muted-foreground">
                {t('select_assignment_sub', 'Select your active duty station, facility, or unit assignment:')}
              </Text>

              {/* Assignments List */}
              <ScrollView className="max-h-60">
                <View className="gap-2.5">
                  {assignments.length === 0 ? (
                    <View className="py-6 items-center justify-center">
                      <Text className="text-xs text-muted-foreground text-center">
                        {t('no_assignments_found', 'No specific assignments configured for this role.')}
                      </Text>
                    </View>
                  ) : (
                    assignments.map((item, idx) => {
                      const isSelected =
                        activeAssignment &&
                        (activeAssignment.id === item.id || activeAssignment.name === item.name);
                      const typeLabel = getAssignmentTypeLabel(item.type);

                      return (
                        <TouchableOpacity
                          key={`${item.id || item.name}-${idx}`}
                          onPress={() => handleSelect(item)}
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
                              {getAssignmentIcon(item.type, !!isSelected)}
                            </View>
                            <View>
                              <Text
                                className={`text-sm font-bold ${
                                  isSelected ? 'text-primary' : 'text-foreground'
                                }`}
                              >
                                {item.name}
                              </Text>
                              <Text className="text-[10px] text-muted-foreground">{typeLabel}</Text>
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

export default AssignmentSwitchModal;
