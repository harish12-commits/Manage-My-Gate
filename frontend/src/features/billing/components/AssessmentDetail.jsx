import React, { memo, useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useDispatch } from 'react-redux'
import toast from 'react-hot-toast'
import { fetchRoles } from '../../roleBuilder/services/roleApi'
import { triggerInvoiceGenerationThunk } from '../store/billingSlice.js'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilCheckCircle, cilPeople, cilInfo } from '@coreui/icons'

/**
 * AssessmentDetail
 *
 * Right-panel component of the Assessment Manager tab.
 * Shows the dynamic configuration details (scope, targets, calculation method)
 * for the selected assessment template.
 */
export const AssessmentDetail = memo(({ assessment = null, onEdit, onRunBilling }) => {
  const dispatch = useDispatch()
  const [allRoles, setAllRoles] = useState([])

  useEffect(() => {
    let active = true
    const loadRoles = async () => {
      try {
        const res = await fetchRoles({ page: 1, limit: 100 })
        if (active && res?.data) {
          setAllRoles(res.data)
        }
      } catch (err) {
        console.error('Failed to load roles in details:', err)
      }
    }
    loadRoles()
    return () => {
      active = false
    }
  }, [])

  if (!assessment) {
    return (
      <div className="card card-hover card-accent-primary assessment-detail-card">
        <div className="mb-3">
          <h3 className="assessment-detail-title">
            <CIcon icon={cilPeople} className="text-primary me-2 icon-size-20" />
            Configured Residents
          </h3>
          <p className="assessment-detail-sub">
            People and units linked to the selected assessment template.
          </p>
        </div>

        <div className="empty-state-container flex-fill p-4 d-flex flex-column align-items-center justify-content-center text-center">
          <div className="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center mb-3 avatar-size-64">
            <CIcon icon={cilInfo} className="text-primary icon-size-24" />
          </div>
          <span className="empty-state-text-main fw-bold text-dark fs-6">
            No assessment selected
          </span>
          <span className="empty-state-text-sub text-muted small mt-1 max-w-240">
            Select an assessment template from the list to view its configured residents and units.
          </span>
        </div>
      </div>
    )
  }

  // Helper to format target roles list
  const getRoleNames = () => {
    const roleIds = assessment.targetScope?.targetRoleIds || []
    if (roleIds.length === 0) return 'None'
    return roleIds
      .map((id) => {
        const found = allRoles.find((r) => r._id === id)
        return found ? found.name : 'Resident'
      })
      .join(', ')
  }

  const getScopeLabel = (type) => {
    if (type === 'ALL_COMMUNITY') return '🌍 All Community'
    if (type === 'VILLA_BLOCK') return '🏢 Villa / Block'
    if (type === 'UNIT_TYPE') return '📐 Unit Type'
    if (type === 'SPECIFIC_UNITS') return '🏡 Specific Units'
    return '👥 Specific Users'
  }

  const calc = assessment.calculationMethod || {}

  return (
    <div className="card card-hover card-accent-primary assessment-detail-card">
      {/* ── Card Header ─────────────────────────────────────────────── */}
      <div className="assessment-detail-header">
        <div>
          <h3 className="assessment-detail-title">
            <CIcon icon={cilCheckCircle} className="text-success me-2 icon-size-18" />
            Active Configuration
          </h3>
          <p className="assessment-detail-sub">Details for {assessment.name}</p>
        </div>
        <div className="d-flex flex-wrap gap-2 justify-content-end">
          <button
            type="button"
            className="btn btn-success btn-sm rounded-3 text-nowrap d-flex align-items-center"
            onClick={() => {
              const billingPeriodString = window.prompt(
                'Enter Billing Period (e.g. 2026-07):',
                new Date().toISOString().substring(0, 7),
              )
              if (!billingPeriodString) return
              dispatch(
                triggerInvoiceGenerationThunk({
                  assessmentId: assessment._id,
                  billingPeriodString,
                }),
              )
                .unwrap()
                .then(() => toast.success('WhatsApp links generated & sent!'))
                .catch((err) => toast.error('Failed to trigger: ' + err))
            }}
          >
            <i className="fa-brands fa-whatsapp me-1 small" /> Send Payment Link via WhatsApp
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm rounded-3 text-nowrap d-flex align-items-center"
            onClick={() => onRunBilling && onRunBilling(assessment)}
          >
            <i className="fa-solid fa-play me-1 small" /> Run Billing
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm rounded-3 text-nowrap d-flex align-items-center"
            onClick={() => onEdit && onEdit(assessment)}
          >
            <CIcon icon={cilPencil} className="me-1 icon-size-12" /> Edit Template
          </button>
        </div>
      </div>

      {/* ── Detail Panel list ────────────────────────────────────────── */}
      <div className="flex-fill d-flex flex-column gap-3">
        {/* Name & Type */}
        <div className="assessment-detail-panel">
          <div className="assessment-detail-panel__label">Assessment Name</div>
          <div className="assessment-detail-panel__val">{assessment.name}</div>
          <div className="d-flex gap-2 mt-2">
            <span className="badge bg-primary-subtle text-primary">{assessment.type}</span>
            <span className="badge bg-secondary-subtle text-secondary">
              Cycle: {assessment.billingCycle}
            </span>
          </div>
        </div>

        {/* Target Scope */}
        <div className="assessment-detail-panel">
          <div className="assessment-detail-panel__label">Target Scope</div>
          <div className="d-flex align-items-center justify-content-between mt-1">
            <span className="fw-bold text-dark small">
              {getScopeLabel(assessment.targetScope?.type)}
            </span>
            <span className="text-muted small">
              {assessment.targetScope?.scopeIds?.length || 0} linked targets
            </span>
          </div>

          <div className="mt-2 pt-2 border-top border-dotted">
            <div className="text-muted fw-bold small">CHARGED ROLES</div>
            <div className="text-primary fw-semibold small mt-1">{getRoleNames()}</div>
          </div>
        </div>

        {/* Calculation Rules */}
        <div className="assessment-detail-panel">
          <div className="assessment-detail-panel__label">Calculation Method</div>
          <div className="fw-bold text-dark small mt-1">
            {calc.type === 'FLAT_RATE' &&
              `₹${(calc.flatAmount || 0).toLocaleString('en-IN')} Flat amount per resident`}
            {calc.type === 'PER_SQ_FT' &&
              `₹${(calc.ratePerSqFt || 0).toLocaleString('en-IN')} per square foot of unit area`}
            {calc.type === 'TIERED_BHK' && 'Tiered rates based on BHK unit layout'}
          </div>

          {calc.type === 'TIERED_BHK' && calc.tieredRates && (
            <div className="row row-cols-2 g-2 mt-2 small">
              <div>
                Studio: <strong>₹{calc.tieredRates.studio || 0}</strong>
              </div>
              <div>
                1 BHK: <strong>₹{calc.tieredRates.bhk1 || 0}</strong>
              </div>
              <div>
                2 BHK: <strong>₹{calc.tieredRates.bhk2 || 0}</strong>
              </div>
              <div>
                3 BHK: <strong>₹{calc.tieredRates.bhk3 || 0}</strong>
              </div>
              <div>
                4 BHK: <strong>₹{calc.tieredRates.bhk4 || 0}</strong>
              </div>
              <div>
                Penthouse: <strong>₹{calc.tieredRates.penthouse || 0}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="assessment-detail-footer">
        <i className="fa-solid fa-circle-info text-primary me-1" />
        <span className="text-muted small fw-medium">
          This template billing run triggers automatically on generation day.
        </span>
      </div>
    </div>
  )
})

AssessmentDetail.displayName = 'AssessmentDetail'

AssessmentDetail.propTypes = {
  assessment: PropTypes.object,
  onEdit: PropTypes.func,
  onRunBilling: PropTypes.func,
}

export default AssessmentDetail
