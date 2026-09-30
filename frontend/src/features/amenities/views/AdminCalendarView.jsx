import React, { useEffect, useState } from 'react'
import { CSpinner } from '@coreui/react'
import useAdminCalendar from '../hooks/useAdminCalendar.js'
import useAdminBookingSocket from '../hooks/useAdminBookingSocket.js'
import CalendarHeader from '../components/calendar/CalendarHeader.jsx'
import CalendarGrid from '../components/calendar/CalendarGrid.jsx'
import CalendarFilters from '../components/calendar/CalendarFilters.jsx'
import CalendarEventDrawer from '../components/calendar/CalendarEventDrawer.jsx'
import CalendarAnalytics from '../components/calendar/CalendarAnalytics.jsx'
import AmenitiesTopNav from '../components/AmenitiesTopNav.jsx'
import CancelBookingModal from '../components/booking/CancelBookingModal.jsx'
import { adminCancelBooking } from '../services/amenityBookingApi.js'
import toast from 'react-hot-toast'
import '../styles/_amenities.scss'
import AppLoader from '../../../components/common/AppLoader'

const AdminCalendarView = () => {
  const {
    visibleEvents,
    analytics,
    loading,
    error,
    viewMode,
    setViewMode,
    currentDate,
    setCurrentDate,
    navigateDate,
    setToday,
    filters,
    updateFilters,
    loadEvents,
  } = useAdminCalendar()

  useAdminBookingSocket(loadEvents)

  const [drawerVisible, setDrawerVisible] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [bookingToCancel, setBookingToCancel] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const handleEventClick = (event) => {
    setSelectedEvent(event)
    setDrawerVisible(true)
  }

  const handleCancelClick = (event) => {
    setBookingToCancel(event.metadata)
  }

  const handleConfirmCancel = async (bookingId, reason) => {
    try {
      setIsCancelling(true)
      await adminCancelBooking(bookingId, reason)
      toast.success('Booking cancelled successfully')
      setBookingToCancel(null)
      setDrawerVisible(false) // Optionally close drawer
      loadEvents() // Refresh calendar
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to cancel booking')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleDateSelect = (dateStr) => {
    // Make sure we convert back to Date correctly (UTC vs Local issues)
    // The dateStr is YYYY-MM-DD
    setCurrentDate(new Date(`${dateStr}T00:00:00`))
    setViewMode('day')
  }

  return (
    <div className="amenities-module-wrapper amenity-os-theme">
      <AmenitiesTopNav />
      <div className="view-container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '32px',
          }}
        >
          <div>
            <h1 style={{ marginBottom: '8px' }} className="fs-1">
              Admin Calendar
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>Manage and view all amenity bookings</p>
          </div>
        </div>

        <CalendarAnalytics analytics={analytics} />

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '24px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '24px', flexDirection: 'row', flexWrap: 'wrap' }}>
          {/* Sidebar Filters */}
          <div style={{ flex: '1 1 250px', maxWidth: '300px' }}>
            <CalendarFilters filters={filters} updateFilters={updateFilters} />
          </div>

          {/* Main Calendar Area */}
          <div style={{ flex: '3 1 600px' }} className="card">
            <CalendarHeader
              currentDate={currentDate}
              viewMode={viewMode}
              setViewMode={setViewMode}
              navigateDate={navigateDate}
              setToday={setToday}
            />

            {loading && visibleEvents.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <AppLoader variant="block" />
              </div>
            ) : (
              <CalendarGrid
                viewMode={viewMode}
                currentDate={currentDate}
                events={visibleEvents}
                onEventClick={handleEventClick}
                onDateSelect={handleDateSelect}
              />
            )}
          </div>
        </div>

        <CalendarEventDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          event={selectedEvent}
          onCancelClick={handleCancelClick}
        />

        <CancelBookingModal
          visible={!!bookingToCancel}
          onClose={() => setBookingToCancel(null)}
          onConfirm={handleConfirmCancel}
          booking={bookingToCancel}
          isSubmitting={isCancelling}
        />
      </div>
    </div>
  )
}

export default AdminCalendarView
