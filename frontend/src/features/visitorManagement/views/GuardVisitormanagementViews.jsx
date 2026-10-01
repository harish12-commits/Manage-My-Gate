import React from 'react'
import VisitorTopNav from '../components/VisitorTopNav.jsx'
import GuardInviteVisitorForm from '../components/GuardInviteVisitorForm.jsx'
import GuardScannerConsole from '../components/GuardScannerConsole.jsx'
import LiveEntriesTable from '../components/LiveEntriesTable.jsx'
import VillaDirectoryList from '../components/VillaDirectoryList.jsx'
import WalkInApprovalList from '../components/WalkInApprovalList.jsx'
import useGuardVisitorManagement from '../hooks/useGuardVisitorManagement.js'
import '../styles/_visitorManagement.scss'

export const GuardVisitormanagementViews = () => {
  const {
    activeTab,
    setActiveTab,
    passes,
    liveEntries,
    villas,
    dbVillas,
    dbUsers,
    loadingDirectory,
    handleCheckInSuccess,
    handleCheckOutSuccess,
    handleInitiateWalkIn,
  } = useGuardVisitorManagement()

  return (
    <div className="visitor-management-module-wrapper visitor-os-theme">
      <VisitorTopNav activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="view-container">
        <div className="view active" id="view-guard-visitor">
          {activeTab === 'invite' && (
            <GuardInviteVisitorForm
              dbVillas={dbVillas}
              dbUsers={dbUsers}
              loadingDirectory={loadingDirectory}
              onInitiateWalkIn={handleInitiateWalkIn}
              onCheckInSuccess={handleCheckInSuccess}
            />
          )}

          {activeTab === 'walkin' && (
            <WalkInApprovalList walkins={liveEntries} setWalkins={() => {}} logs={liveEntries} />
          )}

          {activeTab === 'scanner' && (
            <GuardScannerConsole
              passes={passes}
              liveEntries={liveEntries}
              onCheckInSuccess={handleCheckInSuccess}
              onCheckOutSuccess={handleCheckOutSuccess}
            />
          )}

          {activeTab === 'live' && (
            <LiveEntriesTable liveEntries={liveEntries} onCheckOutSuccess={handleCheckOutSuccess} />
          )}

          {activeTab === 'directory' && <VillaDirectoryList villas={villas} />}
        </div>
      </div>
    </div>
  )
}

export default GuardVisitormanagementViews
