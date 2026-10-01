import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import {
  loadWorkspaces,
  getWorkspaceDetails,
  editWorkspaceDetails,
  toggleModule,
  loadCurrentModules,
  createNewWorkspace,
} from '../store/workspaceSlice.js'

export const useWorkspaceDetails = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { id: routeId } = useParams()

  // Redux Store states
  const {
    activeWorkspaceDetails,
    workspaceModules,
    loading: wsLoading,
    error: wsError,
  } = useSelector((state) => state.workspace)

  const activeOrgId = useSelector((state) => state.workspace.activeOrganizationId)
  const isPlatformAdmin = useSelector((state) => state.workspace.isPlatform)
  const activeRole = useSelector((state) => state.workspace.activeRole)

  // Local component states
  const [workspaceId, setWorkspaceId] = useState(null)
  const [activeTab, setActiveTab] = useState('create')

  // Workspace Settings edit Form hook
  const editForm = useForm({
    defaultValues: {
      workspaceName: '',
      description: '',
      status: 'Active',
      organizationName: '',
      timeZone: '',
      language: '',
      contactEmail: '',
      contactPhone: '',
    },
  })

  const { reset: resetEdit } = editForm

  // 1. Resolve workspace ID dynamically
  useEffect(() => {
    const initWorkspace = async () => {
      try {
        if (routeId) {
          setWorkspaceId(routeId)
          dispatch(getWorkspaceDetails(routeId))
        } else {
          const listResponse = await dispatch(loadWorkspaces()).unwrap()
          const list = listResponse?.data || listResponse || []
          const activeWs = Array.isArray(list)
            ? list.find((w) => w && w.organizationId === activeOrgId) || list[0]
            : null
          if (activeWs) {
            setWorkspaceId(activeWs._id)
            dispatch(getWorkspaceDetails(activeWs._id))
          }
        }
      } catch (err) {
        toast.error(t('workspace.details.loadError', 'Failed to retrieve workspace details.'))
      }
    }
    initWorkspace()
  }, [routeId, activeOrgId, dispatch, t])

  // 2. Synchronize Edit Workspace details forms when data hydrates
  useEffect(() => {
    if (activeWorkspaceDetails) {
      resetEdit({
        workspaceName: activeWorkspaceDetails.workspaceName || '',
        description: activeWorkspaceDetails.description || '',
        status: activeWorkspaceDetails.status || 'Active',
        organizationName: activeWorkspaceDetails.organizationName || '',
        timeZone: activeWorkspaceDetails.timeZone || '',
        language: activeWorkspaceDetails.language || '',
        contactEmail: activeWorkspaceDetails.contactEmail || '',
        contactPhone: activeWorkspaceDetails.contactPhone || '',
      })
    }
  }, [activeWorkspaceDetails, resetEdit])

  const handleGeneralInfoSubmit = async (formData) => {
    const isManager = ['Platform Super Admin', 'Super Admin', 'Community Admin'].includes(
      activeRole,
    )
    if (!isManager) {
      toast.error(t('workspace.details.restrictedAction', 'Residents cannot modify settings.'))
      return
    }

    try {
      await dispatch(editWorkspaceDetails({ id: workspaceId, data: formData })).unwrap()
      toast.success(t('workspace.details.saveSuccess', 'Workspace settings updated successfully.'))
      dispatch(loadCurrentModules())
    } catch (err) {
      toast.error(err || t('workspace.details.saveError', 'Failed to save settings.'))
    }
  }

  const handleCreateWorkspaceSubmit = async (formData) => {
    if (activeRole === 'Resident') {
      toast.error(t('workspace.details.restrictedAction', 'Residents cannot create workspaces.'))
      return
    }
    try {
      const payload = {
        ...formData,
        organizationId: activeOrgId,
      }
      const newWs = await dispatch(createNewWorkspace(payload)).unwrap()
      toast.success(t('workspace.details.createSuccess', 'Workspace created successfully.'))

      // Select the newly created workspace
      if (newWs && newWs._id) {
        setWorkspaceId(newWs._id)
        dispatch(getWorkspaceDetails(newWs._id))
        setActiveTab('create')
        dispatch(loadCurrentModules())
      }
    } catch (err) {
      toast.error(err || t('workspace.details.createError', 'Failed to create workspace.'))
    }
  }

  const handleModuleToggle = async (modId, currentEnabled) => {
    if (activeRole === 'Resident') {
      toast.error(
        t('workspace.details.restrictedAction', 'Residents cannot modify module features.'),
      )
      return
    }
    if (!workspaceId) return
    try {
      const nextEnabled = !currentEnabled
      await dispatch(toggleModule({ workspaceId, moduleId: modId, enabled: nextEnabled })).unwrap()
      toast.success(
        t('workspace.details.moduleToggleSuccess', 'Module access modified successfully.'),
      )
      dispatch(loadCurrentModules())
    } catch (err) {
      toast.error(
        err || t('workspace.details.moduleToggleError', 'Failed to modify module access.'),
      )
    }
  }

  return {
    t,
    navigate,
    routeId,
    // Redux selectors
    activeWorkspaceDetails,
    workspaceModules,
    wsLoading,
    wsError,
    activeOrgId,
    isPlatformAdmin,
    activeRole,
    // States & state setters
    workspaceId,
    activeTab,
    setActiveTab,
    // Forms
    editForm,
    // Action handlers
    handleGeneralInfoSubmit,
    handleCreateWorkspaceSubmit,
    handleModuleToggle,
  }
}

export default useWorkspaceDetails
