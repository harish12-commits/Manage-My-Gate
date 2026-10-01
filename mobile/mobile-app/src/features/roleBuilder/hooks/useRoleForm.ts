import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object().shape({
  name: yup.string().trim().required('Role name is required'),
  description: yup.string().trim().optional(),
  isTenantRole: yup.boolean().optional().default(false),
  permissions: yup.array().of(yup.string().required()).required('Permissions array is required'),
  integrationMappings: yup.object().optional().default({}),
});

interface RoleData {
  name: string;
  description?: string;
  isTenantRole?: boolean;
  permissions?: string[];
  integrationMappings?: Record<string, string>;
}

interface UseRoleFormProps {
  role?: RoleData | null;
  visible: boolean;
  onSave: (data: RoleData) => Promise<any>;
}

export const useRoleForm = ({ role, visible, onSave }: UseRoleFormProps) => {
  const [isIntegrationDrawerOpen, setIsIntegrationDrawerOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RoleData>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      name: '',
      description: '',
      isTenantRole: false,
      permissions: [],
      integrationMappings: {},
    },
  });

  const selectedPermissions = watch('permissions') || [];
  const isTenantRole = watch('isTenantRole') || false;
  const integrationMappings = watch('integrationMappings') || {};

  useEffect(() => {
    register('permissions');
    register('integrationMappings');
    if (visible && role) {
      reset({
        name: role.name || '',
        description: role.description || '',
        isTenantRole: role.isTenantRole || false,
        permissions: role.permissions || [],
        integrationMappings: role.integrationMappings || {},
      });
    } else if (!visible) {
      reset({
        name: '',
        description: '',
        isTenantRole: false,
        permissions: [],
        integrationMappings: {},
      });
      setIsIntegrationDrawerOpen(false);
    }
  }, [role, visible, reset, register]);

  const handleSelectAllGroup = (groupCodes: string[], checked: boolean) => {
    const currentPermissions = getValues('permissions') || [];
    
    // Expand any virtual full_access codes into their real backend permissions
    const expandedGroupCodes = groupCodes.flatMap(code => {
      if (String(code).endsWith(':full_access')) {
        const category = code.split(':')[0];
        return [`${category}:create`, `${category}:read`, `${category}:update`, `${category}:delete`, `${category}:manage`, `${category}:super_admin`];
      }
      return code;
    });

    let newValue: string[];

    if (checked) {
      newValue = Array.from(new Set([...currentPermissions, ...expandedGroupCodes]));
    } else {
      const toRemove = new Set(expandedGroupCodes);
      newValue = currentPermissions.filter((code) => !toRemove.has(code));
    }

    setValue('permissions', newValue, { shouldDirty: true, shouldValidate: true });
  };

  const handleTogglePermission = (permValue: string, checked: boolean) => {
    const currentPermissions = getValues('permissions') || [];
    let newValue: string[];

    if (String(permValue).endsWith(':full_access')) {
      const category = permValue.split(':')[0];
      const adminActions = ['create', 'read', 'update', 'delete', 'manage', 'super_admin'];
      const permsToToggle = adminActions.map(a => `${category}:${a}`);
      
      if (checked) {
        newValue = Array.from(new Set([...currentPermissions, ...permsToToggle]));
      } else {
        const toRemove = new Set(permsToToggle);
        newValue = currentPermissions.filter((p) => !toRemove.has(p) && !String(p).startsWith(`${category}:`));
      }
    } else if (checked) {
      newValue = Array.from(new Set([...currentPermissions, permValue]));
    } else {
      newValue = currentPermissions.filter((p) => p !== permValue);
    }

    setValue('permissions', newValue, { shouldDirty: true, shouldValidate: true });
  };

  const handleApplyIntegrationMappings = (mappings: Record<string, string>) => {
    setValue('integrationMappings', mappings, { shouldDirty: true, shouldValidate: true });
  };

  const toggleIntegrationDrawer = () => {
    setIsIntegrationDrawerOpen((prev) => !prev);
  };

  const onSubmit = async (data: RoleData) => {
    const finalData = {
      ...data,
      permissions: getValues('permissions') || [],
      integrationMappings: getValues('integrationMappings') || {},
    };
    await onSave(finalData);
  };

  return {
    register,
    handleSubmit: handleSubmit(onSubmit),
    errors,
    control,
    isSubmitting,
    selectedPermissions,
    isTenantRole,
    integrationMappings,
    isIntegrationDrawerOpen,
    toggleIntegrationDrawer,
    setValue,
    handleSelectAllGroup,
    handleTogglePermission,
    handleApplyIntegrationMappings,
  };
};

export default useRoleForm;
