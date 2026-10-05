import React from 'react'

const OverviewTab = ({ lead }) => {
  return (
    <div className="panel-body">
      <div className="section mb-3">
        <div className="d-flex justify-between align-center mb-2">
          <h3>Sales Lifecycle</h3>
          <span className="badge blue">Lead Score: 82 / 100</span>
        </div>
        <div className="grid3">
          <div className={`card shadow-none ${lead?.status === 'NEW' ? 'border-primary' : ''}`}>
            <div className="kpi-label">New</div>
            <div className={`kpi-value text-md ${lead?.status === 'NEW' ? 'text-primary' : ''}`}>
              {lead?.status === 'NEW' ? '● Current' : '✓'}
            </div>
          </div>
          <div
            className={`card shadow-none ${lead?.status === 'QUALIFIED' ? 'border-primary' : ''}`}
          >
            <div className="kpi-label">Qualified</div>
            <div
              className={`kpi-value text-md ${lead?.status === 'QUALIFIED' ? 'text-primary' : ''}`}
            >
              {lead?.status === 'QUALIFIED'
                ? '● Current'
                : lead?.status === 'DEMO_SCHEDULED'
                  ? '✓'
                  : 'Next'}
            </div>
          </div>
          <div
            className={`card shadow-none ${lead?.status === 'DEMO_SCHEDULED' ? 'border-primary' : ''}`}
          >
            <div className="kpi-label">Demo Scheduled</div>
            <div
              className={`kpi-value text-md ${lead?.status === 'DEMO_SCHEDULED' ? 'text-primary' : ''}`}
            >
              {lead?.status === 'DEMO_SCHEDULED' ? '● Current' : 'Next'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="panel shadow-none">
          <div className="panel-head">
            <h2>User & Community</h2>
          </div>
          <div className="panel-body">
            <div className="field-grid">
              <div className="field">
                <label>Contact Name</label>
                <div className="field-value">{lead?.contactName || 'No Name Provided'}</div>
              </div>
              <div className="field">
                <label>Community</label>
                <div className="field-value">{lead?.organizationName || 'No Organization'}</div>
              </div>
              <div className="field">
                <label>Email</label>
                <div className="field-value">{lead?.email || lead?.contactEmail || 'No Email'}</div>
              </div>
              <div className="field">
                <label>Phone</label>
                <div className="field-value">{lead?.phone || lead?.contactPhone || 'No Phone'}</div>
              </div>
              <div className="field">
                <label>Residential Units</label>
                <div className="field-value">{lead?.unitCount || 'N/A'}</div>
              </div>
              <div className="field">
                <label>Requested Features</label>
                <div className="field-value">
                  {lead?.selectedFeatures && lead.selectedFeatures.length > 0
                    ? lead.selectedFeatures
                        .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
                        .join(', ')
                    : 'None selected'}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="panel shadow-none">
          <div className="panel-head">
            <h2>AI / System Insights</h2>
            <span className="badge green">High Potential</span>
          </div>
          <div className="panel-body">
            <div className="mini-note">
              • Organization size is suitable for Tier 2 pricing.
              <br />
              <br />
              • Customer requested a 15-Day Free Trial before full commitment.
              <br />
              <br />
              • Estimated annual contract value is above the average new lead.
              <br />
              <br />• Recommend activating 15-Day Free Trial and scheduling a demo.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OverviewTab
