import React from 'react'
import VisitorTopNav from '../components/VisitorTopNav.jsx'
import InvitationForm from '../components/InvitationForm.jsx'
import ActiveInvitesTable from '../components/ActiveInvitesTable.jsx'
import WalkInApprovalList from '../components/WalkInApprovalList.jsx'
import VisitorLogsTable from '../components/VisitorLogsTable.jsx'
import BlacklistSettings from '../components/BlacklistSettings.jsx'
import InvitationSuccessModal from '../components/InvitationSuccessModal.jsx'
import useAdminVisitorManagement from '../hooks/useAdminVisitorManagement.js'
import '../styles/_visitorManagement.scss'

export const AdminVisitorManagementViews = () => {
  const {
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
    setWalkins,
    logs,
    blacklist,
    setBlacklist,
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
  } = useAdminVisitorManagement()

  const todayDateString = new Date().toDateString()

  const entriesToday = logs.filter((log) => {
    const logDateStr = log.checkInTime || log.createdAt
    if (!logDateStr) return false
    const logDate = new Date(logDateStr)
    const status = log.status || log.logStatus
    return (
      logDate.toDateString() === todayDateString && (status === 'COMPLETED' || status === 'INSIDE')
    )
  }).length

  const activePassesCount = passes.filter((p) => {
    const status = p.status || p.passStatus
    return status === 'ACTIVE' || status === 'Active'
  }).length

  const blockedCount = blacklist.length

  // Check if we are connected to a database org (versus default offline local mocks)
  const isDbActive = !!activeOrgId
  const entriesTodayDisplay = isDbActive ? entriesToday : 142
  const activePassesDisplay = isDbActive ? activePassesCount : 48
  const blockedDisplay = isDbActive ? blockedCount : 3

  return (
    <div className="visitor-management-module-wrapper visitor-os-theme">
      <VisitorTopNav activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="view-container">
        <div className="view active" id="view-admin-visitor">
          <InvitationSuccessModal
            visible={!!generatedPass}
            onClose={() => setGeneratedPass(null)}
            passData={generatedPass}
          />

          {activeTab === 'overview' && (
            <>
              {/* Statistics Counters Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '20px',
                  marginBottom: '30px',
                }}
              >
                <div
                  className="card card-hover"
                  style={{ padding: '20px', borderLeft: '4px solid var(--primary, #0084FF)' }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Total Gate Entries Today
                  </div>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      color: 'var(--text-main)',
                      marginTop: '8px',
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '8px',
                    }}
                  >
                    {entriesTodayDisplay}
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--success)' }}>
                      <i className="fa-solid fa-arrow-up"></i> +8.2%
                    </span>
                  </div>
                </div>
                <div
                  className="card card-hover"
                  style={{ padding: '20px', borderLeft: '4px solid var(--success, #2ECC71)' }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Active Visitor Passes
                  </div>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      color: 'var(--text-main)',
                      marginTop: '8px',
                    }}
                  >
                    {activePassesDisplay}
                  </div>
                </div>
                <div
                  className="card card-hover"
                  style={{ padding: '20px', borderLeft: '4px solid var(--danger, #E74C3C)' }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Security Alerts / Blocked
                  </div>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      color: 'var(--text-main)',
                      marginTop: '8px',
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '8px',
                    }}
                  >
                    {blockedDisplay}
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--danger)' }}>
                      High Priority
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Analytics Content */}
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>
                  <i
                    className="fa-solid fa-chart-line"
                    style={{ color: 'var(--primary)', marginRight: '8px' }}
                  ></i>{' '}
                  Gate Entry Trends & Peak Hours
                </h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '240px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '12px',
                    border: '1px dashed #E2E8F0',
                    color: 'var(--text-muted)',
                  }}
                >
                  <i
                    className="fa-solid fa-chart-simple"
                    style={{ fontSize: '48px', color: '#E2E8F0', marginBottom: '16px' }}
                  ></i>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>
                    Peak Entry Traffic Hour: 17:00 - 19:00
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Chart visualization data is simulated for active security guards logs.
                  </span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'create' && (
            <>
              {/* Small Filter Section */}
              <div style={{ marginBottom: '24px' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  Invitation Method
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'guest', name: 'Guest Invite', icon: 'fa-user-plus' },
                    { id: 'group', name: 'Group Invite', icon: 'fa-users' },
                    {
                      id: 'cab_delivery',
                      name: 'Cab and Delivery Invite',
                      icon: 'fa-truck-ramp-box',
                    },
                    { id: 'service', name: 'Service Invite', icon: 'fa-screwdriver-wrench' },
                  ].map((method) => {
                    const isSelected = inviteMethod === method.id
                    return (
                      <button
                        key={method.id}
                        onClick={() => {
                          setInviteMethod(method.id)
                          setSearchQuery('')
                          setCurrentPage(1)
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '50px',
                          fontSize: '14px',
                          fontWeight: '600',
                          border: '1px solid',
                          borderColor: isSelected
                            ? 'var(--primary, #0084FF)'
                            : 'var(--border-light, #E2E8F0)',
                          backgroundColor: isSelected ? 'var(--primary-light, #E5F3FF)' : '#fff',
                          color: isSelected
                            ? 'var(--primary, #0084FF)'
                            : 'var(--text-muted, #64748B)',
                          cursor: 'pointer',
                          transition: 'color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease, width 0.2s ease, height 0.2s ease, max-height 0.2s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <i className={`fa-solid ${method.icon}`} />
                        {method.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Form and List Grid */}
              <div className="dashboard-grid">
                {/* Component 1: Invitation Form */}
                <InvitationForm
                  inviteMethod={inviteMethod}
                  guestPassType={guestPassType}
                  setGuestPassType={setGuestPassType}
                  cabPassType={cabPassType}
                  setCabPassType={setCabPassType}
                  cabUsageType={cabUsageType}
                  setCabUsageType={setCabUsageType}
                  servicePassType={servicePassType}
                  setServicePassType={setServicePassType}
                  serviceUsageType={serviceUsageType}
                  setServiceUsageType={setServiceUsageType}
                  formData={formData}
                  handleInputChange={handleInputChange}
                  handleCreatePass={handleCreatePass}
                />

                {/* Component 2: Active Invites Table */}
                <ActiveInvitesTable
                  passes={passes}
                  inviteMethod={inviteMethod}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  itemsPerPage={itemsPerPage}
                  handleCopyPass={handleCopyPass}
                  handleRevokePass={handleRevokePass}
                  setGeneratedPass={setGeneratedPass}
                />
              </div>
            </>
          )}

          {activeTab === 'walkin' && (
            <WalkInApprovalList
              walkins={walkins}
              setWalkins={setWalkins}
              onApprove={handleApproveEntry}
              onDeny={handleDenyEntry}
              logs={logs}
            />
          )}

          {activeTab === 'logs' && <VisitorLogsTable logs={logs} />}

          {activeTab === 'blacklist' && (
            <BlacklistSettings blacklist={blacklist} setBlacklist={setBlacklist} />
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminVisitorManagementViews
