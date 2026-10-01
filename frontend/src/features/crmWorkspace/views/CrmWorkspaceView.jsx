import React, { useEffect } from 'react'
import LifecycleStepper from '../components/LifecycleStepper.jsx'
import WorkspaceTabs from '../components/WorkspaceTabs.jsx'
import { useCrmWorkspace } from '../hooks/useCrmWorkspace.js'
import '../styles/_crmWorkspace.scss'

/**
 * CrmWorkspaceView — Top-level view container for the Phase 1 CRM Customer Workspace.
 *
 * Strictly obeys Frontend & CRM state machine rules:
 * - Inquiry is the single authoritative source of truth.
 * - Actions and CTAs are strictly backend-driven.
 */
export const CrmWorkspaceView = () => {
  const {
    activeInquiry,
    inquiries,
    meetings,
    timeline,
    activeThread,
    activeTab,
    loading,
    statusTransitionLoading,
    handleTabChange,
    handleStatusTransition,
    fetchTimelineData,
    fetchInquiriesList,
    fetchMeetingsList,
    fetchThreadData,
    scheduleMeetingItem,
    sendChatMessage,
  } = useCrmWorkspace()

  const selectedInquiry = activeInquiry || inquiries[0] || null

  // Load initial data on mount
  useEffect(() => {
    fetchInquiriesList({ page: 1, limit: 10 })
    fetchMeetingsList({ page: 1, limit: 10 })
  }, [fetchInquiriesList, fetchMeetingsList])

  // Load thread data when active inquiry changes or Conversations tab is selected
  useEffect(() => {
    if (selectedInquiry?._id && (activeTab === 'Conversations' || activeTab === 'Communication')) {
      fetchThreadData(selectedInquiry._id)
    }
  }, [selectedInquiry?._id, activeTab, fetchThreadData])

  // Load immutable timeline data when Activity tab is selected or inquiry changes
  useEffect(() => {
    if (selectedInquiry?._id && activeTab === 'Activity') {
      fetchTimelineData(selectedInquiry._id)
    }
  }, [selectedInquiry?._id, activeTab, fetchTimelineData])

  return (
    <div className="billing-module-wrapper billing-os-theme crm-workspace-theme">
      <div className="view-container">
        <div className="view active" id="view-crm-workspace">
          {/* ── Page Header Toolbar ───────────────────────────────────── */}
          <div className="crm-header-toolbar">
            <div>
              <h4 className="crm-header-toolbar__title">CRM Inquiry Workspace (Phase 1)</h4>
              <p className="crm-header-toolbar__sub">
                Backend-driven inquiry state machine, meeting scheduler, and immutable activity
                feed.
              </p>
            </div>
            <div className="crm-header-toolbar__actions">
              <button
                type="button"
                className="crm-btn crm-btn--primary"
                onClick={() => fetchInquiriesList({ page: 1, limit: 10 })}
              >
                <i className="fa-solid fa-rotate me-1" />
                Refresh Workspace
              </button>
            </div>
          </div>

          {/* ── Visual Deal Lifecycle Stepper ─────────────────────────── */}
          <LifecycleStepper status={selectedInquiry?.status || 'NEW_INQUIRY'} />

          {/* ── Workspace Tabbed Panels ───────────────────────────────── */}
          <WorkspaceTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            activeInquiry={selectedInquiry}
            timeline={timeline}
            meetings={meetings}
            activeThread={activeThread}
            loading={loading}
            statusTransitionLoading={statusTransitionLoading}
            onScheduleMeeting={scheduleMeetingItem}
            onSendMessage={sendChatMessage}
            onTransitionStatus={(id, targetStatus) => handleStatusTransition(id, targetStatus)}
          />
        </div>
      </div>
    </div>
  )
}

export default CrmWorkspaceView
