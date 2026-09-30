import { useEffect, useState, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getConnections } from '../../integrationHub/store/integrationHubSlice.js'
import useMessageTemplates from './useMessageTemplates'
import { TEMPLATE_PURPOSES, missingPlaceholders, token } from '../constants/templatePurposes.js'

const CHANNEL_LABELS = { email: '📧 Email', sms: '💬 SMS Text' }

export const useTemplateEditorCanvas = (visible, onClose, initialPurpose = 'user_invitation') => {
  const dispatch = useDispatch()
  const {
    templates = [],
    isLoading,
    error: apiError,
    loadTemplates,
    saveTemplate,
  } = useMessageTemplates()

  const { connections = [], isLoading: isHubLoading = false } = useSelector(
    (state) => state.integrationHub || {},
  )

  const [templateId, setTemplateId] = useState(null)
  const [name, setName] = useState('')
  const [type, setType] = useState('email')
  const [purpose, setPurpose] = useState(initialPurpose)
  const [subject, setSubject] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [body, setBody] = useState('')
  const [validationError, setValidationError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const purposeConfig = TEMPLATE_PURPOSES[purpose] || TEMPLATE_PURPOSES.user_invitation

  // 1. Fetch templates and integrations on open
  useEffect(() => {
    if (visible) {
      loadTemplates()
      dispatch(getConnections({ limit: 100 }))
      setValidationError(null)
      setPurpose(initialPurpose)
    }
  }, [dispatch, visible, loadTemplates, initialPurpose])

  // 2. Channels offered = channels with an active Integration Hub connection ∩ channels the purpose supports
  const connectedTypes = useMemo(() => {
    if (!connections || !Array.isArray(connections)) return []
    const activeProviders = connections
      .filter((c) => c && c.provider)
      .map((c) => c.provider.toLowerCase())
    const channels = []
    if (activeProviders.includes('smtp') || activeProviders.includes('resend'))
      channels.push('email')
    if (activeProviders.includes('twilio')) channels.push('sms')
    return channels
  }, [connections])

  const availableTypes = useMemo(
    () =>
      connectedTypes
        .filter((c) => purposeConfig.channels.includes(c))
        .map((value) => ({ value, label: CHANNEL_LABELS[value] })),
    [connectedTypes, purposeConfig],
  )

  // 3. Load the saved template for (channel, purpose), or the purpose's starter content
  useEffect(() => {
    if (!visible || availableTypes.length === 0) return
    const channel = availableTypes.some((t) => t.value === type) ? type : availableTypes[0].value
    const match = templates.find((t) => t.type === channel && t.purpose === purpose)

    if (match) {
      setTemplateId(match._id)
      setName(match.name)
      setSubject(match.subject || '')
      setCc(match.cc || '')
      setBcc(match.bcc || '')
      setBody(match.body)
    } else {
      setTemplateId(null)
      setName(purposeConfig.defaultName)
      setSubject(purposeConfig.defaultSubject)
      setCc('')
      setBcc('')
      setBody(purposeConfig.defaultBody[channel] || purposeConfig.defaultBody.email)
    }
    if (channel !== type) setType(channel)
    setValidationError(null)
  }, [visible, templates, type, purpose, availableTypes, purposeConfig])

  const insertPlaceholder = (key) =>
    setBody((prev) => `${prev}${prev.endsWith('\n') ? '' : '\n'}${token(key)}`)

  const handleSave = async (e) => {
    e.preventDefault()
    setValidationError(null)

    if (!name.trim()) {
      setValidationError('Template name is required.')
      return
    }
    if (!type) {
      setValidationError('Please select an active integration channel.')
      return
    }
    const missing = missingPlaceholders(purpose, body)
    if (missing.length) {
      setValidationError(
        `This template must include ${missing.map((k) => `"${token(k)}"`).join(', ')} in the body.`,
      )
      return
    }

    setIsSubmitting(true)
    const result = await saveTemplate(templateId, {
      name,
      type,
      purpose,
      subject: type === 'email' ? subject : '',
      cc: type === 'email' ? cc : '',
      bcc: type === 'email' ? bcc : '',
      body,
    })
    setIsSubmitting(false)

    if (result.success) {
      onClose()
    } else {
      setValidationError(result.error)
    }
  }

  return {
    templates,
    isLoading,
    apiError,
    connections,
    isHubLoading,
    availableTypes,
    connectedTypes,
    templateId,
    name,
    setName,
    type,
    setType,
    purpose,
    setPurpose,
    purposeConfig,
    subject,
    setSubject,
    cc,
    setCc,
    bcc,
    setBcc,
    body,
    setBody,
    insertPlaceholder,
    validationError,
    setValidationError,
    isSubmitting,
    handleSave,
  }
}

export default useTemplateEditorCanvas
