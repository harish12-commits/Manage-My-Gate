import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'

const schema = yup.object().shape({
  name: yup.string().trim().required('Role name is required'),
  description: yup.string().trim().optional(),
  isTenantRole: yup.boolean().optional().default(false),
  permissions: yup.array().of(yup.string().required()).required('Permissions array is required'),
  integrationMappings: yup.object().optional().default({}),
})

export const useRoleForm = ({ role, visible, onSave }) => {
  const dispatch = useDispatch()

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      isTenantRole: false,
      permissions: [],
      integrationMappings: {},
    },
  })

  const selectedPermissions = watch('permissions') || []
  const integrationMappings = watch('integrationMappings') || {}
  const activeMappingsCount = Object.keys(integrationMappings).length

  useEffect(() => {
    register('permissions')
    register('integrationMappings')
    if (visible && role) {
      reset({
        name: role.name || '',
        description: role.description || '',
        isTenantRole: role.isTenantRole || false,
        permissions: role.permissions || [],
        integrationMappings: role.integrationMappings || {},
      })
    } else if (!visible) {
      reset({
        name: '',
        description: '',
        isTenantRole: false,
        permissions: [],
        integrationMappings: {},
      })
    }
  }, [role, visible, reset])

  const handleSelectAllGroup = (groupCodes, checked) => {
    const currentPermissions = getValues('permissions') || []
    let newValue
    if (checked) {
      newValue = Array.from(new Set([...currentPermissions, ...groupCodes]))
    } else {
      const toRemove = new Set(groupCodes)
      newValue = currentPermissions.filter((code) => !toRemove.has(code))
    }
    setValue('permissions', newValue, { shouldDirty: true, shouldValidate: true })
  }

  const handleTogglePermission = (permValue, checked) => {
    const currentPermissions = getValues('permissions') || []
    let newValue

    if (checked) {
      newValue = Array.from(new Set([...currentPermissions, permValue]))
    } else {
      newValue = currentPermissions.filter((p) => p !== permValue)
    }

    setValue('permissions', newValue, { shouldDirty: true, shouldValidate: true })
  }

  const onSubmit = async (data) => {
    await onSave(data)
  }

  return {
    register,
    handleSubmit: handleSubmit(onSubmit),
    errors,
    control,
    selectedPermissions,
    integrationMappings,
    activeMappingsCount,
    setValue,
    handleSelectAllGroup,
    handleTogglePermission,
  }
}

export default useRoleForm
