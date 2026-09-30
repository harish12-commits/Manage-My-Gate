import React, { useEffect, useState } from 'react'
import { CButton } from '@coreui/react'
import useAssessment from '../hooks/useAssessment.js'
import TemplateEditorCanvasModal from '../../messageTemplate/components/TemplateEditorCanvasModal.jsx'

export const AssessmentManagementView = () => {
  const { assessmentsList, loading, loadAssessments } = useAssessment()
  const [emailTemplatesOpen, setEmailTemplatesOpen] = useState(false)

  useEffect(() => {
    loadAssessments()
  }, [loadAssessments])

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <h2 className="mb-0">Assessment Billing Templates</h2>
        <CButton
          color="primary"
          variant="outline"
          size="sm"
          onClick={() => setEmailTemplatesOpen(true)}
        >
          ✉️ Resident Email Templates
        </CButton>
      </div>
      <p className="text-body-secondary small mt-n3 mb-4">
        Residents are emailed when an invoice is generated, 3 days before it is due, when it becomes
        overdue, and after each payment — from your Integration Hub email account.
      </p>

      <TemplateEditorCanvasModal
        visible={emailTemplatesOpen}
        onClose={() => setEmailTemplatesOpen(false)}
        initialPurpose="invoice_generated"
      />

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm p-4">
              <h4>Active Templates Configuration</h4>

              {assessmentsList.length === 0 ? (
                <p className="text-muted mt-3">No templates registered yet.</p>
              ) : (
                <div className="list-group mt-3">
                  {assessmentsList.map((template) => (
                    <div
                      key={template._id}
                      className="list-group-item assessment-template-item p-3 mb-2 d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <div className="fw-semibold">{template.name}</div>
                        <div className="small text-muted mt-1">
                          Billing Cycle:{' '}
                          <span className="badge bg-secondary assessment-cycle-tag">
                            {template.billingCycle}
                          </span>
                        </div>
                      </div>
                      <div className="text-end">
                        <small className="text-muted">
                          Generation Day: {template.generationDay}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssessmentManagementView
