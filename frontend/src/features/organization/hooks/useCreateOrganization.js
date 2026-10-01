import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { createOrganization, clearCreateOrganizationState } from '../store/organizationSlice.js'
import { registerSsoWithOrg } from '../../auth/store/authSlice.js'
import { checkOrganizationName } from '../services/organizationApi.js'
import useAuth from '../../auth/hooks/useAuth.js'

/**
 * Controller hook for the Create Organization flow.
 * Bridges visual components with Redux and performs debounced name availability checks.
 *
 * @returns {object} Form methods, state flags, and event handlers.
 */
export const useCreateOrganization = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()

  const authUser = useSelector((state) => state.auth?.user)
  const availableWorkspaces = useSelector((state) => state.workspace?.availableWorkspaces) || []
  const { createLoading, createError } = useSelector((state) => state.organization)

  const isSsoRegister = location.search.includes('intent=sso-register')
  const ssoToken = location.state?.ssoToken
  const ssoProvider = location.state?.provider
  const ssoEmail = location.state?.email || ''

  const [checking, setChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState(null)
  const [checkError, setCheckError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      timezone: 'Asia/Kolkata',
      contactEmail: isSsoRegister ? ssoEmail : authUser?.email || '',
      contactPhone: authUser?.phone || '',
    },
    mode: 'onTouched',
  })

  const orgName = watch('name')

  // Debounced live validation for organization name uniqueness
  useEffect(() => {
    if (!orgName || orgName.trim().length < 3) {
      setIsAvailable(null)
      setCheckError('')
      setChecking(false)
      return
    }

    setChecking(true)
    setIsAvailable(null)
    setCheckError('')

    const handler = setTimeout(async () => {
      try {
        const response = await checkOrganizationName(orgName.trim())
        const available = response.data?.available ?? response.data?.data?.available
        setIsAvailable(Boolean(available))
      } catch (err) {
        if (err.response?.status === 429) {
          setCheckError(
            t('organization.create.rateLimit', { defaultValue: 'Too many checks. Please wait.' }),
          )
        } else {
          setCheckError(
            t('organization.create.checkError', {
              defaultValue: 'Failed to verify name availability.',
            }),
          )
        }
        setIsAvailable(false)
      } finally {
        setChecking(false)
      }
    }, 500)

    return () => clearTimeout(handler)
  }, [orgName, t])

  const onSubmit = async (data) => {
    const payload = {
      name: data.name.trim(),
      organizationType: 'Residential',
      timezone: data.timezone,
      contactEmail: data.contactEmail?.trim(),
      contactPhone: data.contactPhone?.trim(),
    }

    if (isSsoRegister && ssoToken) {
      const action = await dispatch(
        registerSsoWithOrg({
          ...payload,
          ssoToken,
          provider: ssoProvider,
        }),
      )
      if (registerSsoWithOrg.fulfilled.match(action)) {
        navigate('/workspace-setup')
      }
    } else {
      const action = await dispatch(createOrganization(payload))
      if (createOrganization.fulfilled.match(action)) {
        navigate('/workspace-setup')
      }
    }
  }

  const handleBack = () => {
    const hasExistingOrg = authUser?.orgId || availableWorkspaces.length > 0
    if (hasExistingOrg) {
      navigate('/dashboard')
    } else {
      logout()
      navigate('/register')
    }
  }

  const isSubmitDisabled =
    createLoading ||
    checking ||
    isAvailable !== true ||
    !orgName ||
    orgName.trim().length < 3 ||
    Object.keys(errors).length > 0

  return {
    register,
    handleSubmit,
    errors,
    loading: createLoading,
    error: createError,
    checking,
    isAvailable,
    checkError,
    isSubmitDisabled,
    onSubmit,
    handleBack,
  }
}

export default useCreateOrganization
