import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getPasses, createPass, updatePassStatus } from '../store/visitorPassSlice.js'
import { fetchBlacklist, addBlockProfile, removeBlockProfile } from '../store/blacklistSlice.js'
import { fetchHistoryLogs, fetchPendingApprovals, resolveWalkIn } from '../store/visitorLogSlice.js'
import useAuth from '../../auth/hooks/useAuth.js'
import apiClient from '../../../services/apiClient.js'

export const useAdminVisitorManagement = () => {
  const dispatch = useDispatch()
  const { currentUser } = useAuth()
  const location = useLocation()

  const queryParams = new URLSearchParams(location.search)
  const urlTab = queryParams.get('tab')

  const [activeTab, setActiveTab] = useState(urlTab || 'overview')

  useEffect(() => {
    if (urlTab) {
      setActiveTab(urlTab)
    }
  }, [urlTab])
  const [generatedPass, setGeneratedPass] = useState(null)
  const [inviteMethod, setInviteMethod] = useState('guest')
  const [guestPassType, setGuestPassType] = useState('default')
  const [cabPassType, setCabPassType] = useState('default')
  const [cabUsageType, setCabUsageType] = useState('one_time')
  const [servicePassType, setServicePassType] = useState('default')
  const [serviceUsageType, setServiceUsageType] = useState('one_time')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  // Redux Selectors
  const reduxPasses = useSelector((state) => state.visitorPass.passes)
  const activeOrgId = useSelector((state) => state.workspace?.activeOrganizationId)
  const reduxBlacklist = useSelector((state) => state.blacklist.blacklist)
  const reduxLogs = useSelector((state) => state.visitorLog.historyLogs)
  const reduxPendingApprovals = useSelector((state) => state.visitorLog.pendingApprovals)

  const [dbRoles, setDbRoles] = useState([])

  useEffect(() => {
    if (activeOrgId) {
      apiClient
        .get('/roles?limit=100')
        .then((res) => {
          setDbRoles(res.data?.data || [])
        })
        .catch((err) => {
          console.error('Failed to load roles in admin visitor hook:', err)
        })
    }
  }, [activeOrgId])

  // Local fallback mock states
  const generateMockPasses = () => {
    const methods = ['guest', 'group', 'cab_delivery', 'service']
    const mocks = []
    methods.forEach((method) => {
      for (let i = 1; i <= 250; i++) {
        mocks.push({
          id: `${method.charAt(0).toUpperCase()}-${10000 + i}`,
          method: method,
          visitorName: `Mock ${method} Visitor ${i}`,
          details: 'Mock Pass Details',
          validity: '08 Jul 2026 - 10 Jul 2026',
          uses: '0 / 2',
          status: i % 5 === 0 ? 'EXPIRED' : 'ACTIVE',
        })
      }
    })
    return mocks
  }
  const [localPasses, setLocalPasses] = useState(generateMockPasses())

  const [localWalkins] = useState([
    {
      id: 'W-901',
      visitorName: 'David Miller',
      company: 'FedEx Courier',
      purpose: 'Delivery of Parcel',
      vehicle: 'DL-3C-AS-8812',
      guardName: 'Officer Ramesh',
      photoUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100',
      timestamp: 'Just now',
      status: 'PENDING',
    },
  ])

  const [localLogs] = useState([
    {
      id: 'L-1',
      visitorName: 'John Doe',
      type: 'guest',
      villa: 'Villa 102',
      resident: 'David Lee',
      checkIn: '09 Jul 2026, 09:12 AM',
      checkOut: '09 Jul 2026, 11:30 AM',
      status: 'COMPLETED',
      guard: 'Officer Ramesh',
    },
    {
      id: 'L-2',
      visitorName: 'Zomato Delivery',
      type: 'cab_delivery',
      villa: 'Villa 54',
      resident: 'Sarah Jenkins',
      checkIn: '09 Jul 2026, 10:15 AM',
      checkOut: '—',
      status: 'INSIDE',
      guard: 'Officer Khan',
    },
    {
      id: 'L-3',
      visitorName: 'Mike the Electrician',
      type: 'service',
      villa: 'Villa 12',
      resident: 'Kumar Swamy',
      checkIn: '09 Jul 2026, 08:30 AM',
      checkOut: '—',
      status: 'INSIDE',
      guard: 'Officer Ramesh',
    },
  ])

  const [localBlacklist, setLocalBlacklist] = useState([
    {
      id: 'B-1',
      name: 'Robert Vance',
      phone: '+971 50 123 4567',
      plate: 'DXB-88190',
      reason: 'Unauthorised commercial solicitation',
      dateAdded: '01 Jul 2026',
    },
    {
      id: 'B-2',
      name: 'Security Bypasser Van',
      phone: '—',
      plate: 'SHJ-10229',
      reason: 'Tailgated resident vehicle through gate barrier',
      dateAdded: '05 Jul 2026',
    },
  ])

  useEffect(() => {
    if (activeOrgId) {
      dispatch(getPasses({ orgId: activeOrgId, params: { page: 1, limit: 10 } }))
      dispatch(fetchBlacklist({ orgId: activeOrgId, params: { page: 1, limit: 10 } }))
      dispatch(fetchHistoryLogs({ orgId: activeOrgId, params: { page: 1, limit: 10 } }))
      dispatch(fetchPendingApprovals(activeOrgId))
    }
  }, [dispatch, activeOrgId])

  // Merge state definitions
  const passes = [...(activeOrgId && reduxPasses ? reduxPasses : []), ...localPasses]
  const blacklist = activeOrgId ? reduxBlacklist : localBlacklist
  const walkins = activeOrgId ? reduxPendingApprovals : localWalkins
  const logs = activeOrgId ? reduxLogs : localLogs

  const setWalkins = (updater) => {
    if (!activeOrgId) {
      if (typeof updater === 'function') {
        setLocalWalkins(updater)
      } else {
        setLocalWalkins(updater)
      }
      return
    }

    if (typeof updater === 'function') {
      const nextList = updater(walkins)
      const currentMap = new Map(walkins.map((w) => [w.id || w._id, w.status || w.logStatus]))
      for (const item of nextList) {
        const itemId = item.id || item._id
        const oldStatus = currentMap.get(itemId)
        const newStatus = item.status || item.logStatus
        if (oldStatus === 'PENDING' && newStatus !== 'PENDING') {
          const statusAction = newStatus === 'APPROVED' ? 'APPROVE' : 'REJECT'
          dispatch(resolveWalkIn({ id: itemId, status: statusAction }))
            .unwrap()
            .then(() => {
              toast.success(`Entry request successfully ${newStatus.toLowerCase()}!`)
              dispatch(fetchPendingApprovals(activeOrgId))
            })
            .catch((err) => {
              toast.error(err.message || 'Failed to resolve walk-in request.')
            })
          break
        }
      }
    }
  }

  const getTodayString = () => new Date().toISOString().split('T')[0]
  const getFutureDateString = (daysAhead) =>
    new Date(Date.now() + 86400000 * daysAhead).toISOString().split('T')[0]

  const getInitialFormData = () => ({
    guestName: '',
    visitorName: '',
    vehicleNumber: '',
    idProofType: 'Aadhaar Card',
    idProof: '',
    startDate: '',
    endDate: '',
    usageLimit: '',
    maxUses: '',

    eventName: '',
    totalTokens: '',
    eventDate: '',
    eventStartTime: '09:00',
    eventEndTime: '18:00',

    cabCategory: 'delivery', // 'delivery' or 'cab'
    companyName: '',
    orderId: '',
    timeWindow: '08:00 - 12:00',

    serviceType: 'Plumber',
    providerName: '',
    intercomAlert: false,
    selectedDays: [],
    serviceSelectedDays: [],
  })

  const [formData, setFormData] = useState(getInitialFormData())

  const handleInputChange = (nameOrEvent, value) => {
    if (nameOrEvent && nameOrEvent.target) {
      const { name, value: val } = nameOrEvent.target
      setFormData((prev) => ({ ...prev, [name]: val }))
    } else {
      setFormData((prev) => ({ ...prev, [nameOrEvent]: value }))
    }
  }

  const validateIdProof = (type, number) => {
    if (!number?.trim()) {
      return 'ID Proof Reference / Number is required.'
    }
    const val = number.trim()
    switch (type) {
      case 'Aadhaar Card': {
        const aadhaarRegex = /^\d{4}\s?\d{4}\s?\d{4}$/
        if (!aadhaarRegex.test(val)) {
          return 'Invalid Aadhaar Card format. Expected 12 digits (e.g., 1234 5678 9012).'
        }
        break
      }
      case 'PAN Card': {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i
        if (!panRegex.test(val)) {
          return 'Invalid PAN Card format. Expected 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F).'
        }
        break
      }
      case 'Driving License': {
        // Strip hyphens and spaces
        const cleaned = val.replace(/[\s-]/g, '')
        const dlRegex = /^[A-Z]{2}\d{13}$/i
        if (!dlRegex.test(cleaned)) {
          return 'Invalid Driving License format. Expected standard Indian DL format with 15 characters (e.g., MH1220181234567).'
        }
        break
      }
      case 'Voter ID': {
        const voterRegex = /^[A-Z]{3}\d{7}$/i
        if (!voterRegex.test(val)) {
          return 'Invalid Voter ID format. Expected 3 letters followed by 7 digits (e.g., XYZ1234567).'
        }
        break
      }
      case 'Indian Passport': {
        const passportRegex = /^[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]$/
        if (!passportRegex.test(val)) {
          return 'Invalid Indian Passport format.'
        }
        break
      }
      default:
        break
    }
    return null
  }

  const handleCreatePass = async (e) => {
    e.preventDefault()

    const isIdProofPass =
      (inviteMethod === 'guest' && guestPassType === 'id_proof') ||
      (inviteMethod === 'service' && servicePassType === 'id_proof')

    // 1. Gather values and sanitize strings
    const nameInput = (formData.guestName || formData.visitorName || '').trim()
    const eventNameInput = (formData.eventName || '').trim()
    const companyNameInput = (formData.companyName || '').trim()
    const providerNameInput = (formData.providerName || '').trim()
    const serviceTypeInput = (formData.serviceType || '').trim()
    const vehicleNumberInput = (formData.vehicleNumber || '').trim().toUpperCase()
    const orderIdInput = (formData.orderId || '').trim()
    const idProofTypeInput = formData.idProofType || 'Aadhaar Card'
    const idProofInput = (formData.idProof || '').trim().toUpperCase()

    // 2. Client-side Validations based on inviteMethod
    if (inviteMethod === 'guest') {
      if (!nameInput) {
        toast.error('Visitor Name is required.')
        return
      }
      if (!formData.startDate) {
        toast.error('Start Date is required.')
        return
      }
      if (!formData.endDate) {
        toast.error('End Date is required.')
        return
      }
      const uLimit = parseInt(formData.usageLimit || formData.maxUses, 10)
      if (isNaN(uLimit) || uLimit <= 0) {
        toast.error('Usage Limit (Max entries) must be a positive number.')
        return
      }
      if (guestPassType === 'id_proof') {
        const errorMsg = validateIdProof(idProofTypeInput, idProofInput)
        if (errorMsg) {
          toast.error(errorMsg)
          return
        }
      }
    } else if (inviteMethod === 'group') {
      if (!eventNameInput) {
        toast.error('Event Name is required.')
        return
      }
      if (!formData.eventDate) {
        toast.error('Event Date is required.')
        return
      }
      const tokensCount = parseInt(formData.totalTokens, 10)
      if (isNaN(tokensCount) || tokensCount <= 0) {
        toast.error('Total Expected Tokens must be a positive number.')
        return
      }
    } else if (inviteMethod === 'cab_delivery') {
      if (!companyNameInput) {
        toast.error('Delivery Provider / Cab Brand is required.')
        return
      }
      const category = formData.cabCategory || 'delivery'
      if (category === 'delivery') {
        if (!orderIdInput) {
          toast.error('Order Reference ID is required.')
          return
        }
      } else {
        if (!vehicleNumberInput) {
          toast.error('Taxi License Number is required.')
          return
        }
        // Indian Taxi plate regex with BH Series support
        const cleanedPlateForRegex = vehicleNumberInput.replace(/[\s-]/g, '')
        const licensePlateRegex =
          /^([A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4}|\d{2}[ -]?BH[ -]?\d{4}[ -]?[A-Z]{1,2})$/i
        if (!licensePlateRegex.test(cleanedPlateForRegex)) {
          toast.error(
            'Invalid Taxi License format. Must be a valid Indian state plate (e.g. MH-12-AB-1234) or BH series (e.g. 22-BH-1234-AB).',
          )
          return
        }
      }

      // Guardrail: multi-use pass expiration boundaries
      if (cabUsageType === 'multi_use') {
        const hasEndDate = !!formData.endDate
        if (!hasEndDate) {
          toast.error('Multi-use passes must specify an end date.')
          return
        }
      }
    } else if (inviteMethod === 'service') {
      if (!providerNameInput) {
        toast.error('Staff Name / Agency Name is required.')
        return
      }
      if (!serviceTypeInput) {
        toast.error('Service Type is required.')
        return
      }
      if (servicePassType === 'id_proof') {
        const errorMsg = validateIdProof(idProofTypeInput, idProofInput)
        if (errorMsg) {
          toast.error(errorMsg)
          return
        }
      }

      // Guardrail: multi-use pass expiration boundaries
      if (serviceUsageType === 'multi_use') {
        const hasEndDate = !!formData.endDate
        if (!hasEndDate) {
          toast.error('Multi-use passes must specify an end date.')
          return
        }
      }
    }

    // 3. Build Dates, Time Windows, and Allowed Days
    let startDateObj = new Date()
    let endDateObj = new Date(Date.now() + 86400000 * 2)
    let timeWindowStart = undefined
    let timeWindowEnd = undefined
    let allowedDays = [0, 1, 2, 3, 4, 5, 6]

    if (inviteMethod === 'guest') {
      if (formData.startDate) startDateObj = new Date(formData.startDate)
      if (formData.endDate) endDateObj = new Date(formData.endDate)
    } else if (inviteMethod === 'group') {
      if (formData.eventDate) {
        startDateObj = new Date(formData.eventDate)
        endDateObj = new Date(formData.eventDate)
      }
      if (formData.eventStartTime) timeWindowStart = formData.eventStartTime
      if (formData.eventEndTime) timeWindowEnd = formData.eventEndTime
    } else if (inviteMethod === 'cab_delivery') {
      if (cabUsageType === 'one_time') {
        startDateObj = new Date()
        endDateObj = new Date()
        if (formData.timeWindow) {
          const parts = formData.timeWindow.split(' - ')
          if (parts.length === 2) {
            timeWindowStart = parts[0]
            timeWindowEnd = parts[1]
          }
        }
      } else {
        if (formData.startDate) startDateObj = new Date(formData.startDate)
        if (formData.endDate) endDateObj = new Date(formData.endDate)
        if (formData.eventStartTime) timeWindowStart = formData.eventStartTime
        if (formData.eventEndTime) timeWindowEnd = formData.eventEndTime
        allowedDays = formData.selectedDays || [1, 2, 3, 4, 5]
      }
    } else if (inviteMethod === 'service') {
      if (serviceUsageType === 'one_time') {
        startDateObj = new Date()
        endDateObj = new Date()
      } else {
        if (formData.startDate) startDateObj = new Date(formData.startDate)
        if (formData.endDate) endDateObj = new Date(formData.endDate)
        if (formData.eventStartTime) timeWindowStart = formData.eventStartTime
        if (formData.eventEndTime) timeWindowEnd = formData.eventEndTime
        allowedDays = formData.serviceSelectedDays || [1, 2, 3, 4, 5]
      }
    }

    // 4. Build Pass Max Uses count
    let maxUses = 1
    if (inviteMethod === 'guest') {
      maxUses = parseInt(formData.usageLimit || formData.maxUses, 10) || 1
    } else if (inviteMethod === 'group') {
      maxUses = parseInt(formData.totalTokens, 10) || 10
    } else if (inviteMethod === 'cab_delivery') {
      maxUses = cabUsageType === 'multi_use' ? 100 : 1
    } else if (inviteMethod === 'service') {
      maxUses = serviceUsageType === 'multi_use' ? 100 : 1
    }

    // 5. Build Visitor details name representation
    let visitorName = nameInput
    if (inviteMethod === 'group') {
      visitorName = eventNameInput
    } else if (inviteMethod === 'cab_delivery') {
      visitorName = companyNameInput
    } else if (inviteMethod === 'service') {
      visitorName = `${providerNameInput} (${serviceTypeInput})`
    }

    const userRoleName = currentUser?.role
    const matchedRoleObj = dbRoles.find((r) => r.name === userRoleName)
    const resolvedRoleId = matchedRoleObj ? matchedRoleObj._id : null

    // Normalize start/end dates to encompass full calendar days
    if (startDateObj) startDateObj.setHours(0, 0, 0, 0)
    if (endDateObj) endDateObj.setHours(23, 59, 59, 999)

    const payload = {
      orgId: activeOrgId || '60c72b2f9b1d8e25d88db652',
      createdById: currentUser?._id || currentUser?.id || '60c72b2f9b1d8e25d88db650',
      roleId: resolvedRoleId || undefined,
      passType:
        inviteMethod === 'cab_delivery'
          ? 'CAB'
          : inviteMethod === 'group'
            ? 'GUEST'
            : inviteMethod.toUpperCase(),
      isIdProofPass,
      isGroupPass: inviteMethod === 'group',
      visitorDetails: {
        name: visitorName,
        idProofType:
          (inviteMethod === 'guest' && guestPassType === 'id_proof') ||
          (inviteMethod === 'service' && servicePassType === 'id_proof')
            ? idProofTypeInput
            : 'None',
        idProofNumber:
          (inviteMethod === 'guest' && guestPassType === 'id_proof') ||
          (inviteMethod === 'service' && servicePassType === 'id_proof')
            ? idProofInput
            : '',
      },
      vehicleDetails: {
        number:
          inviteMethod === 'cab_delivery' && formData.cabCategory === 'cab'
            ? vehicleNumberInput
            : '',
      },
      validity: {
        startDate: startDateObj,
        endDate: endDateObj,
        timeWindowStart,
        timeWindowEnd,
        allowedDays,
        timeWindows:
          formData.timeWindows && formData.timeWindows.length > 0
            ? formData.timeWindows
            : undefined,
      },
      usageLimit: {
        maxUses,
      },
    }

    try {
      if (activeOrgId) {
        const created = await dispatch(createPass(payload)).unwrap()
        if (isIdProofPass) {
          toast.success('Visitor Invitation Created (ID-Only Pass)')
        } else {
          setGeneratedPass(created)
          toast.success('Pass created successfully.')
        }
        dispatch(fetchHistoryLogs({ orgId: activeOrgId, params: { page: 1, limit: 10 } }))
      } else {
        // Local state fallback
        const fallbackPass = {
          id: `G-${Math.floor(10000 + Math.random() * 90000)}`,
          method: inviteMethod,
          isIdProofPass,
          visitorName: payload.visitorDetails.name,
          details:
            inviteMethod === 'group'
              ? `Event: ${eventNameInput}`
              : inviteMethod === 'cab_delivery'
                ? (formData.cabCategory || 'delivery') === 'delivery'
                  ? `Order ID: ${orderIdInput}`
                  : `Plate: ${vehicleNumberInput}`
                : (inviteMethod === 'guest' && guestPassType === 'id_proof') ||
                    (inviteMethod === 'service' && servicePassType === 'id_proof')
                  ? `${idProofTypeInput}: ${idProofInput}`
                  : 'Default pre-approved',
          validity: `${startDateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })} - ${endDateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}`,
          usageLimit: {
            maxUses: payload.usageLimit.maxUses,
            currentUses: 0,
          },
          status: 'ACTIVE',
        }
        setLocalPasses((prev) => [fallbackPass, ...prev])
        if (isIdProofPass) {
          toast.success('Visitor Invitation Created (ID-Only Pass)')
        } else {
          setGeneratedPass(fallbackPass)
          toast.success('Pass generated locally!')
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create pass.')
    }

    // Reset Form fields completely
    setFormData(getInitialFormData())
  }

  const handleRevokePass = async (id) => {
    try {
      if (id.startsWith('G-')) {
        setLocalPasses((prev) =>
          prev.map((pass) => (pass.id === id ? { ...pass, status: 'REVOKED' } : pass)),
        )
        toast.success('Local pass revoked.')
      } else {
        await dispatch(updatePassStatus({ id, status: 'REVOKED' })).unwrap()
        toast.success('Pass status updated successfully.')
        if (activeOrgId) {
          dispatch(fetchHistoryLogs({ orgId: activeOrgId, params: { page: 1, limit: 10 } }))
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update status.')
    }
  }

  const handleCopyPass = (pass) => {
    const text = pass.shortKey || pass.id || pass._id
    navigator.clipboard.writeText(text)
    toast.success('Invitation code copied to clipboard!')
  }

  const handleApproveEntry = async (id) => {
    try {
      if (id.startsWith('W-')) {
        setLocalWalkins((prev) => prev.map((w) => (w.id === id ? { ...w, status: 'APPROVED' } : w)))
        toast.success('Visitor entry approved.')
      } else {
        await dispatch(resolveWalkIn({ id, status: 'APPROVE' })).unwrap()
        toast.success('Visitor entry approved.')
        if (activeOrgId) {
          dispatch(fetchHistoryLogs({ orgId: activeOrgId, params: { page: 1, limit: 10 } }))
          dispatch(fetchPendingApprovals(activeOrgId))
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to resolve request')
    }
  }

  const handleDenyEntry = async (id) => {
    try {
      if (id.startsWith('W-')) {
        setLocalWalkins((prev) => prev.map((w) => (w.id === id ? { ...w, status: 'DENIED' } : w)))
        toast.error('Visitor entry denied.')
      } else {
        await dispatch(resolveWalkIn({ id, status: 'REJECT' })).unwrap()
        toast.error('Visitor entry denied.')
        if (activeOrgId) {
          dispatch(fetchHistoryLogs({ orgId: activeOrgId, params: { page: 1, limit: 10 } }))
          dispatch(fetchPendingApprovals(activeOrgId))
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to resolve request')
    }
  }

  const handleSetBlacklist = async (arg) => {
    // Allows updating either redux or local state log depending on parameter signature
    if (typeof arg === 'function') {
      const records = arg(blacklist)
      const newlyAdded = records[0]

      const payload = {
        orgId: activeOrgId || '60c72b2f9b1d8e25d88db652',
        name: newlyAdded.name,
        phone: newlyAdded.phone,
        plate: newlyAdded.plate,
        reason: newlyAdded.reason,
      }

      try {
        if (activeOrgId) {
          await dispatch(addBlockProfile(payload)).unwrap()
        } else {
          setLocalBlacklist(records)
        }
      } catch (err) {
        toast.error(err.message || 'Failed to add block profile.')
      }
    } else {
      // Remove triggered (passing raw array minus unbanned ID)
      const difference = localBlacklist.filter((x) => !arg.some((y) => y.id === x.id))
      if (difference.length > 0) {
        const removed = localBlacklist.find((x) => !arg.includes(x))
        if (removed) {
          try {
            if (activeOrgId && !removed.id.startsWith('B-')) {
              await dispatch(removeBlockProfile(removed._id)).unwrap()
            } else {
              setLocalBlacklist(arg)
            }
          } catch (err) {
            toast.error(err.message || 'Failed to unban profile.')
          }
        }
      }
    }
  }

  return {
    activeTab,
    setActiveTab,
    inviteMethod,
    setInviteMethod,
    guestPassType,
    setGuestPassType,
    cabPassType,
    setCabPassType,
    cabUsageType,
    setCabUsageType,
    servicePassType,
    setServicePassType,
    serviceUsageType,
    setServiceUsageType,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    passes,
    walkins,
    logs,
    blacklist,
    setBlacklist: handleSetBlacklist,
    formData,
    handleInputChange,
    handleCreatePass,
    handleRevokePass,
    handleCopyPass,
    handleApproveEntry,
    handleDenyEntry,
    activeOrgId,
    generatedPass,
    setGeneratedPass,
  }
}

export default useAdminVisitorManagement
