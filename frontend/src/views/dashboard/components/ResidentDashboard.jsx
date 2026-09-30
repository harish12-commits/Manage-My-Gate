import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CForm,
  CFormLabel,
  CFormInput,
  CBadge,
  CSpinner,
  CAlert,
  CPagination,
  CPaginationItem,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilHome, cilPeople, cilPhone, cilCheckCircle, cilNotes, cilBullhorn } from '@coreui/icons'
import apiClient from '../../../services/apiClient'
import toast from 'react-hot-toast'
import AppLoader from '../../../components/common/AppLoader'

export const ResidentDashboard = () => {
  const { user } = useSelector((state) => state.auth)
  const [villaDetails, setVillaDetails] = useState(null)
  const [loading, setLoading] = useState(false)

  // Guest pass generator state
  const [guestName, setGuestName] = useState('')
  const [generatedPass, setGeneratedPass] = useState(null)

  const navigate = useNavigate()
  const [announcements, setAnnouncements] = useState([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  const fetchAnnouncements = () => {
    setAnnouncementsLoading(true)
    apiClient
      .get('/dashboard-feed/announcements')
      .then((res) => {
        setAnnouncements(res.data?.data || [])
        // Keep current page unless it's out of bounds after an update, but usually let's not reset to 1 automatically on interval
      })
      .catch((err) => {
        console.error('Failed to load dashboard announcements', err)
      })
      .finally(() => {
        setAnnouncementsLoading(false)
      })
  }

  useEffect(() => {
    fetchAnnouncements()
    const intervalId = setInterval(fetchAnnouncements, 30000)
    return () => clearInterval(intervalId)
  }, [])

  const formatRelativeTime = (isoDate, timeString = '') => {
    if (!isoDate) return ''
    const target = new Date(isoDate)
    const now = new Date()
    const diffMs = target - now
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return `Today ${timeString}`
    if (diffDays === 1) return `Tomorrow ${timeString}`
    if (diffDays === -1) return `Yesterday ${timeString}`
    if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days ${timeString}`

    return `${target.toLocaleDateString()} ${timeString}`
  }

  const handleAnnouncementClick = (item) => {
    if (item.type === 'NOTICE') {
      navigate(`/dashboard/community-notices/${item.id}`)
    } else if (item.type === 'AMENITY_MAINTENANCE') {
      navigate(`/dashboard/maintenance/${item.id}`)
    }
  }

  useEffect(() => {
    if (user?.villaId) {
      setLoading(true)
      apiClient
        .get(`/villas/${user.villaId}`)
        .then((res) => {
          setVillaDetails(res.data || null)
        })
        .catch((err) => {
          console.error('Failed to load resident villa details:', err)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [user])

  const handleCreatePass = (e) => {
    e.preventDefault()
    if (!guestName.trim()) return

    // Generate a mock pass code and timestamp
    const passCode = `G-${Math.floor(100000 + Math.random() * 900000)}`
    setGeneratedPass({
      guestName: guestName.trim(),
      code: passCode,
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString(),
    })
    setGuestName('')
    toast.success(`Guest pass generated for ${guestName.trim()}`)
  }

  const handleCopyPass = () => {
    if (!generatedPass) return
    const text = `Nahom Guest Pass\nGuest: ${generatedPass.guestName}\nCode: ${generatedPass.code}\nValid Until: ${generatedPass.validUntil}`
    navigator.clipboard.writeText(text)
    toast.success('Copied pass details to clipboard!')
  }

  // Calculate pagination state
  const totalPages = Math.ceil(announcements.length / itemsPerPage)
  const currentAnnouncements = announcements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  )
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, announcements.length)

  if (!user?.villaId) {
    return (
      <CAlert color="warning" className="text-center py-5 shadow-sm border-0 rounded-4">
        <CIcon icon={cilHome} size="xl" className="mb-3 text-warning" />
        <h4>Pending Unit Allocation</h4>
        <p className="text-muted">
          Your account is active, but you are not linked to a villa. Please contact your Community
          Administrator to allocate your unit.
        </p>
      </CAlert>
    )
  }

  return (
    <div className="resident-portal-dashboard">
      <h1 className="portal-main-title text-start mb-4">
        My Villa Portal — {villaDetails?.villa?.villaNumber || user.villaNumber}
      </h1>

      <CRow className="g-4">
        {/* Left column: Villa Stats and Co-residents */}
        <CCol lg={7}>
          {loading || !villaDetails ? (
            <div className="text-center py-5 bg-body rounded-4 shadow-sm border">
              <AppLoader variant="block" />
              <div>Loading villa occupancy data...</div>
            </div>
          ) : (
            <>
              {/* Unit Card */}
              <CCard
                className="border-0 shadow-sm rounded-4 mb-4"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                  color: 'white',
                }}
              >
                <CCardBody className="p-4">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <h4 className="fw-bold mb-0">{villaDetails.villa.villaNumber}</h4>
                      <span className="badge bg-body text-primary mt-1 fw-bold">
                        {villaDetails.villa.block || 'Main Block'}
                      </span>
                    </div>
                    <CBadge
                      color="success"
                      className="px-2 py-1 text-uppercase fw-bold"
                      style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid white' }}
                    >
                      {user.residentType} Status
                    </CBadge>
                  </div>

                  <CRow className="mt-4 pt-2 border-top border-white-50">
                    <CCol xs={6}>
                      <div className="text-white-50 small">INTERCOM EXTENSION</div>
                      <div className="fw-bold fs-5 d-flex align-items-center gap-2 mt-1">
                        <CIcon icon={cilPhone} style={{ width: '16px' }} />
                        {villaDetails.villa.intercom || 'None'}
                      </div>
                    </CCol>
                    <CCol xs={6}>
                      <div className="text-white-50 small">UNIT CONFIG</div>
                      <div className="fw-bold fs-5 d-flex align-items-center gap-2 mt-1">
                        <CIcon icon={cilHome} style={{ width: '16px' }} />
                        {villaDetails.villa.configuration || 'Not set'}
                      </div>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>

              {/* Co-residents Directory */}
              <CCard className="border-0 shadow-sm rounded-4">
                <CCardHeader className="bg-transparent border-0 pt-4 px-4 pb-2 d-flex align-items-center gap-2">
                  <CIcon icon={cilPeople} className="text-primary" style={{ width: '18px' }} />
                  <h5 className="mb-0 fw-bold">Co-residents Directory</h5>
                </CCardHeader>
                <CCardBody className="px-4 pb-4">
                  {villaDetails.residents.length <= 1 ? (
                    <div className="text-center py-4 bg-body-secondary rounded-3 text-muted small">
                      No other family members or co-residents registered yet.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {villaDetails.residents
                        .filter((r) => r.id !== user.id)
                        .map((res) => (
                          <div
                            key={res.id}
                            className="d-flex align-items-center justify-content-between p-3 border rounded-3 bg-body-secondary-subtle"
                          >
                            <div className="d-flex align-items-center gap-3">
                              <div
                                className="rounded-circle bg-primary text-white fw-bold d-flex align-items-center justify-content-center"
                                style={{ width: '40px', height: '40px', fontSize: '0.9rem' }}
                              >
                                {res.name ? res.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <div className="fw-semibold text-body-emphasis">
                                  {res.name || res.email.split('@')[0]}
                                </div>
                                <div className="text-muted small">{res.email}</div>
                              </div>
                            </div>
                            <div>
                              <CBadge
                                color="info"
                                className="text-uppercase fw-semibold"
                                style={{ fontSize: '0.65rem' }}
                              >
                                {res.residentType}
                              </CBadge>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </>
          )}
        </CCol>

        {/* Right Column */}
        <CCol xs={12} lg={4}>
          {/* Visitor Pass */}
          <CCard className="border-0 shadow-sm rounded-4 mb-4">
            <CCardHeader className="bg-transparent border-0 pt-4 px-4 pb-2 d-flex align-items-center gap-2">
              <CIcon icon={cilCheckCircle} className="text-success" style={{ width: '18px' }} />
              <h5 className="mb-0 fw-bold">Visitor Gate Pass</h5>
            </CCardHeader>
            <CCardBody className="px-4 pb-4">
              {generatedPass ? (
                <div className="text-center p-3 bg-success bg-opacity-10 rounded-3 border border-success border-opacity-25">
                  <div className="small fw-semibold text-success mb-2 text-uppercase tracking-wide">
                    Pass Generated
                  </div>
                  <div
                    className="display-6 fw-bold text-success mb-2"
                    style={{ letterSpacing: '0.05em' }}
                  >
                    {generatedPass.code}
                  </div>
                  <div className="text-muted small mb-4">
                    Valid Until: {generatedPass.validUntil}
                  </div>
                  <div className="d-flex gap-2">
                    <CButton
                      color="outline-success"
                      size="sm"
                      className="w-50 fw-semibold"
                      onClick={() => setGeneratedPass(null)}
                    >
                      New Pass
                    </CButton>
                    <CButton
                      color="success"
                      size="sm"
                      className="w-50 fw-semibold text-white"
                      onClick={handleCopyPass}
                    >
                      Share Details
                    </CButton>
                  </div>
                </div>
              ) : (
                <CForm onSubmit={handleCreatePass}>
                  <div className="mb-3">
                    <CFormLabel htmlFor="guest-name-input" className="small fw-semibold text-muted">
                      GUEST NAME
                    </CFormLabel>
                    <CFormInput
                      id="guest-name-input"
                      type="text"
                      placeholder="Enter guest name..."
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required
                    />
                  </div>
                  <CButton type="submit" color="primary" className="w-100 fw-semibold text-white">
                    Generate Entry Code
                  </CButton>
                </CForm>
              )}
            </CCardBody>
          </CCard>

          {/* Unified Announcement Feed */}
          <CCard className="border-0 shadow-sm rounded-4">
            <CCardHeader className="bg-transparent border-0 pt-4 px-4 pb-2 d-flex align-items-center gap-2">
              <CIcon icon={cilBullhorn} className="text-warning" style={{ width: '18px' }} />
              <h5 className="mb-0 fw-bold">Dashboard Feed</h5>
            </CCardHeader>
            <CCardBody className="px-4 pb-4">
              {announcementsLoading ? (
                <div className="text-center p-4">
                  <CSpinner color="primary" size="sm" />
                </div>
              ) : announcements.length > 0 ? (
                <div className="d-flex flex-column gap-3">
                  {currentAnnouncements.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 border-start border-4 bg-white shadow-sm rounded-3 cursor-pointer mb-3 ${item.type === 'NOTICE' ? 'border-primary' : 'border-warning'}`}
                      onClick={() => handleAnnouncementClick(item)}
                      style={{ transition: 'transform 0.2s, box-shadow 0.2s' }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.classList.replace('shadow-sm', 'shadow')
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.classList.replace('shadow', 'shadow-sm')
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div
                          className={`fw-bold small d-flex align-items-center gap-2 ${item.type === 'NOTICE' ? 'text-primary' : 'text-warning'}`}
                        >
                          {item.type === 'NOTICE' ? (
                            <>
                              <CIcon icon={cilBullhorn} size="sm" /> Community Notice
                            </>
                          ) : (
                            <>
                              <CIcon icon={cilCheckCircle} size="sm" /> Amenity Maintenance
                            </>
                          )}
                        </div>
                        {item.priority &&
                          ['High', 'Critical', 'high', 'critical'].includes(item.priority) && (
                            <CBadge color="danger" shape="rounded-pill">
                              High Priority
                            </CBadge>
                          )}
                      </div>

                      <div className="fw-bold text-dark fs-6 mb-1">{item.title}</div>
                      <p className="text-secondary small mb-3 text-truncate">{item.description}</p>

                      <div className="d-flex justify-content-between align-items-center border-top pt-2 mt-2">
                        <div
                          className="text-muted fw-medium text-truncate pe-2"
                          style={{ fontSize: '0.75rem' }}
                        >
                          <CIcon icon={cilNotes} size="sm" className="me-1" />
                          {item.type === 'NOTICE'
                            ? formatRelativeTime(item.createdAt)
                            : formatRelativeTime(
                                item.metadata?.startDate,
                                item.metadata?.startTime
                                  ? `${item.metadata.startTime} - ${item.metadata.endTime || ''}`
                                  : '',
                              )}
                        </div>
                        <div
                          className="text-muted text-end"
                          style={{ fontSize: '0.70rem', minWidth: '80px' }}
                        >
                          <span className="text-truncate d-block">By {item.createdBy}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                      <div className="text-muted small">
                        Showing {startItem} to {endItem} of {announcements.length} entries
                      </div>
                      <CPagination
                        className="mb-0"
                        size="sm"
                        aria-label="Dashboard feed pagination"
                      >
                        <CPaginationItem
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => p - 1)}
                        >
                          Previous
                        </CPaginationItem>
                        {[...Array(totalPages)].map((_, i) => (
                          <CPaginationItem
                            key={i + 1}
                            active={i + 1 === currentPage}
                            onClick={() => setCurrentPage(i + 1)}
                          >
                            {i + 1}
                          </CPaginationItem>
                        ))}
                        <CPaginationItem
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => p + 1)}
                        >
                          Next
                        </CPaginationItem>
                      </CPagination>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted small p-4 bg-body-secondary rounded-3">
                  No announcements at this time.
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  )
}

export default ResidentDashboard
