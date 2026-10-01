import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CRow, CCol, CCard, CCardBody } from '@coreui/react'
import ComplaintTopNav from '../components/ComplaintTopNav'
import { useAuth } from '../../auth/hooks/useAuth'
import { useAmenities } from '../../amenities/hooks/useAmenities'
import { useComplaints } from '../hooks/useComplaints'
import toast from 'react-hot-toast'
import '../styles/_complaints.scss'

import { useLocation } from 'react-router-dom'

const ComplaintDashboard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser: user } = useAuth()

  const { amenities, loading } = useAmenities()

  const maintenanceNotices = useMemo(() => {
    const notices = []
    if (amenities && amenities.length > 0) {
      amenities.forEach((amenity) => {
        if (amenity.status === 'maintenance' || amenity.maintenanceSchedules?.length > 0) {
          const activeSchedules =
            amenity.maintenanceSchedules?.filter(
              (s) => s.status !== 'completed' && s.status !== 'cancelled',
            ) || []

          if (amenity.status === 'maintenance' && activeSchedules.length === 0) {
            notices.push({
              id: `amn-${amenity._id}`,
              title: `${amenity.name} is Closed`,
              message: `The ${amenity.name} is currently temporarily unavailable due to maintenance.`,
              timestamp: new Date(amenity.updatedAt || Date.now()),
            })
          }

          activeSchedules.forEach((schedule) => {
            notices.push({
              id: `amn-sch-${schedule._id}`,
              title: schedule.title || `${amenity.name} Maintenance`,
              message:
                schedule.description ||
                `Maintenance scheduled from ${schedule.startDate} to ${schedule.endDate}.`,
              timestamp: new Date(schedule.startDate),
            })
          })
        }
      })
    }
    return notices.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5)
  }, [amenities])

  // Handle deep linking for maintenance
  useEffect(() => {
    if (!loading && maintenanceNotices.length > 0) {
      const params = new URLSearchParams(location.search)
      const openMaintenanceId = params.get('openMaintenanceId')
      if (openMaintenanceId) {
        // Find the element and scroll to it
        setTimeout(() => {
          const el = document.getElementById(`maintenance-item-${openMaintenanceId}`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // Add a highlight class temporarily
            el.style.transition = 'all 0.5s'
            el.style.backgroundColor = 'var(--cui-info-bg-subtle, #e0f2fe)'
            el.style.borderColor = 'var(--cui-info, #0284c7)'
            setTimeout(() => {
              el.style.backgroundColor = ''
              el.style.borderColor = ''
            }, 3000)
          }
        }, 500)
      }
    }
  }, [loading, maintenanceNotices, location.search])

  const { createNewComplaint } = useComplaints()
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [generalFeedback, setGeneralFeedback] = useState('')
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

  const handleFeedbackSubmit = async () => {
    if (!generalFeedback.trim()) {
      toast.error('Please enter your feedback before submitting.')
      return
    }
    try {
      setIsSubmittingFeedback(true)
      await createNewComplaint({
        title: 'Resident Feedback',
        description: generalFeedback,
        category: 'Feedback',
        priority: 'Medium',
        department: 'Management',
        flat: user?.flat || '',
        name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Resident',
        isEmergency: false,
        location: {
          building: user?.building || '',
          tower: user?.tower || '',
          floor: user?.floor || '',
          flat: user?.flat || '',
        },
      })
      toast.success('Thank you! Your feedback has been submitted successfully.')
      setGeneralFeedback('')
      setShowFeedbackModal(false)
    } catch (error) {
      toast.error('Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  return (
    <div className="complaints-module-wrapper complaints-os-theme">
      <ComplaintTopNav />
      <div className="view-container">
        {/* PRIMARY ACTIONS - Sleek Grid Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            marginBottom: '48px',
          }}
        >
          {/* Action 1 */}
          <div
            onClick={() => navigate('/admin/complaints/create')}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px 24px',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              transition:
                'color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease, opacity 0.3s ease, width 0.3s ease, height 0.3s ease, max-height 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              overflow: 'hidden',
              borderBottom: '4px solid var(--primary)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="fs-3"
            >
              <i className="fa-solid fa-screwdriver-wrench"></i>
            </div>
            <div>
              <h3 style={{ color: 'var(--ink)', marginBottom: '8px' }} className="fw-bold fs-5">
                Raise a Ticket
              </h3>
              <p style={{ color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }} className="small">
                Report electrical, plumbing, or facility issues instantly.
              </p>
            </div>
          </div>

          {/* Action 2 */}
          <div
            onClick={() => navigate('/admin/complaints/my-tickets')}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px 24px',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              transition:
                'color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease, opacity 0.3s ease, width 0.3s ease, height 0.3s ease, max-height 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              overflow: 'hidden',
              borderBottom: '4px solid var(--warning)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--warning-light)',
                color: 'var(--warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="fs-3"
            >
              <i className="fa-solid fa-magnifying-glass-location"></i>
            </div>
            <div>
              <h3 style={{ color: 'var(--ink)', marginBottom: '8px' }} className="fw-bold fs-5">
                Track Requests
              </h3>
              <p style={{ color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }} className="small">
                Check the real-time status of your reported issues.
              </p>
            </div>
          </div>

          {/* Action 3 */}
          <div
            onClick={() => setShowFeedbackModal(true)}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px 24px',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              transition:
                'color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease, opacity 0.3s ease, width 0.3s ease, height 0.3s ease, max-height 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              overflow: 'hidden',
              borderBottom: '4px solid var(--danger)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="fs-3"
            >
              <i className="fa-solid fa-comment-dots"></i>
            </div>
            <div>
              <h3 style={{ color: 'var(--ink)', marginBottom: '8px' }} className="fw-bold fs-5">
                Provide Feedback
              </h3>
              <p style={{ color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }} className="small">
                Share your suggestions or overall feedback with us.
              </p>
            </div>
          </div>

          {/* Action 4: App Issue Reports */}
          <div
            onClick={() => navigate('/admin/complaints/issue-reports')}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px 24px',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              transition:
                'color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease, opacity 0.3s ease, width 0.3s ease, height 0.3s ease, max-height 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              overflow: 'hidden',
              borderBottom: '4px solid #f43f5e',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#ffe4e6',
                color: '#f43f5e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="fs-3"
            >
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <h3 style={{ color: 'var(--ink)', marginBottom: '8px' }} className="fw-bold fs-5">
                App Issue Reports
              </h3>
              <p style={{ color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }} className="small">
                Track and inspect bugs or feature requests reported by residents.
              </p>
            </div>
          </div>
        </div>

        {/* MAINTENANCE BOARD */}

        <div>
          <h3 style={{ color: 'var(--ink)', margin: '0 0 16px 0' }} className="fw-bold fs-6">
            Maintenance Board
          </h3>

          {loading ? (
            <div
              className="notice-card-simple"
              style={{ justifyContent: 'center', color: 'var(--ink-faint)' }}
            >
              Loading maintenance updates...
            </div>
          ) : maintenanceNotices.length > 0 ? (
            <div className="notice-list">
              {maintenanceNotices.map((notice) => (
                <div
                  key={notice.id}
                  id={`maintenance-item-${notice.id}`}
                  className="notice-card-simple"
                >
                  <div className="notice-icon-simple">
                    <i className="fa-solid fa-bullhorn"></i>
                  </div>
                  <div className="notice-content-simple">
                    <div className="notice-title-simple">{notice.title}</div>
                    <div className="notice-desc-simple">{notice.message}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="notice-card-simple"
              style={{ justifyContent: 'center', color: 'var(--ink-faint)' }}
            >
              No active maintenance announcements.
            </div>
          )}
        </div>
      </div>

      {showFeedbackModal && (
        <div
          className="modal-overlay active"
          style={{
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            padding: '20px',
          }}
        >
          <div
            className="modal-box"
            style={{
              width: '100%',
              maxWidth: '500px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              className="modal-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg)',
              }}
            >
              <h4 style={{ margin: 0, color: 'var(--ink)' }} className="fw-semibold fs-5">
                General Feedback
              </h4>
              <button
                onClick={() => setShowFeedbackModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: 'var(--ink-soft)',
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label
                    style={{ display: 'block', color: 'var(--ink)', marginBottom: '8px' }}
                    className="fw-semibold small"
                  >
                    Your Feedback
                  </label>
                  <textarea
                    rows="5"
                    className="form-control"
                    value={generalFeedback}
                    onChange={(e) => setGeneralFeedback(e.target.value)}
                    placeholder="Tell us what's on your mind..."
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      fontSize: '14px',
                      outline: 'none',
                      resize: 'vertical',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                    }}
                  ></textarea>
                </div>
              </div>
            </div>
            <div
              className="modal-footer d-flex align-items-center justify-content-end gap-3"
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg)',
              }}
            >
              <button
                className="btn btn-ghost"
                onClick={() => setShowFeedbackModal(false)}
                disabled={isSubmittingFeedback}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleFeedbackSubmit}
                disabled={isSubmittingFeedback}
              >
                {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComplaintDashboard
