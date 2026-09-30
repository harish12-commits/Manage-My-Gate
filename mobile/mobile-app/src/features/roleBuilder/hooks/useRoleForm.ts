import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { RoleData } from '../services/roleService';

const schema = yup.object().shape({
  name: yup.string().trim().required('Role name is required'),
  description: yup.string().trim().optional(),
  isTenantRole: yup.boolean().optional().default(false),
  permissions: yup.array().of(yup.string().required()).required('Permissions array is required'),
  integrationMappings: yup.object().optional().default({}),
});

export const AMENITY_V2_TIER_PERMISSIONS: Record<string, string[]> = {
  resident: [
    'amenities:discover',
    'amenities:my_booking',
    'amenities:wallet',
  ],
  security_guard: [
    'amenities:scanner',
    'amenities:security_logs',
  ],
  admin: [
    'amenities:amenities',
    'amenities:admin_calander',
    'amenities:maintenance',
    'amenities:settings',
    'amenities:dashboard',
    'amenities:ledgers',
  ],
  none: [],
};

export const NOTICE_ACTION_GROUPS: Record<string, string[]> = {
  'notices:manage_notices': [
    'notices:manage_notices',
    'notices:dashboard',
    'notices:create',
    'notices:update',
    'notices:delete',
    'notices:publish',
    'notices:acknowledge',
    'notices.manage_notices',
    'notices.dashboard',
    'notices.create',
    'notices.update',
    'notices.delete',
    'notices.publish',
    'notices.acknowledge',
    'polls:create',
    'polls:update',
    'polls:delete',
    'polls:publish',
    'polls:close',
    'polls:export',
    'polls:view_voters',
    'polls.create',
    'polls.update',
    'polls.delete',
    'polls.publish',
    'polls.close',
    'polls.export',
    'polls.view_voters',
    'manage_notices',
    'dashboard',
    'create',
    'update',
    'delete',
    'publish',
    'acknowledge',
  ],
  'notices:active_board': [
    'notices:active_board',
    'notices:read',
    'notices.active_board',
    'notices.read',
    'active_board',
    'read',
  ],
  'notices:polls': [
    'notices:polls',
    'notices.polls',
    'polls:read',
    'polls.read',
    'polls:vote',
    'polls.vote',
    'polls',
    'vote_polls',
  ],
};

export const ALL_NOTICE_ACTIONS: string[] = [
  ...NOTICE_ACTION_GROUPS['notices:manage_notices'],
  ...NOTICE_ACTION_GROUPS['notices:active_board'],
  ...NOTICE_ACTION_GROUPS['notices:polls'],
];

const normalizePermission = (permission: unknown): string =>
  String(permission || '').trim().toLowerCase().replace(/\./g, ':');

export const detectInitialAmenityTier = (permissions: string[] = []): string => {
  const amenityPerms = (permissions || []).filter((p) => String(p).toLowerCase().startsWith('amenities:'));
  if (amenityPerms.length === 0) return 'none';

  const normalized = amenityPerms.map((p) => String(p).toLowerCase());
  const hasExact = (tierSet: string[]) =>
    tierSet.length === normalized.length &&
    tierSet.every((p) => normalized.includes(p.toLowerCase()));

  if (hasExact(AMENITY_V2_TIER_PERMISSIONS.admin)) return 'admin';
  if (hasExact(AMENITY_V2_TIER_PERMISSIONS.security_guard)) return 'security_guard';
  if (hasExact(AMENITY_V2_TIER_PERMISSIONS.resident)) return 'resident';

  // Safe fallback for ambiguous mixtures
  return 'none';
};

interface UseRoleFormProps {
  role?: RoleData | null;
  visible: boolean;
  onSave: (data: RoleData) => Promise<any>;
}

export const useRoleForm = ({ role, visible, onSave }: UseRoleFormProps) => {
  const [isIntegrationDrawerOpen, setIsIntegrationDrawerOpen] = useState(false);
  const [amenityTier, setAmenityTier] = useState<string>('none');

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
    if (visible && role) {
      const rolePerms = role.permissions || [];
      reset({
        name: role.name || '',
        description: role.description || '',
        isTenantRole: role.isTenantRole || false,
        permissions: rolePerms,
        integrationMappings: role.integrationMappings || {},
      });
      setAmenityTier(detectInitialAmenityTier(rolePerms));
    } else if (!visible) {
      reset({
        name: '',
        description: '',
        isTenantRole: false,
        permissions: [],
        integrationMappings: {},
      });
      setIsIntegrationDrawerOpen(false);
      setAmenityTier('none');
    }
  }, [role, visible, reset]);

const getPermAction = (p: any): string => {
  const str = typeof p === 'object' ? String(p.name || p._id || '') : String(p);
  return (str.includes(':') ? str.split(':')[1] : str).toLowerCase().trim();
};

  const handleSelectAllGroup = (groupCodes: string[], checked: boolean) => {
    const currentPermissions = getValues('permissions') || [];
    let newValue: string[];

    if (checked) {
      newValue = Array.from(new Set([...currentPermissions, ...groupCodes]));
    } else {
      const toRemove = new Set(groupCodes.map(normalizePermission));
      const hasNoticeCodes = groupCodes.some((c) => {
        const normalized = normalizePermission(c);
        return normalized.startsWith('notices:') || normalized.startsWith('polls:');
      });
      if (hasNoticeCodes) {
        ALL_NOTICE_ACTIONS.forEach((a) => toRemove.add(normalizePermission(a)));
      }
      newValue = currentPermissions.filter((code) => !toRemove.has(normalizePermission(code)));
    }

    setValue('permissions', newValue, { shouldDirty: true, shouldValidate: true });
  };

  const handleTogglePermission = (permValue: string, checked: boolean) => {
    const currentPermissions = getValues('permissions') || [];
    let newValue: string[];

    if (String(permValue).startsWith('amenities_tier:')) {
      const tier = permValue.replace('amenities_tier:', '');
      setAmenityTier(tier);
      const nonAmenity = currentPermissions.filter((p) => !String(p).toLowerCase().startsWith('amenities:'));
      const tierPermissions = AMENITY_V2_TIER_PERMISSIONS[tier] || [];
      newValue = [...nonAmenity, ...tierPermissions];
      setValue('permissions', newValue, { shouldDirty: true, shouldValidate: true });
      return;
    }

    const targetAction = getPermAction(permValue);

    if (checked) {
      if (String(permValue).toLowerCase().startsWith('visitor:')) {
        newValue = [
          ...currentPermissions.filter((p) => !String(p).toLowerCase().startsWith('visitor:')),
          permValue,
        ];
      } else {
        newValue = Array.from(new Set([...currentPermissions, permValue]));
      }
    } else {
      // Remove permission - cleanly purge associated action groups if it's a notice permission
      const normalizedValue = String(permValue).toLowerCase();
      if (
        normalizedValue === 'notices:manage_notices' ||
        normalizedValue === 'notices.manage_notices' ||
        normalizedValue === 'manage_notices'
      ) {
        const purgeSet = new Set(NOTICE_ACTION_GROUPS['notices:manage_notices'].map(normalizePermission));
        newValue = currentPermissions.filter((p) => !purgeSet.has(normalizePermission(p)));
      } else if (
        normalizedValue === 'notices:active_board' ||
        normalizedValue === 'notices.active_board' ||
        normalizedValue === 'active_board'
      ) {
        const purgeSet = new Set(NOTICE_ACTION_GROUPS['notices:active_board'].map(normalizePermission));
        newValue = currentPermissions.filter((p) => !purgeSet.has(normalizePermission(p)));
      } else if (
        normalizedValue === 'notices:polls' ||
        normalizedValue === 'notices.polls' ||
        normalizedValue === 'polls'
      ) {
        const purgeSet = new Set(NOTICE_ACTION_GROUPS['notices:polls'].map(normalizePermission));
        newValue = currentPermissions.filter((p) => !purgeSet.has(normalizePermission(p)));
      } else {
        newValue = currentPermissions.filter(
          (p) => normalizePermission(p) !== normalizePermission(permValue)
        );
      }
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
    await onSave(data);
  };

  return {
    register,
    handleSubmit: handleSubmit(onSubmit),
    errors,
    control,
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
  };
};

export default useRoleForm;
