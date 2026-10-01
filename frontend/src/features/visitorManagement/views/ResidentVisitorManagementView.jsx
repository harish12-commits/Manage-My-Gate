import React from 'react'
import VisitorTopNav from '../components/VisitorTopNav.jsx'
import InvitationForm from '../components/InvitationForm.jsx'
import ActiveInvitesTable from '../components/ActiveInvitesTable.jsx'
import WalkInApprovalList from '../components/WalkInApprovalList.jsx'
import InvitationSuccessModal from '../components/InvitationSuccessModal.jsx'
import useResidentVisitorManagement from '../hooks/useResidentVisitorManagement.js'
import '../styles/_visitorManagement.scss'

export const ResidentVisitorManagementView = () => {
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
    formData,
    handleInputChange,
    handleCreatePass,
    handleRevokePass,
    handleCopyPass,
    handleApproveEntry,
    handleDenyEntry,
    generatedPass,
    setGeneratedPass,
    logs,
  } = useResidentVisitorManagement()

  console.log('[ResidentVisitorManagementView] generatedPass:', generatedPass)

  return (
    <div className="visitor-management-module-wrapper visitor-os-theme">
      <VisitorTopNav activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="view-container">
        <div className="view active" id="view-resident-visitor">
          <InvitationSuccessModal
            visible={!!generatedPass}
            onClose={() => setGeneratedPass(null)}
            passData={generatedPass}
          />

          {activeTab === 'create' ? (
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
                          transition:
                            'color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease, width 0.2s ease, height 0.2s ease, max-height 0.2s ease',
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
          ) : (
            <WalkInApprovalList
              walkins={walkins}
              setWalkins={setWalkins}
              onApprove={handleApproveEntry}
              onDeny={handleDenyEntry}
              logs={logs}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default ResidentVisitorManagementView
