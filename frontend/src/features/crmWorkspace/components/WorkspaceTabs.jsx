import React, { memo, useState } from 'react'
import { formatDate, formatStatusBadge } from '../utils/crmFormatters.js'

export const WorkspaceTabs = memo(
  ({
    activeTab = 'Overview',
    onTabChange,
    activeInquiry,
    timeline = [],
    meetings = [],
    activeThread,
    loading = false,
    statusTransitionLoading = false,
    onScheduleMeeting,
    onUpdateMeetingStatus,
    onSendMessage,
    onTransitionStatus,
  }) => {
    const [meetingTitle, setMeetingTitle] = useState('')
    const [meetingDate, setMeetingDate] = useState('')
    const [chatInput, setChatInput] = useState('')

    const tabs = [
      { key: 'Overview', label: 'Overview', icon: 'fa-solid fa-chart-pie' },
      { key: 'Meetings', label: 'Meetings & Demos', icon: 'fa-solid fa-video' },
      { key: 'Conversations', label: 'Conversations & Threads', icon: 'fa-solid fa-comments' },
      { key: 'Activity', label: 'Activity Feed', icon: 'fa-solid fa-clock-rotate-left' },
      { key: 'Pricing & Quote', label: 'Pricing & Quote', icon: 'fa-solid fa-file-invoice-dollar' },
    ]

    const handleMeetingSubmit = (e) => {
      e.preventDefault()
      if (!meetingTitle.trim() || !meetingDate) return
      if (onScheduleMeeting) {
        onScheduleMeeting({
          title: meetingTitle.trim(),
          scheduledAt: meetingDate,
          inquiryId: activeInquiry?._id || activeInquiry?.inquiryId,
          status: 'SCHEDULED',
        })
        setMeetingTitle('')
        setMeetingDate('')
      }
    }

    const handleChatSubmit = (e) => {
      e.preventDefault()
      if (!chatInput.trim()) return
      if (onSendMessage && activeInquiry?._id) {
        onSendMessage(activeInquiry._id, {
          senderType: 'AGENT',
          content: chatInput.trim(),
        })
        setChatInput('')
      }
    }

    const badgeInfo = formatStatusBadge(activeInquiry?.status)
    const currentStatus = activeInquiry?.status || 'NEW_INQUIRY'
    const isQuoteUnlocked = currentStatus === 'DEMO_COMPLETED'

    // Backend-Driven CTA Action config
    const getCtaButtonConfig = () => {
      switch (currentStatus) {
        case 'NEW_INQUIRY':
          return {
            label: 'Qualify Inquiry',
            icon: 'fa-solid fa-user-check',
            action: () => onTransitionStatus && onTransitionStatus(activeInquiry._id, 'QUALIFIED'),
            className: 'crm-btn crm-btn--primary',
          }
        case 'QUALIFIED':
          return {
            label: 'Schedule Demo',
            icon: 'fa-solid fa-calendar-plus',
            action: () => onTabChange && onTabChange('Meetings'),
            className: 'crm-btn crm-btn--primary',
          }
        case 'DEMO_SCHEDULED':
          return {
            label: 'Complete Demo',
            icon: 'fa-solid fa-circle-check',
            action: () =>
              onTransitionStatus && onTransitionStatus(activeInquiry._id, 'DEMO_COMPLETED'),
            className: 'crm-btn crm-btn--success',
          }
        case 'DEMO_COMPLETED':
          return {
            label: 'Generate Quote',
            icon: 'fa-solid fa-file-signature',
            action: () => onTabChange && onTabChange('Pricing & Quote'),
            className: 'crm-btn crm-btn--primary',
          }
        default:
          return null
      }
    }

    const ctaConfig = getCtaButtonConfig()

    return (
      <div className="crm-workspace-tabs-container">
        {/* ── Top Navigation Tabs ───────────────────────────────────────── */}
        <div className="crm-nav-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`crm-nav-btn ${activeTab === tab.key ? 'crm-nav-btn--active' : ''}`}
              onClick={() => onTabChange && onTabChange(tab.key)}
            >
              <i className={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content Container ─────────────────────────────────────── */}
        <div className="crm-tab-content">
          {/* ── 1. Tab: Overview ────────────────────────────────────────── */}
          {activeTab === 'Overview' && (
            <div className="crm-workspace-grid">
              {/* Left Card: Customer & Inquiry Details */}
              <div className="crm-card">
                <div className="crm-card__header">
                  <h5 className="crm-card__title">
                    <i className="fa-solid fa-circle-info text-primary me-2" />
                    Inquiry Details
                  </h5>
                  <span className={`crm-badge ${badgeInfo.className}`}>{badgeInfo.label}</span>
                </div>
                <div className="crm-card__body">
                  {activeInquiry ? (
                    <div className="crm-detail-list">
                      <div className="crm-detail-list__item">
                        <span className="crm-detail-list__label">Inquiry ID</span>
                        <span className="crm-detail-list__value text-primary fw-bold">
                          {activeInquiry.inquiryId}
                        </span>
                      </div>
                      <div className="crm-detail-list__item">
                        <span className="crm-detail-list__label">Customer Name</span>
                        <span className="crm-detail-list__value">{activeInquiry.customerName}</span>
                      </div>
                      <div className="crm-detail-list__item">
                        <span className="crm-detail-list__label">Community / Org</span>
                        <span className="crm-detail-list__value">
                          {activeInquiry.organizationName || activeInquiry.communityName}
                        </span>
                      </div>
                      <div className="crm-detail-list__item">
                        <span className="crm-detail-list__label">Villa / Unit Count</span>
                        <span className="crm-detail-list__value fw-semibold">
                          {activeInquiry.unitCount || activeInquiry.villaCount} Villas
                        </span>
                      </div>
                      <div className="crm-detail-list__item">
                        <span className="crm-detail-list__label">Contact Email</span>
                        <span className="crm-detail-list__value">{activeInquiry.contactEmail}</span>
                      </div>
                      <div className="crm-detail-list__item">
                        <span className="crm-detail-list__label">Contact Phone</span>
                        <span className="crm-detail-list__value">
                          {activeInquiry.contactPhone || 'N/A'}
                        </span>
                      </div>
                      <div className="crm-detail-list__item">
                        <span className="crm-detail-list__label">Next Required Action</span>
                        <span className="crm-detail-list__value text-warning fw-bold">
                          {activeInquiry.nextAction || 'Qualify Inquiry'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted">
                      <i className="fa-solid fa-folder-open fa-2x mb-2" />
                      <p className="mb-0">No active inquiry selected.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Card: Backend-Driven Action Center */}
              <div className="crm-card">
                <div className="crm-card__header">
                  <h5 className="crm-card__title">
                    <i className="fa-solid fa-bolt text-warning me-2" />
                    Backend Action Center
                  </h5>
                </div>
                <div className="crm-card__body">
                  <div className="d-flex flex-column gap-3">
                    {ctaConfig && (
                      <button
                        type="button"
                        className={`${ctaConfig.className} w-100 py-3 fs-6 shadow-sm`}
                        disabled={statusTransitionLoading}
                        onClick={ctaConfig.action}
                      >
                        {statusTransitionLoading ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin me-2" />
                            Updating State...
                          </>
                        ) : (
                          <>
                            <i className={`${ctaConfig.icon} me-2`} />
                            {ctaConfig.label}
                          </>
                        )}
                      </button>
                    )}

                    <div className="border-top pt-3">
                      <div className="d-flex justify-content-between text-muted fs-7 mb-2">
                        <span>Meetings Count:</span>
                        <span className="fw-bold">
                          {activeInquiry?.meetingCount || meetings.length || 0}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between text-muted fs-7">
                        <span>Timeline Events:</span>
                        <span className="fw-bold">
                          {activeInquiry?.timelineCount || timeline.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 2. Tab: Meetings ────────────────────────────────────────── */}
          {activeTab === 'Meetings' && (
            <div className="crm-card">
              <div className="crm-card__header">
                <h5 className="crm-card__title">
                  <i className="fa-solid fa-video text-danger me-2" />
                  Scheduled Meetings & Demos
                </h5>
              </div>
              <div className="crm-card__body">
                {/* Schedule Meeting Form */}
                <form onSubmit={handleMeetingSubmit} className="d-flex flex-wrap gap-2 mb-4">
                  <input
                    type="text"
                    className="form-control flex-grow-1"
                    placeholder="Meeting Title (e.g. Product Demo)..."
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                  />
                  <input
                    type="datetime-local"
                    className="form-control"
                    style={{ width: 'auto' }}
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                  />
                  <button type="submit" className="crm-btn crm-btn--primary">
                    <i className="fa-solid fa-calendar-plus me-1" />
                    Schedule Demo
                  </button>
                </form>

                {/* Meetings List */}
                {meetings.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table custom-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Scheduled Date</th>
                          <th>Google Meet Link</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meetings.map((meeting) => (
                          <tr key={meeting._id}>
                            <td className="fw-semibold">{meeting.title}</td>
                            <td>{formatDate(meeting.scheduledAt || meeting.startTime)}</td>
                            <td>
                              {meeting.googleMeetLink ? (
                                <a
                                  href={meeting.googleMeetLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary fw-semibold"
                                >
                                  <i className="fa-solid fa-link me-1" />
                                  Join Meet
                                </a>
                              ) : (
                                'N/A'
                              )}
                            </td>
                            <td>
                              <span
                                className={`crm-badge ${formatStatusBadge(meeting.status).className}`}
                              >
                                {meeting.status}
                              </span>
                            </td>
                            <td>
                              {meeting.status !== 'COMPLETED' && (
                                <button
                                  type="button"
                                  className="crm-btn crm-btn--success btn-sm"
                                  onClick={() =>
                                    onUpdateMeetingStatus &&
                                    onUpdateMeetingStatus(meeting._id, 'COMPLETED')
                                  }
                                >
                                  <i className="fa-solid fa-check me-1" />
                                  Complete Demo
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted">
                    <i className="fa-solid fa-video-slash fa-2x mb-2" />
                    <p className="mb-0">No meetings scheduled for this inquiry.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 3. Tab: Conversations ───────────────────────────────────── */}
          {activeTab === 'Conversations' && (
            <div className="crm-card">
              <div className="crm-card__header">
                <h5 className="crm-card__title">
                  <i className="fa-solid fa-comments text-success me-2" />
                  Inquiry Thread & Messages
                </h5>
              </div>
              <div className="crm-card__body">
                <div className="crm-thread-box">
                  {/* Messages Feed */}
                  <div className="crm-thread-box__messages">
                    {activeThread?.messages && activeThread.messages.length > 0 ? (
                      activeThread.messages.map((msg, index) => {
                        const isAgent = msg.senderType === 'AGENT'
                        return (
                          <div
                            key={msg._id || index}
                            className={`crm-thread-box__bubble ${
                              isAgent
                                ? 'crm-thread-box__bubble--agent'
                                : 'crm-thread-box__bubble--customer'
                            }`}
                          >
                            <div className="fw-bold fs-7 mb-1">
                              {isAgent ? 'Agent' : 'Customer'}
                            </div>
                            <div>{msg.content}</div>
                            <div className="text-end opacity-75 mt-1 fs-8">
                              {formatDate(msg.timestamp)}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="p-4 text-center text-muted m-auto">
                        <i className="fa-solid fa-comment-dots fa-2x mb-2" />
                        <p className="mb-0">
                          No messages in this thread yet. Start the conversation below!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Message Input Composer */}
                  <form onSubmit={handleChatSubmit} className="crm-thread-box__composer">
                    <input
                      type="text"
                      className="crm-thread-box__input"
                      placeholder="Type internal note or customer message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button type="submit" className="crm-btn crm-btn--primary">
                      <i className="fa-solid fa-paper-plane me-1" />
                      Send
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ── 4. Tab: Activity Feed (Immutable Timeline) ───────────────── */}
          {activeTab === 'Activity' && (
            <div className="crm-card">
              <div className="crm-card__header">
                <h5 className="crm-card__title">
                  <i className="fa-solid fa-clock-rotate-left text-info me-2" />
                  Immutable Inquiry Activity Timeline
                </h5>
              </div>
              <div className="crm-card__body">
                {timeline && timeline.length > 0 ? (
                  <div className="timeline-feed">
                    {timeline.map((item) => (
                      <div
                        key={item._id || item.timestamp}
                        className="d-flex gap-3 mb-3 border-bottom pb-3"
                      >
                        <div className="text-primary fs-4 mt-1">
                          <i className="fa-solid fa-circle-dot" />
                        </div>
                        <div className="flex-grow-1">
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="fw-bold text-dark">{item.eventType}</span>
                            <span className="text-muted fs-8">{formatDate(item.timestamp)}</span>
                          </div>
                          <div className="text-muted fs-7 mt-1">
                            {item.fromStatus ? (
                              <span>
                                Transitioned from{' '}
                                <span className="badge bg-secondary">{item.fromStatus}</span> to{' '}
                                <span className="badge bg-primary">{item.toStatus}</span>
                              </span>
                            ) : (
                              <span>
                                State: <span className="badge bg-primary">{item.toStatus}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-muted fs-8 mt-1">
                            Actor: <span className="fw-semibold">{item.actorName || 'System'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted">
                    <i className="fa-solid fa-stream fa-2x mb-2" />
                    <p className="mb-0">No activity timeline logged yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 5. Tab: Pricing & Quote ─────────────────────────────────── */}
          {activeTab === 'Pricing & Quote' && (
            <div className="crm-card">
              <div className="crm-card__header">
                <h5 className="crm-card__title">
                  <i className="fa-solid fa-file-invoice-dollar text-success me-2" />
                  Pricing & Quote Commercial Domain
                </h5>
              </div>
              <div className="crm-card__body">
                {isQuoteUnlocked ? (
                  <div className="alert alert-success p-4">
                    <h5 className="alert-heading fw-bold mb-2">
                      <i className="fa-solid fa-circle-check me-2" />
                      Demo Completed — Quote Generation Ready
                    </h5>
                    <p className="mb-0">
                      The inquiry has reached <strong>DEMO_COMPLETED</strong>. Quote creation and
                      commercial agreement workflows are unlocked for Phase 2.
                    </p>
                  </div>
                ) : (
                  <div className="alert alert-warning p-4 text-center">
                    <i className="fa-solid fa-lock fa-3x mb-3 text-warning" />
                    <h5 className="fw-bold">Complete the demo before generating a quote.</h5>
                    <p className="mb-0 text-muted">
                      The inquiry status is currently <strong>{currentStatus}</strong>. It must
                      reach <strong>DEMO_COMPLETED</strong> before Quote creation can begin.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  },
)

WorkspaceTabs.displayName = 'WorkspaceTabs'

export default WorkspaceTabs
