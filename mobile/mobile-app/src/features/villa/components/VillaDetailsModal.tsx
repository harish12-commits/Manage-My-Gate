import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/forms/TextInput';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { Icon } from '@/components/ui/icon';
import { UserCheck, Mail, UserPlus, Shield, Check, Edit2, Trash2 } from 'lucide-react-native';
import { Villa } from '../store/villaSlice';
import useVilla from '../hooks/useVilla';
import { fetchUsers, inviteUser, UserData } from '@/src/features/userManagement/services/userService';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { ContactPickerButton } from '@/components/forms/ContactPickerButton';
import { validatePhone } from '@/src/utils/validation';

interface VillaDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  villa: Villa | null;
  onEdit?: (villa: Villa) => void;
  onDelete?: (villa: Villa) => void;
}

export const VillaDetailsModal: React.FC<VillaDetailsModalProps> = ({
  visible,
  onClose,
  villa,
  onEdit,
  onDelete,
}) => {
  const { assignResident, setPrimary, updateResidency, unassignResident, actionLoading } = useVilla();

  // Tab State: 1 = Assign Existing, 2 = Invite via Email
  const [activeTab, setActiveTab] = useState<1 | 2>(1);

  // Workspace Users List
  const [workspaceUsers, setWorkspaceUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Form State: Assign Existing (Tab 1)
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignResidencyType, setAssignResidencyType] = useState('Tenant');
  const [isPrimaryCheck, setIsPrimaryCheck] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Form State: Invite via Email (Tab 2)
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteResidencyType, setInviteResidencyType] = useState('Tenant');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Inline Residency Type Editor State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editResidencyTypeVal, setEditResidencyTypeVal] = useState('Tenant');

  // Confirmation Modals State
  const [residentToDelete, setResidentToDelete] = useState<{ id: string; nameOrEmail: string } | null>(null);
  const [deleteResidentLoading, setDeleteResidentLoading] = useState(false);
  const [showDeleteUnitConfirm, setShowDeleteUnitConfirm] = useState(false);

  useEffect(() => {
    if (visible) {
      loadWorkspaceUsers();
      setAssignError(null);
      setAssignSuccess(null);
      setInviteError(null);
      setInviteSuccess(null);
      setEditingUserId(null);
    }
  }, [visible]);

  const loadWorkspaceUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetchUsers({ limit: 100 });
      const docs = res?.users || res?.docs || res?.data || (Array.isArray(res) ? res : []);
      setWorkspaceUsers(Array.isArray(docs) ? docs : []);
    } catch (e) {
      console.log('[VillaDetailsModal] Failed to fetch workspace users:', e);
    } finally {
      setUsersLoading(false);
    }
  };

  if (!visible || !villa) return null;

  // Handle Assign Existing
  const handleAssignExisting = async () => {
    if (!selectedUserId) {
      setAssignError('Please select a user from the dropdown.');
      return;
    }
    setAssignError(null);
    setAssignSuccess(null);
    try {
      await assignResident(villa._id, selectedUserId, assignResidencyType, isPrimaryCheck);
      setAssignSuccess('Resident assigned successfully!');
      setSelectedUserId('');
      setIsPrimaryCheck(false);
    } catch (err: any) {
      const errMsg = typeof err === 'string' ? err : (err?.message || 'Failed to assign resident');
      setAssignError(errMsg);
    }
  };

  // Handle Invite via Email
  const handleInviteResident = async () => {
    if (!inviteEmail.trim()) {
      setInviteError('Please enter a valid email address.');
      return;
    }
    if (!invitePhone.trim() || !validatePhone(invitePhone).isValid) {
      setInviteError('Please enter a valid phone number.');
      return;
    }
    setInviteError(null);
    setInviteSuccess(null);

    // Map dropdown residency type values to exact database role names
    const roleMapping: Record<string, string> = {
      'Tenant': 'Resident Tenant',
      'Resident Owner': 'Resident Owner',
      'Family': 'Family Member'
    };
    const resolvedRoleName = roleMapping[inviteResidencyType] || inviteResidencyType;

    try {
      await inviteUser({
        email: inviteEmail.trim(),
        phone: invitePhone.trim(),
        villaId: villa._id,
        residentType: inviteResidencyType,
        roleName: resolvedRoleName,
      });
      setInviteSuccess(`Invitation sent successfully to ${inviteEmail}!`);
      setInviteEmail('');
      setInvitePhone('');
    } catch (err: any) {
      const errMsg = typeof err === 'string' ? err : (err?.message || 'Failed to send resident invitation');
      setInviteError(errMsg);
    }
  };

  // Handle Inline Residency Type Update
  const handleSaveResidencyType = async (userId: string) => {
    try {
      await updateResidency(villa._id, userId, editResidencyTypeVal);
      setEditingUserId(null);
    } catch (err: any) {
      const errMsg = typeof err === 'string' ? err : (err?.message || 'Failed to update residency type');
      setAssignError(errMsg);
    }
  };

  // Handle Toggle Primary Resident
  const handleTogglePrimary = async (userId: string, currentIsPrimary?: boolean) => {
    try {
      await setPrimary(villa._id, currentIsPrimary ? null : userId);
    } catch (err: any) {
      const errMsg = typeof err === 'string' ? err : (err?.message || 'Failed to update primary resident');
      setAssignError(errMsg);
    }
  };

  // Handle Remove Resident
  const handleUnassign = async (userId: string) => {
    try {
      await unassignResident(villa._id, userId);
    } catch (err: any) {
      const errMsg = typeof err === 'string' ? err : (err?.message || 'Failed to remove resident');
      setAssignError(errMsg);
    }
  };

  const areaSqFt = villa.floorAreaSqFt || villa.squareFeetArea;
  const rawBlock = villa.blockOrBuilding?.trim();
  const blockDisplay = rawBlock
    ? rawBlock.toLowerCase().startsWith('block') || rawBlock.toLowerCase().startsWith('tower')
      ? rawBlock
      : `Block ${rawBlock}`
    : 'Main Block';

  // Filter available users not already assigned
  const availableUsers = workspaceUsers.filter((u) => {
    const uid = u._id || u.id;
    return !villa.residents?.some((r: any) => {
      const rid = typeof r.userId === 'object' ? r.userId?._id : r.userId;
      return String(rid) === String(uid);
    });
  });

  const userDropdownOptions = availableUsers.map((u) => ({
    label: `${u.name || u.email} (${u.email})`,
    value: u._id || u.id,
  }));

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Unit ${villa.unitNumber} Management`}>
      <View className="py-1">
        <View className="space-y-4">
          {/* Top Metadata Box */}
          <View className="bg-muted/50 p-3.5 rounded-xl border border-border space-y-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-muted-foreground uppercase">Status</Text>
              <StatusBadge
                label={villa.status || 'Vacant'}
                variant={
                  villa.status === 'Occupied'
                    ? 'success'
                    : villa.status === 'Under Maintenance'
                    ? 'warning'
                    : 'neutral'
                }
              />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-muted-foreground uppercase">Block / Building</Text>
              <Text className="text-sm font-bold text-foreground">{blockDisplay}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-muted-foreground uppercase">Floor Level</Text>
              <Text className="text-sm font-bold text-foreground">
                {villa.floor !== undefined && villa.floor !== null && String(villa.floor).trim() !== ''
                  ? `Floor ${villa.floor}`
                  : 'Ground Floor'}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-muted-foreground uppercase">Floor Area</Text>
              <Text className="text-sm font-bold text-foreground">
                {areaSqFt ? `${areaSqFt} sq.ft` : 'N/A'}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-muted-foreground uppercase">Unit Type</Text>
              <Text className="text-sm font-bold text-foreground">{villa.type || 'Apartment'}</Text>
            </View>
            {villa.primaryResident && (
              <View className="flex-row items-center justify-between pt-1 border-t border-border/40 mt-1">
                <Text className="text-xs font-semibold text-muted-foreground uppercase">Primary Owner</Text>
                <Text className="text-sm font-bold text-primary">
                  {villa.primaryResident.name || villa.primaryResident.email || 'Assigned'}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View className="flex-row items-center gap-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-blue-600 bg-blue-500/10"
                onPress={() => {
                  onClose();
                  onEdit(villa);
                }}
              >
                <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">Edit Unit</Text>
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 bg-red-600 active:bg-red-700"
                onPress={() => setShowDeleteUnitConfirm(true)}
              >
                <Text className="text-xs font-bold text-white">Delete Unit</Text>
              </Button>
            )}
          </View>

          {/* Resident Directory & Assignment Section */}
          <View className="pt-3 border-t border-border space-y-3">
            <Text className="text-base font-bold text-foreground">
              Assigned Residents ({villa.residents?.length || 0})
            </Text>

            {/* Resident Cards List */}
            {(!villa.residents || villa.residents.length === 0) ? (
              <View className="py-4 items-center justify-center bg-muted/30 rounded-xl border border-dashed border-border">
                <Text variant="muted" className="text-xs">No occupants assigned to this unit.</Text>
              </View>
            ) : (
              villa.residents.map((res: any, idx: number) => {
                const rawUserId = typeof res.userId === 'object' && res.userId !== null ? (res.userId._id || res.userId.id) : res.userId;
                const userObj = typeof res.userId === 'object' && res.userId !== null 
                  ? res.userId 
                  : workspaceUsers.find((u) => String(u._id || u.id) === String(rawUserId));

                const resId = rawUserId || `res-${idx}`;
                const resEmail = userObj?.email || (typeof res.userId === 'string' && res.userId.includes('@') ? res.userId : null);
                const isEditing = editingUserId === resId;

                const isPrimary =
                  villa.primaryResidentId &&
                  (String(villa.primaryResidentId) === String(resId) ||
                    String(villa.primaryResidentId?._id) === String(resId));

                return (
                  <View
                    key={resId}
                    className="p-3 bg-card border border-border rounded-xl space-y-2 mb-1"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 me-2 space-y-1">
                        <View className="flex-row items-center gap-1.5 flex-wrap">
                          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
                            {resEmail || `Resident #${idx + 1}`}
                          </Text>
                          {isPrimary && (
                            <View className="bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                              <Text className="text-[10px] font-bold text-primary">Primary</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-xs font-semibold text-muted-foreground">
                          Type: <Text className="text-foreground">{res.residencyType || 'Tenant'}</Text>
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() =>
                          setResidentToDelete({
                            id: resId,
                            nameOrEmail: resEmail || `Resident #${idx + 1}`,
                          })
                        }
                        className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 active:opacity-75"
                        accessibilityRole="button"
                        accessibilityLabel="Delete resident"
                      >
                        <Icon as={Trash2} size={15} className="text-destructive" />
                      </TouchableOpacity>
                    </View>

                    {/* Inline Resident Actions (Edit Type / Set Primary) */}
                    {isEditing ? (
                      <View className="flex-row items-center gap-2 pt-2 border-t border-border/40">
                        <View className="flex-1">
                          <DropdownSelect
                            options={[
                              { label: 'Tenant', value: 'Tenant' },
                              { label: 'Resident Owner', value: 'Resident Owner' },
                              { label: 'Family Member', value: 'Family' },
                            ]}
                            value={editResidencyTypeVal}
                            onValueChange={setEditResidencyTypeVal}
                          />
                        </View>
                        <Button
                          variant="default"
                          size="sm"
                          onPress={() => handleSaveResidencyType(resId)}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => setEditingUserId(null)}
                        >
                          Cancel
                        </Button>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-3 pt-2 border-t border-border/40">
                        <TouchableOpacity
                          onPress={() => {
                            setEditingUserId(resId);
                            setEditResidencyTypeVal(res.residencyType || 'Tenant');
                          }}
                          className="flex-row items-center gap-1 active:opacity-75"
                        >
                          <Icon as={Edit2} size={12} className="text-primary" />
                          <Text className="text-xs font-semibold text-primary">Edit Type</Text>
                        </TouchableOpacity>

                        <Text variant="muted" className="text-xs">|</Text>

                        <TouchableOpacity
                          onPress={() => handleTogglePrimary(resId, isPrimary)}
                          className="flex-row items-center gap-1 active:opacity-75"
                        >
                          <Icon as={Shield} size={12} className={isPrimary ? 'text-warning' : 'text-primary'} />
                          <Text className={`text-xs font-semibold ${isPrimary ? 'text-warning' : 'text-primary'}`}>
                            {isPrimary ? 'Unset Primary' : 'Set Primary'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {/* Assignment & Invite Tabs Header */}
            <View className="pt-3 border-t border-border">
              <View className="flex-row items-center p-1 bg-muted rounded-xl mb-3">
                <TouchableOpacity
                  onPress={() => setActiveTab(1)}
                  className={`flex-1 py-2 items-center rounded-lg flex-row justify-center gap-1.5 ${
                    activeTab === 1 ? 'bg-card shadow-xs' : ''
                  }`}
                >
                  <Icon as={UserCheck} size={14} className={activeTab === 1 ? 'text-primary' : 'text-muted-foreground'} />
                  <Text className={`text-xs font-bold ${activeTab === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    Assign Existing
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab(2)}
                  className={`flex-1 py-2 items-center rounded-lg flex-row justify-center gap-1.5 ${
                    activeTab === 2 ? 'bg-card shadow-xs' : ''
                  }`}
                >
                  <Icon as={Mail} size={14} className={activeTab === 2 ? 'text-primary' : 'text-muted-foreground'} />
                  <Text className={`text-xs font-bold ${activeTab === 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    Invite Resident
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab 1: Assign Existing Workspace User */}
              {activeTab === 1 && (
                <View className="bg-card p-3.5 rounded-xl border border-border space-y-3">
                  {assignError && (
                    <Text className="text-xs font-semibold text-destructive">{assignError}</Text>
                  )}
                  {assignSuccess && (
                    <Text className="text-xs font-semibold text-status-success">{assignSuccess}</Text>
                  )}

                  {usersLoading ? (
                    <View className="py-4 items-center justify-center">
                      <ActivityIndicator size="small" color="#0d9488" />
                      <Text variant="muted" className="text-xs mt-1">Loading community members...</Text>
                    </View>
                  ) : (
                    <DropdownSelect
                      label="Select User *"
                      options={
                        userDropdownOptions.length > 0
                          ? userDropdownOptions
                          : [{ label: 'No unassigned members found', value: '' }]
                      }
                      value={selectedUserId}
                      onValueChange={setSelectedUserId}
                    />
                  )}

                  <DropdownSelect
                    label="Residency Type *"
                    options={[
                      { label: 'Tenant', value: 'Tenant' },
                      { label: 'Resident Owner', value: 'Resident Owner' },
                      { label: 'Family Member', value: 'Family' },
                    ]}
                    value={assignResidencyType}
                    onValueChange={setAssignResidencyType}
                  />

                  <TouchableOpacity
                    onPress={() => setIsPrimaryCheck(!isPrimaryCheck)}
                    className="flex-row items-center gap-2 py-1 active:opacity-75"
                  >
                    <View className={`size-5 rounded border items-center justify-center ${isPrimaryCheck ? 'bg-primary border-primary' : 'border-border bg-background'}`}>
                      {isPrimaryCheck && <Icon as={Check} size={12} className="text-primary-foreground" />}
                    </View>
                    <Text className="text-xs font-semibold text-foreground">Designate as Primary Resident</Text>
                  </TouchableOpacity>

                  <Button
                    variant="default"
                    size="sm"
                    onPress={handleAssignExisting}
                    disabled={actionLoading || !selectedUserId}
                  >
                    {actionLoading ? <ActivityIndicator color="#fff" /> : 'Assign Resident to Unit'}
                  </Button>
                </View>
              )}

              {/* Tab 2: Invite Resident via Email */}
              {activeTab === 2 && (
                <View className="bg-card p-3.5 rounded-xl border border-border space-y-3">
                  {inviteError && (
                    <Text className="text-xs font-semibold text-destructive">{inviteError}</Text>
                  )}
                  {inviteSuccess && (
                    <Text className="text-xs font-semibold text-status-success">{inviteSuccess}</Text>
                  )}

                  <TextInput
                    label="Email Address *"
                    placeholder="resident@example.com"
                    keyboardType="email-address"
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                  />

                  <PhoneInput
                    label="Phone Number *"
                    value={invitePhone}
                    onChangeText={setInvitePhone}
                    testID="villa-invite-phone"
                    rightElement={
                      <ContactPickerButton
                        onPick={(c) => {
                          if (c.phone) setInvitePhone(c.phone);
                          if (c.email) setInviteEmail(c.email);
                        }}
                      />
                    }
                  />

                  <DropdownSelect
                    label="Residency Type *"
                    options={[
                      { label: 'Tenant', value: 'Tenant' },
                      { label: 'Resident Owner', value: 'Resident Owner' },
                      { label: 'Family Member', value: 'Family' },
                    ]}
                    value={inviteResidencyType}
                    onValueChange={setInviteResidencyType}
                  />

                  <Button
                    size="sm"
                    className="bg-emerald-600 active:bg-emerald-700"
                    onPress={handleInviteResident}
                    disabled={actionLoading || !inviteEmail.trim()}
                  >
                    {actionLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-xs">Send Onboarding Invite</Text>}
                  </Button>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Delete Resident Confirmation Modal */}
      <ConfirmationModal
        visible={!!residentToDelete}
        title="Remove Resident"
        message={`Are you sure you want to remove ${residentToDelete?.nameOrEmail || 'this resident'} from Unit ${villa.unitNumber}? Confirm to proceed.`}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteResidentLoading}
        onCancel={() => {
          if (deleteResidentLoading) return;
          setResidentToDelete(null);
        }}
        onConfirm={async () => {
          if (!residentToDelete) return;
          setDeleteResidentLoading(true);
          try {
            await unassignResident(villa._id, residentToDelete.id);
            setResidentToDelete(null);
          } catch (err: any) {
            const errMsg = typeof err === 'string' ? err : (err?.message || 'Failed to remove resident');
            setAssignError(errMsg);
            setResidentToDelete(null);
          } finally {
            setDeleteResidentLoading(false);
          }
        }}
      />

      {/* Delete Unit Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteUnitConfirm}
        title="Delete Unit"
        message={`Are you sure you want to delete Unit ${villa.unitNumber}? This will permanently remove the unit and all associated resident records.`}
        confirmLabel="Confirm Delete"
        cancelLabel="Cancel"
        variant="danger"
        onCancel={() => setShowDeleteUnitConfirm(false)}
        onConfirm={() => {
          setShowDeleteUnitConfirm(false);
          onClose();
          onDelete && onDelete(villa);
        }}
      />
    </BottomSheet>
  );
};

export default VillaDetailsModal;
