import React, { useEffect } from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '../../../../components/ui/BottomSheet';
import { Button } from '../../../../components/ui/button';
import { Icon } from '../../../../components/ui/icon';
import { TextInput } from '../../../../components/forms/TextInput';
import { Checkbox } from '../../../../components/forms/Checkbox';
import { ChevronDown, ChevronUp, Plug } from 'lucide-react-native';
import { RoleData } from '../services/roleService';
import { useRoleForm } from '../hooks/useRoleForm';
import PermissionMatrixGrid from './PermissionMatrixGrid';
import RoleIntegrationConfigurator from './RoleIntegrationConfigurator';
import { AppLoader } from '@/components/ui/AppLoader';

interface RoleFormSheetModalProps {
  visible: boolean;
  role: RoleData | null;
  permissionsList: any;
  isPermissionsLoading: boolean;
  onClose: () => void;
  onSave: (data: RoleData) => Promise<any>;
  onLoadPermissions: () => void;
}

export const RoleFormSheetModal: React.FC<RoleFormSheetModalProps> = ({
  visible,
  role,
  permissionsList,
  isPermissionsLoading,
  onClose,
  onSave,
  onLoadPermissions,
}) => {
  const {
    handleSubmit,
    errors,
    isSubmitting,
    selectedPermissions,
    amenityTier,
    isTenantRole,
    integrationMappings,
    isIntegrationDrawerOpen,
    toggleIntegrationDrawer,
    setValue,
    handleSelectAllGroup,
    handleTogglePermission,
    handleApplyIntegrationMappings,
  } = useRoleForm({ role, visible, onSave });

  useEffect(() => {
    if (visible) {
      onLoadPermissions();
    }
  }, [visible, onLoadPermissions]);

  const mappedCount = Object.keys(integrationMappings || {}).length;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={role ? `Edit ${role.name}` : 'New Security Role'}
    >
      <View className="gap-3.5 pb-6">
        {/* Role Name */}
          <TextInput
            label="Role Name"
            placeholder="e.g. Branch Manager"
            defaultValue={role?.name || ''}
            error={errors.name?.message}
            onChangeText={(text) => setValue('name', text, { shouldValidate: true })}
          />

          {/* Description */}
          <TextInput
            label="Description"
            placeholder="Enter role description..."
            multiline
            numberOfLines={2}
            defaultValue={role?.description || ''}
            error={errors.description?.message}
            onChangeText={(text) => setValue('description', text, { shouldValidate: true })}
          />

          {/* Is Tenant / Unit Role Switch Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setValue('isTenantRole', !isTenantRole, { shouldValidate: true })}
            className="flex-row items-center justify-between p-3 rounded-2xl bg-card border border-border/80 shadow-xs"
          >
            <View className="flex-1 me-3">
              <Text className="text-xs font-bold text-foreground">Tenant / Unit Role Scope</Text>
              <Text className="text-[11px] text-muted-foreground mt-0.5">
                Restricted to specific villa/apartment units when onboarding residents.
              </Text>
            </View>
            <Checkbox
              checked={isTenantRole}
              onCheckedChange={(val) => setValue('isTenantRole', !!val, { shouldValidate: true })}
            />
          </TouchableOpacity>

          {/* Integration Hub Drawer Card */}
          <View className="border border-border/80 rounded-2xl bg-card p-3 shadow-xs">
            <TouchableOpacity
              onPress={toggleIntegrationDrawer}
              activeOpacity={0.7}
              className="flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-2.5">
                <View className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                  <Icon as={Plug} size={16} className="text-primary" />
                </View>
                <View>
                  <Text className="text-xs font-bold text-foreground">
                    Integration Hub Connections
                  </Text>
                  <Text className="text-[10px] text-muted-foreground">
                    Bind provider credentials (SMTP, Twilio, Razorpay)
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-1.5">
                <View className="px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/30">
                  <Text className="text-[10px] font-bold text-primary">
                    {mappedCount} Mapped
                  </Text>
                </View>
                {isIntegrationDrawerOpen ? (
                  <Icon as={ChevronUp} size={16} className="text-muted-foreground" />
                ) : (
                  <Icon as={ChevronDown} size={16} className="text-muted-foreground" />
                )}
              </View>
            </TouchableOpacity>

            {/* Embedded Integration Configurator */}
            {isIntegrationDrawerOpen && (
              <RoleIntegrationConfigurator
                isOpen={isIntegrationDrawerOpen}
                onClose={toggleIntegrationDrawer}
                mappings={integrationMappings}
                onApply={handleApplyIntegrationMappings}
              />
            )}
          </View>

          {/* Granular Permissions Section */}
          <View className="mt-1">
            {isPermissionsLoading ? (
              <View className="py-6 items-center justify-center bg-card rounded-2xl border border-border">
                <AppLoader variant="inline" />
                <Text className="text-xs text-muted-foreground mt-2">Loading permissions matrix...</Text>
              </View>
            ) : (
              <PermissionMatrixGrid
                groupedPermissions={permissionsList}
                selectedIds={selectedPermissions}
                activeAmenityTier={amenityTier}
                onSelectAllGroup={handleSelectAllGroup}
                onTogglePermission={handleTogglePermission}
              />
            )}
          </View>

          {/* Native Action CTAs */}
          <View className="flex-row flex-wrap items-center gap-3 mt-2 pt-3 border-t border-border">
            <Button variant="outline" onPress={onClose} className="flex-1 rounded-xl h-11">
              <Text className="font-bold text-xs text-foreground">Cancel</Text>
            </Button>
            <Button
              variant="default"
              loading={isSubmitting}
              onPress={handleSubmit}
              className="flex-1 min-w-[140px] rounded-xl h-11 bg-white border border-neutral-300"
            >
              <Text className="font-bold text-xs text-black">
                {role ? 'Save Changes' : 'Create Role'}
              </Text>
            </Button>
          </View>
        </View>
    </BottomSheet>
  );
};

export default RoleFormSheetModal;
