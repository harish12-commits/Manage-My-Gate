import React, { useState, useEffect } from 'react'
import crmApi from '../../../crmWorkspace/services/crmApi'

const MeetingsTab = ({ lead, savedMeetings, onMeetingsChange }) => {
  const [meetings, setMeetings] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('SCHEDULE') // 'SCHEDULE' | 'RESCHEDULE'
  const [selectedMeetingId, setSelectedMeetingId] = useState(null)
  const [demoDate, setDemoDate] = useState('')
  const [demoTime, setDemoTime] = useState('')

  // Fetch meetings from the backend
  useEffect(() => {
    const fetchLeadMeetings = async () => {
      if (!lead || (!lead._id && !lead.id)) return
      setIsLoading(true)
      try {
        const response = await crmApi.getMeetings({ inquiryId: lead._id || lead.id })
        if (response?.data?.data) {
          const apiMeetings = response.data.data.map((m) => {
            const d = new Date(m.startTime)
            const dateStr = d.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
            const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            return {
              id: m._id,
              title: m.title,
              status: m.status,
              time: `${dateStr} · ${timeStr}`,
              link: m.googleMeetLink || 'Not Generated',
              timestamp: d.getTime(),
            }
          })
          setMeetings(apiMeetings)
        }
      } catch (error) {
        console.error('Error fetching meetings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchLeadMeetings()
  }, [lead])

  const openScheduleModal = () => {
    setModalMode('SCHEDULE')
    setDemoDate('')
    setDemoTime('')
    setSelectedMeetingId(null)
    setIsModalOpen(true)
  }

  const openRescheduleModal = (id) => {
    setModalMode('RESCHEDULE')
    setDemoDate('')
    setDemoTime('')
    setSelectedMeetingId(id)
    setIsModalOpen(true)
  }

  const handleModalConfirm = async () => {
    if (!demoDate || !demoTime) {
      alert('Please select date and time')
      return
    }

    const leadId = lead?._id || lead?.id
    if (!leadId) {
      alert('Cannot schedule meeting for an unsaved lead.')
      return
    }

    // Parse specific time
    const dateTimeString = `${demoDate}T${demoTime}:00`
    const startObj = new Date(dateTimeString)
    const endObj = new Date(startObj.getTime() + 45 * 60000) // Add 45 mins
    const timestamp = startObj.getTime()

    // basic formatting just for display locally until refresh
    const dateStr = startObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const timeStr = startObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const formattedTime = `${dateStr} · ${timeStr} · 45 mins`

    setIsLoading(true)
    try {
      if (modalMode === 'SCHEDULE') {
        const payload = {
          inquiryId: leadId,
          title: `Follow-up Demo — ${lead?.organizationName || 'Platform'} Requirements`,
          startTime: startObj.toISOString(),
          endTime: endObj.toISOString(),
          status: 'SCHEDULED',
        }
        const response = await crmApi.scheduleMeeting(payload)
        if (response?.data?.data) {
          const m = response.data.data
          const newMeeting = {
            id: m._id,
            title: m.title,
            status: m.status,
            time: formattedTime,
            link: m.googleMeetLink || 'Pending',
            timestamp: new Date(m.startTime).getTime(),
          }
          setMeetings([...meetings, newMeeting])
        }
      } else if (modalMode === 'RESCHEDULE') {
        const payload = {
          startTime: startObj.toISOString(),
          endTime: endObj.toISOString(),
        }
        const response = await crmApi.updateMeeting(selectedMeetingId, payload)
        if (response?.data?.data) {
          const m = response.data.data
          setMeetings(
            meetings.map((mtg) =>
              mtg.id === selectedMeetingId
                ? {
                    ...mtg,
                    time: `Rescheduled: ${formattedTime}`,
                    link: m.googleMeetLink || mtg.link,
                    timestamp: new Date(m.startTime).getTime(),
                  }
                : mtg,
            ),
          )
        }
      }
      setIsModalOpen(false)
    } catch (error) {
      console.error('Failed to save meeting:', error)
      const errorMsg = error.response?.data?.message || error.message
      alert(`Failed to save meeting to backend: ${errorMsg}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoin = (link) => {
    if (!link || link === 'Not Generated' || link === 'Pending') return

    // Clean the link: remove spaces and replace with hyphens if they are just meeting codes
    let cleanLink = link.trim().replace(/ /g, '-')

    if (cleanLink.startsWith('http://') || cleanLink.startsWith('https://')) {
      window.open(cleanLink, '_blank')
    } else {
      window.open(`https://${cleanLink}`, '_blank')
    }
  }

  return (
    <div className="panel-body">
      <div className="d-flex justify-between align-center mb-3">
        <h3>Meetings & Demos</h3>
        <button className="btn primary small" onClick={openScheduleModal}>
          + Schedule Demo
        </button>
      </div>
      <div className="grid2">
        <div className="panel shadow-none">
          <div className="panel-head">
            <h2>Upcoming Schedule</h2>
          </div>
          <div className="panel-body">
            {meetings.map((meeting) => {
              const isExpired = meeting.timestamp && Date.now() > meeting.timestamp

              return (
                <div
                  className="meeting mb-3"
                  key={meeting.id}
                  style={{
                    borderBottom: '1px solid #eee',
                    paddingBottom: '15px',
                    opacity: isExpired ? 0.7 : 1,
                  }}
                >
                  <div className="d-flex justify-between">
                    <div className="meeting-title">{meeting.title}</div>
                    <span className={`badge ${isExpired ? 'gray' : 'blue'}`}>
                      {isExpired ? 'EXPIRED' : meeting.status}
                    </span>
                  </div>
                  <div
                    className="meeting-meta"
                    style={{ textDecoration: isExpired ? 'line-through' : 'none' }}
                  >
                    {meeting.time}
                  </div>
                  <div className="mt-2">
                    <a
                      href={isExpired ? '#' : `https://${meeting.link}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`text-sm ${isExpired ? 'text-muted' : 'text-primary'}`}
                      style={{ pointerEvents: isExpired ? 'none' : 'auto' }}
                    >
                      {meeting.link}
                    </a>
                  </div>
                  <div className="actions mt-3">
                    <button
                      className="btn small primary"
                      onClick={() => handleJoin(meeting.link)}
                      disabled={isExpired}
                    >
                      {isExpired ? 'Link Expired' : 'Join Meet'}
                    </button>
                    {!isExpired && (
                      <button className="btn small" onClick={() => openRescheduleModal(meeting.id)}>
                        Reschedule
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {meetings.length === 0 && <div className="text-muted">No upcoming meetings.</div>}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop open" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '400px', height: 'fit-content' }}
          >
            <div className="modal-head">
              <h2 className="text-xl font-bold">
                {modalMode === 'SCHEDULE' ? 'Schedule Demo' : 'Reschedule Demo'}
              </h2>
              <button className="btn small" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group mb-3">
                <label>Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={demoDate}
                  onChange={(e) => setDemoDate(e.target.value)}
                />
              </div>
              <div className="form-group mb-4">
                <label>Time</label>
                <input
                  type="time"
                  className="form-control"
                  value={demoTime}
                  onChange={(e) => setDemoTime(e.target.value)}
                />
              </div>
              <div className="d-flex justify-end gap-2">
                <button className="btn small" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button className="btn primary small" onClick={handleModalConfirm}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MeetingsTab
