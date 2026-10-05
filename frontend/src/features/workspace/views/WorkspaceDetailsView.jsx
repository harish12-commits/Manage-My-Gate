import React from 'react'
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CForm,
  CFormInput,
  CButton,
  CSpinner,
  CAlert,
  CNav,
  CNavItem,
  CNavLink,
  CFormSwitch,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CFormSelect,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import * as CoreIcons from '@coreui/icons'
import { cilQrCode, cilSettings } from '@coreui/icons'
import useWorkspaceDetails from '../hooks/useWorkspaceDetails.js'
import SearchableLanguageSelect from '../components/SearchableLanguageSelect.jsx'
import '../../visitorManagement/styles/_visitorManagement.scss'
import '../styles/_workspace.scss'
import AppLoader from '../../../components/common/AppLoader'

export const WorkspaceDetailsView = () => {
  const {
    t,
    // Redux selectors
    activeWorkspaceDetails,
    workspaceModules,
    wsError,
    activeRole,
    // States & state setters
    activeTab,
    setActiveTab,
    // Forms
    editForm,
    // Action handlers
    handleGeneralInfoSubmit,
    handleModuleToggle,
  } = useWorkspaceDetails()

  const isManager = ['Platform Super Admin', 'Super Admin', 'Community Admin'].includes(activeRole)

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    watch: watchEdit,
    setValue: setValueEdit,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = editForm

  // Icon mapping matching sidebar keys
  const iconMap = {
    Users: CoreIcons.cilPeople,
    People: CoreIcons.cilPeople,
    Building2: CoreIcons.cilBuilding,
    Building: CoreIcons.cilBuilding,
    ShieldCheck: CoreIcons.cilShieldAlt,
    Wallet: CoreIcons.cilWallet,
    Bell: CoreIcons.cilWarning,
    CalendarDays: CoreIcons.cilCalendar,
    Wrench: CoreIcons.cilSettings,
    Home: CoreIcons.cilHome,
    QrCode: CoreIcons.cilQrCode,
    Speedometer: CoreIcons.cilSpeedometer,
    Apps: CoreIcons.cilApps,
    List: CoreIcons.cilList,
    LockLocked: CoreIcons.cilLockLocked,
    Warning: CoreIcons.cilWarning,
    Settings: CoreIcons.cilSettings,
  }

  // List of standard icons for dropdown selectors
  const availableIconsList = [
    { label: 'Home', value: 'Home' },
    { label: 'Building', value: 'Building2' },
    { label: 'Shield Check', value: 'ShieldCheck' },
    { label: 'Wallet', value: 'Wallet' },
    { label: 'Bell', value: 'Bell' },
    { label: 'Calendar', value: 'CalendarDays' },
    { label: 'Wrench', value: 'Wrench' },
    { label: 'Users', value: 'Users' },
    { label: 'QR Code', value: 'QrCode' },
    { label: 'Speedometer', value: 'Speedometer' },
    { label: 'Apps', value: 'Apps' },
    { label: 'List', value: 'List' },
    { label: 'Lock Locked', value: 'LockLocked' },
    { label: 'Warning', value: 'Warning' },
    { label: 'Settings', value: 'Settings' },
  ]

  if (!activeWorkspaceDetails) {
    if (wsError) {
      return (
        <CContainer className="py-5">
          <CAlert color="danger">{wsError}</CAlert>
        </CContainer>
      )
    }
    return (
      <div className="text-center py-5">
        <AppLoader variant="block" />
        <div>{t('workspace.details.loading', 'Loading workspace settings...')}</div>
      </div>
    )
  }

  // Navigation tabs layout matching the Visitor Management bar style
  const navTabs = [
    { id: 'create', name: 'Module Management', icon: cilQrCode },
    { id: 'settings', name: 'Workspace Settings', icon: cilSettings },
  ]

  return (
    <div className="workspace-details-view py-3 visitor-os-theme">
      <CContainer fluid>
        {wsError && (
          <CAlert color="danger" dismissible>
            {wsError}
          </CAlert>
        )}

        {/* Top bar container with the Visitor Management navigation styling */}
        <div className="visitor-top-nav-bar d-flex justify-content-between align-items-center flex-wrap gap-3">
          <CNav
            variant="underline"
            style={{
              borderBottom: 'none',
              gap: '16px',
              flexWrap: 'nowrap',
              minWidth: 'max-content',
              paddingBottom: '4px',
            }}
          >
            {navTabs.map((item) => {
              const isActive = activeTab === item.id
              return (
                <CNavItem key={item.id}>
                  <CNavLink
                    href="#"
                    active={isActive}
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab(item.id)
                    }}
                    className={`visitor-top-nav-link ${isActive ? 'active' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={item.icon} size="lg" style={{ marginBottom: '4px' }} />
                    {item.name}
                  </CNavLink>
                </CNavItem>
              )
            })}
          </CNav>
        </div>

        <CCard className="mb-4 border-0 shadow-sm rounded-4">
          <CCardBody className="p-4">
            {/* 2. MODULE MANAGEMENT (FEATURES LIST & CREATE MODULE) TAB */}
            {activeTab === 'create' && (
              <div>
                {/* Header aligned with the reference UI mockup */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h3 className="fw-bold text-dark mb-0" style={{ fontSize: '24px' }}>
                    {t('workspace.details.createHeader', 'Module Management')}
                  </h3>
                </div>

                <p className="text-muted mb-4" style={{ fontSize: '14.5px', lineHeight: '1.6' }}>
                  Turn a feature on and it shows up in the sidebar on the left. Turn it off, and
                  it's gone from the sidebar completely -- not greyed out, just not there.
                </p>

                {/* Dynamic Modules Card Listing */}
                <div className="d-flex flex-column gap-3 mt-4">
                  {(workspaceModules || []).map((mod) => {
                    if (!mod) return null
                    const IconComponent = iconMap[mod.icon] || CoreIcons.cilApps
                    return (
                      <div
                        key={mod._id}
                        className="d-flex align-items-center justify-content-between p-3 border rounded-3 bg-white shadow-sm"
                        style={{ minHeight: '80px', borderColor: '#f1f5f9' }}
                      >
                        <div className="d-flex align-items-center gap-3">
                          {/* Left icon wrapper */}
                          <div
                            className="rounded-3 d-flex align-items-center justify-content-center bg-light text-secondary border"
                            style={{ width: '48px', height: '48px', backgroundColor: '#f8fafc' }}
                          >
                            <CIcon icon={IconComponent} size="lg" style={{ color: '#475569' }} />
                          </div>
                          <div>
                            <h5 className="mb-1 fw-bold text-dark" style={{ fontSize: '16px' }}>
                              {mod.moduleName}
                            </h5>
                            <span
                              className="small"
                              style={{
                                color: mod.enabled
                                  ? 'var(--text-muted, #64748b)'
                                  : 'var(--text-light, #94a3b8)',
                                fontWeight: '500',
                              }}
                            >
                              {mod.enabled ? 'Visible in sidebar' : 'Hidden from sidebar'}
                            </span>
                          </div>
                        </div>

                        {/* Right side controls */}
                        <div className="d-flex align-items-center gap-3">
                          <CFormSwitch
                            id={`toggle-visibility-${mod._id}`}
                            checked={mod.enabled}
                            disabled={!isManager}
                            onChange={() => handleModuleToggle(mod._id, mod.enabled)}
                            style={{
                              transform: 'scale(1.25)',
                              cursor: !isManager ? 'not-allowed' : 'pointer',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}

                  {workspaceModules.length === 0 && (
                    <div className="text-center py-5 text-muted border border-dashed rounded-3">
                      {t(
                        'workspace.details.noFeatures',
                        'No dynamic features registered in this workspace yet.',
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. WORKSPACE SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div>
                <h4 className="mb-4 fw-bold">
                  {t('workspace.details.settingsHeader', 'Workspace Settings')}
                </h4>

                {/* General config form */}
                <h5 className="fw-semibold text-dark mb-3">
                  {t('workspace.details.metaTitle', 'Workspace Metadata')}
                </h5>
                <CForm onSubmit={handleSubmitEdit(handleGeneralInfoSubmit)} className="mb-5">
                  <CRow className="g-3">
                    <CCol md={6}>
                      <CFormInput
                        label={t('workspace.details.nameLabel', 'Workspace Name *')}
                        disabled={!isManager}
                        {...registerEdit('workspaceName', {
                          required: 'Workspace name is required.',
                        })}
                        feedbackInvalid={editErrors.workspaceName?.message}
                        invalid={!!editErrors.workspaceName}
                      />
                    </CCol>
                    <CCol md={6}>
                      <CFormInput
                        label={t('workspace.details.descLabel', 'Workspace Description')}
                        disabled={!isManager}
                        {...registerEdit('description')}
                      />
                    </CCol>
                    <CCol md={6}>
                      <CFormInput
                        label={t('workspace.details.orgNameLabel', 'Community Name')}
                        disabled={!isManager}
                        {...registerEdit('organizationName')}
                      />
                    </CCol>
                    <CCol md={6}>
                      <CFormSelect
                        label={t('workspace.details.timeZoneLabel', 'Time Zone')}
                        disabled={!isManager}
                        {...registerEdit('timeZone')}
                      >
                        <option value="">
                          {t('workspace.details.selectTimeZone', 'Select Time Zone')}
                        </option>
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                        <option value="GMT">GMT (Greenwich Mean Time)</option>
                        <option value="BST">BST (British Summer Time)</option>
                        <option value="CET">CET (Central European Time)</option>
                        <option value="EET">EET (Eastern European Time)</option>
                        <option value="AST">AST (Arabia Standard Time - UTC+3)</option>
                        <option value="GST">GST (Gulf Standard Time - UTC+4)</option>
                        <option value="IST">IST (Indian Standard Time - UTC+5:30)</option>
                        <option value="SGT">SGT (Singapore Time - UTC+8)</option>
                        <option value="JST">JST (Japan Standard Time - UTC+9)</option>
                        <option value="AEST">
                          AEST (Australian Eastern Standard Time - UTC+10)
                        </option>
                        <option value="NZST">NZST (New Zealand Standard Time - UTC+12)</option>
                        <option value="PST">PST (Pacific Standard Time - UTC-8)</option>
                        <option value="MST">MST (Mountain Standard Time - UTC-7)</option>
                        <option value="CST">CST (Central Standard Time - UTC-6)</option>
                        <option value="EST">EST (Eastern Standard Time - UTC-5)</option>
                      </CFormSelect>
                    </CCol>
                    <CCol md={6}>
                      <SearchableLanguageSelect
                        label={t('workspace.details.languageLabel', 'Language')}
                        disabled={!isManager}
                        value={watchEdit('language')}
                        onChange={(val) =>
                          setValueEdit('language', val, { shouldDirty: true, shouldValidate: true })
                        }
                      />
                    </CCol>
                    <CCol md={6}>
                      <CFormInput
                        type="email"
                        label={t('workspace.details.emailLabel', 'Contact Email')}
                        disabled={!isManager}
                        {...registerEdit('contactEmail')}
                        feedbackInvalid={editErrors.contactEmail?.message}
                        invalid={!!editErrors.contactEmail}
                      />
                    </CCol>
                    <CCol md={6}>
                      <CFormInput
                        type="tel"
                        label={t('workspace.details.phoneLabel', 'Contact Phone')}
                        disabled={!isManager}
                        {...registerEdit('contactPhone')}
                      />
                    </CCol>
                  </CRow>
                  {isManager && (
                    <div className="mt-4 text-end">
                      <CButton
                        type="submit"
                        color="primary"
                        disabled={isEditSubmitting || !editForm.formState.isDirty}
                      >
                        {isEditSubmitting ? (
                          <CSpinner size="sm" />
                        ) : (
                          t('workspace.details.save', 'Save Changes')
                        )}
                      </CButton>
                    </div>
                  )}
                </CForm>
              </div>
            )}
          </CCardBody>
        </CCard>
      </CContainer>
    </div>
  )
}

export default WorkspaceDetailsView
