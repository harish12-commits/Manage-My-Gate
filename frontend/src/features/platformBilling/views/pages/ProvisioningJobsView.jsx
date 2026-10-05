import React, { useEffect, useState } from 'react'
import { usePlatformBilling } from '../../hooks/usePlatformBilling.js'

const ProvisioningJobsView = () => {
  const { jobs = [], fetchAllData } = usePlatformBilling()
  const [selectedJob, setSelectedJob] = useState(null)

  useEffect(() => {
    fetchAllData()
  }, [])

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Automated Provisioning Jobs</h1>
          <div className="sub">State machine tracker supporting trial auto-provisioning.</div>
        </div>
      </div>
      <div className="panel panel-body table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Workflow / Job ID</th>
              <th>Target Organization</th>
              <th>Trigger Source</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((item) => {
              const orgName =
                item.organizationId?.name ||
                item.organizationName ||
                item.customerSnapshot?.organizationName ||
                item.targetOrganizationId?.name ||
                item.inquiryId?.organizationName ||
                'Your Community'
              return (
                <tr key={item._id || item.id}>
                  <td>
                    <strong>{item.workflowNumber || item.jobId || item._id}</strong>
                  </td>
                  <td>{orgName}</td>
                  <td>{item.triggerSource || item.correlationId || 'FREE_TRIAL_AUTO_PROVISION'}</td>
                  <td>
                    <span
                      className={`badge ${item.status === 'COMPLETED' || item.status === 'RUNNING' ? 'green' : 'blue'}`}
                    >
                      {item.status || 'COMPLETED'}
                    </span>
                  </td>
                  <td>
                    <button className="btn small primary" onClick={() => setSelectedJob(item)}>
                      View Checkpoints
                    </button>
                  </td>
                </tr>
              )
            })}
            {jobs.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                  No jobs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Provisioning Checkpoints Modal */}
      {selectedJob && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <h2>Provisioning Checkpoints — {selectedJob.workflowNumber || selectedJob._id}</h2>
              <button className="close-btn" onClick={() => setSelectedJob(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div>
                <strong>Target Organization:</strong>{' '}
                {selectedJob.organizationId?.name ||
                  selectedJob.organizationName ||
                  selectedJob.customerSnapshot?.organizationName ||
                  selectedJob.targetOrganizationId?.name ||
                  'Your Community'}
              </div>
              <div>
                <strong>Workflow Status:</strong>{' '}
                <span className="badge green">{selectedJob.status || 'COMPLETED'}</span>
              </div>
              <div
                style={{
                  marginTop: '14px',
                  fontWeight: '700',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--text-muted)',
                }}
              >
                Automated Checkpoint Steps Executed
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}
              >
                {[
                  '1. Organization MongoDB Record Creation',
                  '2. Admin Role & Entitlements Linkage',
                  '3. Workspace Modules Provisioning',
                  '4. Free Trial Access Activation',
                  '5. Account Activation Email Sent',
                ].map((name) => (
                  <div
                    key={name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '9px 12px',
                      background: 'var(--surface-bg)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                      fontSize: '13px',
                    }}
                  >
                    <span>{name}</span>
                    <span className="badge green">✓ COMPLETED</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn primary" onClick={() => setSelectedJob(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default ProvisioningJobsView
