import React, { useState } from 'react'
import { CButton, CSpinner, CCard, CCardBody, CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCalendar, cilPeople, cilTrash, cilShareAlt, cilCheckCircle } from '@coreui/icons'
import { useAuth } from '../../auth/hooks/useAuth'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import PollVotersModal from './PollVotersModal'
import PollConfirmDialog from './PollConfirmDialog'

const PollCard = ({ poll, onVote, onDelete, onPublish, onClosePoll, onReopenPoll }) => {
  const { currentUser: user, checkPermission } = useAuth()
  const [isVoting, setIsVoting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // 'publish', 'close', 'reopen', 'delete'
  const [actionLoading, setActionLoading] = useState(false)
  const [showVoters, setShowVoters] = useState(false)

  const handleConfirmAction = async () => {
    setActionLoading(true)
    try {
      if (confirmAction === 'publish') {
        await onPublish(poll._id)
        toast.success('Poll published successfully')
      } else if (confirmAction === 'close') {
        await onClosePoll(poll._id)
        toast.success('Poll closed successfully')
      } else if (confirmAction === 'reopen') {
        await onReopenPoll(poll._id)
        toast.success('Poll reopened successfully')
      } else if (confirmAction === 'delete') {
        await onDelete(poll._id)
        toast.success('Poll deleted successfully')
      }
    } catch (err) {
      toast.error(err?.message || `Failed to ${confirmAction} poll`)
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }

  const hasVoted = poll.hasVoted || false
  const votedOptionIndex = poll.votedOptionIndex
  const isAdmin = checkPermission('notices:manage_notices') || user?.isPlatformSuperAdmin

  const userIdStr = String(user?.id || user?._id || '')
  const creatorIdStr = String(poll?.createdBy?._id || poll?.createdBy || '')
  const isCreator = userIdStr === creatorIdStr && userIdStr !== ''

  const canDelete = isAdmin || isCreator
  const canManage = isAdmin || isCreator

  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votesCount, 0)

  const handleVote = async (optionIndex) => {
    if (poll.status !== 'Active' || isVoting) return
    setIsVoting(true)
    try {
      await onVote(poll._id, optionIndex)
    } catch (err) {
      import('react-hot-toast').then(({ toast }) => {
        toast.error(err?.message || 'Failed to record vote')
      })
    } finally {
      setIsVoting(false)
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this poll?')) {
      setIsDeleting(true)
      await onDelete(poll._id)
      setIsDeleting(false)
    }
  }

  const creatorName = poll?.createdBy?.name || 'Unknown'

  return (
    <CCard
      className="mb-0 border-0 shadow-sm notice-card position-relative h-100 d-flex flex-column"
      style={{ borderRadius: '12px', overflow: 'hidden' }}
    >
      <CCardBody className="p-3 d-flex flex-column flex-grow-1 gap-1">
        {/* Top Badges Row — matches NoticeCard badge row */}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
          <div className="d-flex align-items-center gap-1">
            <CBadge
              color="light"
              className="text-body border border-secondary border-opacity-25 small fw-semibold"
              style={{ fontSize: '10px' }}
            >
              {poll.visibility === 'Community Admin Only'
                ? '👨‍💼'
                : poll.visibility === 'Residents Only'
                  ? '🏠'
                  : '🌍'}{' '}
              {poll.visibility || 'Everyone'}
            </CBadge>
            <CBadge
              color={
                poll.status === 'Active'
                  ? 'success'
                  : poll.status === 'Closed'
                    ? 'secondary'
                    : 'warning'
              }
              className="small"
              style={{ fontSize: '10px' }}
            >
              {poll.status}
            </CBadge>
            {poll.status === 'Active' && dayjs(poll.endDate).diff(dayjs(), 'day') < 1 && (
              <CBadge
                color="danger"
                variant="outline"
                className="small"
                style={{ fontSize: '10px' }}
              >
                {dayjs(poll.endDate).diff(dayjs(), 'hour') > 0
                  ? `${dayjs(poll.endDate).diff(dayjs(), 'hour')}h left`
                  : 'Closing soon'}
              </CBadge>
            )}
          </div>
          <CBadge color="info" variant="outline" className="small" style={{ fontSize: '10px' }}>
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </CBadge>
        </div>

        {/* Poll Title — matches NoticeCard h5 */}
        <h5
          className="fw-bold text-body mt-1 mb-1"
          style={{ fontSize: '14.5px', minHeight: '38px', margin: '4px 0', lineHeight: 1.4 }}
        >
          {poll.question}
        </h5>

        {poll.description && (
          <p
            className="text-secondary small mb-2 text-truncate-2"
            style={{ lineHeight: 1.4, fontSize: '12px' }}
          >
            {poll.description}
          </p>
        )}

        {/* Poll Options */}
        <div className="poll-options mb-2 flex-grow-1">
          {poll.options.map((option, index) => {
            const percentage =
              totalVotes > 0 ? Math.round((option.votesCount / totalVotes) * 100) : 0
            const showResults = poll.status === 'Closed' || hasVoted
            const isSelected = hasVoted && index === votedOptionIndex

            return (
              <div
                key={index}
                className={`poll-option ${showResults ? 'has-voted' : ''} ${poll.status !== 'Active' ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => poll.status === 'Active' && handleVote(index)}
                style={
                  isSelected
                    ? { borderColor: '#6f42c1', backgroundColor: 'rgba(111, 66, 193, 0.05)' }
                    : {}
                }
              >
                <div
                  className="progress-bar"
                  style={{
                    width: showResults ? `${percentage}%` : '0%',
                    backgroundColor: isSelected ? 'rgba(111, 66, 193, 0.3)' : undefined,
                  }}
                />
                <div className="option-content">
                  <span
                    className="option-text"
                    style={isSelected ? { fontWeight: 'bold', color: '#6f42c1' } : {}}
                  >
                    {isSelected && <CIcon icon={cilCheckCircle} size="sm" className="me-1" />}
                    {option.text}
                  </span>
                  {showResults && <span className="option-percentage">{percentage}%</span>}
                </div>
              </div>
            )
          })}
        </div>

        {hasVoted && poll.status === 'Active' && (
          <div
            style={{
              color: '#2e7d32',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginBottom: '4px',
            }}
          >
            <CIcon icon={cilCheckCircle} size="sm" />
            Vote recorded. Click another option to change.
          </div>
        )}

        {/* Card Footer: Metadata and Actions — matches NoticeCard footer */}
        <div className="d-flex justify-content-between align-items-center pt-2 border-top flex-wrap gap-2 mt-auto">
          {/* Metadata */}
          <div
            className="text-body-secondary small d-flex align-items-center gap-1 flex-wrap"
            style={{ fontSize: '11px' }}
          >
            <span className="fw-semibold text-body">{creatorName}</span>
            <span className="text-opacity-50">•</span>
            <span>{dayjs(poll.createdAt).format('MMM DD, YYYY')}</span>
            <span className="text-opacity-50">•</span>
            <span className="text-muted">Ends {dayjs(poll.endDate).format('MMM DD')}</span>
          </div>

          {/* Action buttons — matches NoticeCard button sizing */}
          <div className="d-flex align-items-center gap-1 flex-wrap">
            {canManage && poll.status === 'Draft' && (
              <CButton
                color="success"
                variant="outline"
                size="sm"
                className="fw-semibold px-2"
                onClick={() => setConfirmAction('publish')}
                disabled={actionLoading}
                aria-label="Publish poll"
                style={{ fontSize: '11.5px', padding: '2px 8px' }}
              >
                {actionLoading && confirmAction === 'publish' ? (
                  <CSpinner size="sm" />
                ) : (
                  <>
                    <CIcon icon={cilShareAlt} size="sm" className="me-1 align-middle" /> Publish
                  </>
                )}
              </CButton>
            )}

            {canManage && poll.status === 'Active' && (
              <CButton
                color="warning"
                variant="outline"
                size="sm"
                className="fw-semibold px-2"
                onClick={() => setConfirmAction('close')}
                disabled={actionLoading}
                aria-label="Close poll"
                style={{ fontSize: '11.5px', padding: '2px 8px' }}
              >
                {actionLoading && confirmAction === 'close' ? (
                  <CSpinner size="sm" />
                ) : (
                  <>
                    <CIcon icon={cilCheckCircle} size="sm" className="me-1 align-middle" /> Close
                  </>
                )}
              </CButton>
            )}

            {canManage && poll.status === 'Closed' && onReopenPoll && (
              <CButton
                color="info"
                variant="outline"
                size="sm"
                className="fw-semibold px-2"
                onClick={() => setConfirmAction('reopen')}
                disabled={actionLoading}
                aria-label="Reopen poll"
                style={{ fontSize: '11.5px', padding: '2px 8px' }}
              >
                {actionLoading && confirmAction === 'reopen' ? (
                  <CSpinner size="sm" />
                ) : (
                  <>
                    <CIcon icon={cilCheckCircle} size="sm" className="me-1 align-middle" /> Reopen
                  </>
                )}
              </CButton>
            )}

            {canDelete && (
              <CButton
                color="danger"
                variant="outline"
                size="sm"
                className="fw-semibold px-2"
                onClick={() => setConfirmAction('delete')}
                disabled={actionLoading}
                aria-label="Delete poll"
                style={{ fontSize: '11.5px', padding: '2px 8px' }}
              >
                {actionLoading && confirmAction === 'delete' ? (
                  <CSpinner size="sm" />
                ) : (
                  <>
                    <CIcon icon={cilTrash} size="sm" className="me-1 align-middle" /> Delete
                  </>
                )}
              </CButton>
            )}

            {isAdmin && (
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                className="fw-semibold px-2 btn-read-more"
                onClick={() => setShowVoters(true)}
                aria-label="View Voters"
                style={{ fontSize: '11.5px', padding: '2px 8px' }}
              >
                <CIcon icon={cilPeople} size="sm" className="me-1 align-middle" />
                Voters
              </CButton>
            )}
          </div>
        </div>
      </CCardBody>

      <PollVotersModal visible={showVoters} onClose={() => setShowVoters(false)} poll={poll} />
      <PollConfirmDialog
        visible={!!confirmAction}
        actionType={confirmAction || ''}
        loading={actionLoading}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
      />
    </CCard>
  )
}

export default PollCard
