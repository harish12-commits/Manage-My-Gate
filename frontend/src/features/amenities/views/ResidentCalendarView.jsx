import React, { useEffect, useState, useCallback } from 'react'
import { CSpinner, CPlaceholder } from '@coreui/react'
import { useNavigate, useLocation } from 'react-router-dom'
import useResidentCalendar from '../hooks/useResidentCalendar.js'
import useResidentBookingSocket from '../hooks/useResidentBookingSocket.js'
import CalendarHeader from '../components/calendar/CalendarHeader.jsx'
import CalendarGrid from '../components/calendar/CalendarGrid.jsx'
import ResidentEventDrawer from '../components/residentCalendar/ResidentEventDrawer.jsx'
import UpcomingBookingsWidget from '../components/residentCalendar/UpcomingBookingsWidget.jsx'
import ResidentBookingList from '../components/residentCalendar/ResidentBookingList.jsx'
import usePermission from '../../../hooks/usePermission.js'
import AmenitiesTopNav from '../components/AmenitiesTopNav.jsx'
import { useDispatch, useSelector } from 'react-redux'
import { getAmenities, fetchAllAmenitySlots } from '../store/amenitySlice.js'
import { createBooking, cancelBooking } from '../services/amenityBookingApi.js'
import toast from 'react-hot-toast'
import DateDetailsPanel from '../components/residentCalendar/DateDetailsPanel.jsx'
import BookingConfirmationModal from '../components/booking/BookingConfirmationModal.jsx'
import MockPaymentModal from '../components/booking/MockPaymentModal.jsx'
import ResidentBookingModal from '../components/residentCalendar/ResidentBookingModal.jsx'
import '../styles/_amenities.scss'

const ResidentCalendarView = () => {
  const navigate = useNavigate()
  const canCancel = usePermission('amenities', 'cancel_booking')
  const {
    rawEvents,
    upcomingEvents,
    loading,
    error,
    viewMode,
    setViewMode,
    currentDate,
    navigateDate,
    setToday,
    loadEvents,
    cancelBooking,
  } = useResidentCalendar()

  const [drawerVisible, setDrawerVisible] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)

  // New states for unified booking flow
  const getTodayLocal = () => {
    const d = new Date()
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
  }
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(getTodayLocal())
  const [selectedAmenityId, setSelectedAmenityId] = useState('')

  // Booking confirmation states
  const [residentBookingModalVisible, setResidentBookingModalVisible] = useState(false)
  const [bookingModalVisible, setBookingModalVisible] = useState(false)
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
  const [paymentIntent, setPaymentIntent] = useState(null)
  const [pendingBookingId, setPendingBookingId] = useState(null)
  const [autoOpenQRBookingId, setAutoOpenQRBookingId] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [selectedPersons, setSelectedPersons] = useState(1)

  const dispatch = useDispatch()
  const { items: amenities, allSlots, slotsLoading } = useSelector((state) => state.amenities)
  const location = useLocation()

  // Load bookings and amenities on mount
  useEffect(() => {
    loadEvents()
    if (amenities.length === 0) {
      dispatch(getAmenities())
    }
  }, [loadEvents, dispatch, amenities.length])

  // Handle auto-scroll to history
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    if (searchParams.get('scrollTo') === 'history') {
      const historyElement = document.getElementById('booking-history-section')
      if (historyElement) {
        historyElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [location.search, rawEvents])

  // Pre-select amenity if passed from Discover page
  useEffect(() => {
    if (location.state?.amenityId) {
      const today = new Date()
      const localDateStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0]
      setSelectedCalendarDate(localDateStr)
      setSelectedAmenityId(location.state.amenityId)
      dispatch(fetchAllAmenitySlots({ id: location.state.amenityId, date: localDateStr }))
      // Clear state so it doesn't re-trigger on refresh
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate, dispatch])

  // Auto-refresh via socket events (booking created/updated/cancelled/payment)
  const refreshAll = useCallback(() => {
    loadEvents()
    if (selectedCalendarDate && selectedAmenityId) {
      dispatch(fetchAllAmenitySlots({ id: selectedAmenityId, date: selectedCalendarDate }))
    }
  }, [loadEvents, selectedCalendarDate, selectedAmenityId, dispatch])

  useEffect(() => {
    if (autoOpenQRBookingId && rawEvents.length > 0) {
      const event = rawEvents.find(
        (e) =>
          (e.id === autoOpenQRBookingId || e.bookingId === autoOpenQRBookingId) &&
          e.metadata?.qrCode,
      )
      if (event) {
        setSelectedEvent(event)
        setDrawerVisible(true)
        setAutoOpenQRBookingId(null)
      }
    }
  }, [autoOpenQRBookingId, rawEvents])

  useResidentBookingSocket(refreshAll)

  const handleEventClick = (event) => {
    setSelectedEvent(event)
    setDrawerVisible(true)
  }

  const handleDateSelect = (dateStr) => {
    setSelectedCalendarDate(dateStr)
    setSelectedSlot(null)
    if (selectedAmenityId) {
      dispatch(fetchAllAmenitySlots({ id: selectedAmenityId, date: dateStr }))
    }
  }

  const handleAmenitySelect = (amenityId) => {
    setSelectedAmenityId(amenityId)
    setSelectedSlot(null)
    if (amenityId && selectedCalendarDate) {
      dispatch(fetchAllAmenitySlots({ id: amenityId, date: selectedCalendarDate }))
    }
  }

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot)
  }

  const handleModalSlotSelect = (amenityId, date, slot) => {
    setSelectedAmenityId(amenityId)
    setSelectedCalendarDate(date)
    setSelectedSlot(slot)
    setBookingModalVisible(true)
  }

  const handleConfirmBooking = async (numberOfPersons = 1) => {
    if (!selectedSlot || !selectedAmenityId || !selectedCalendarDate) return

    setSelectedPersons(numberOfPersons)
    setIsSubmittingBooking(true)
    try {
      const payload = {
        amenityId: selectedAmenityId,
        bookingDate: selectedCalendarDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        numberOfPersons,
      }

      const response = await createBooking(payload)

      setBookingModalVisible(false)

      if (response.paymentIntent) {
        setPaymentIntent(response.paymentIntent)
        setPendingBookingId(response.booking?._id)
      } else {
        toast.success('Booking confirmed successfully!')
        refreshAll()
      }
    } catch (err) {
      toast.error(err.message || 'Failed to submit booking')
    } finally {
      setIsSubmittingBooking(false)
    }
  }

  const handlePaymentSuccess = () => {
    setPaymentIntent(null)
    setAutoOpenQRBookingId(pendingBookingId)
    setPendingBookingId(null)

    // The backend processes the payment success event asynchronously (generating the QR code)
    // We poll refreshAll every 1 second for 5 seconds to ensure the UI updates as soon as the QR is ready.
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      refreshAll()
      if (attempts >= 5) {
        clearInterval(interval)
      }
    }, 1000)

    // Also trigger an immediate refresh
    refreshAll()
  }

  const handlePaymentClose = async () => {
    if (pendingBookingId) {
      try {
        await cancelBooking(pendingBookingId, 'Payment cancelled by user')
        refreshAll()
      } catch (err) {
        console.error('Failed to cancel abandoned booking', err)
      }
    }
    setPaymentIntent(null)
    setPendingBookingId(null)
  }

  const handlePayNowClick = (event) => {
    const intent = {
      paymentId: event.metadata.paymentId,
      amount: event.price,
      currency: 'INR',
      status: 'pending',
    }
    setPaymentIntent(intent)
    setPendingBookingId(event.id)
    setDrawerVisible(false)
  }

  const dateBookings = selectedCalendarDate
    ? rawEvents.filter((e) => e.date === selectedCalendarDate)
    : []

  const selectedAmenity = amenities.find((a) => a._id === selectedAmenityId)
  const draftForModal =
    selectedSlot && selectedAmenity
      ? (() => {
          const basePrice = selectedSlot.price || 0
          const taxPercentage = selectedAmenity.pricing?.taxPercentage || 0
          const tax = (basePrice * taxPercentage) / 100
          const deposit = selectedAmenity.pricing?.securityDeposit || 0

          return {
            amenityId: selectedAmenityId,
            bookingDate: selectedCalendarDate,
            startTime: selectedSlot.startTime,
            endTime: selectedSlot.endTime,
            duration: selectedSlot.duration,
            numberOfPersons: selectedPersons,
            baseAmount: basePrice,
            tax: tax,
            deposit: deposit,
            totalPrice: basePrice + tax + deposit,
            myBookingsCount: selectedSlot.myBookingsCount || 0,
          }
        })()
      : {}

  return (
    <div className="amenities-module-wrapper amenity-os-theme">
      <AmenitiesTopNav />
      <div className="view-container">
        {/* Header */}
        <div
          style={{
            marginBottom: '32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1 style={{ marginBottom: '8px' }} className="fs-1">
              My Bookings
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Manage your upcoming and past amenity reservations
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setResidentBookingModalVisible(true)}>
            <i className="fa-solid fa-plus" style={{ marginRight: '8px' }}></i> Book Amenity
          </button>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '24px' }}>
            {error}
          </div>
        )}

        {/* Calendar + Sidebar */}
        <div
          style={{
            display: 'flex',
            gap: '32px',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          {/* Main Calendar Area */}
          <div style={{ flex: '1 1 500px', maxWidth: '750px' }} className="card p-4">
            <CalendarHeader
              currentDate={currentDate}
              viewMode={viewMode}
              setViewMode={setViewMode}
              navigateDate={navigateDate}
              setToday={setToday}
              hideViewOptions={true}
            />

            {loading ? (
              <div style={{ padding: '20px' }}>
                <CPlaceholder component="div" animation="glow">
                  <CPlaceholder style={{ height: '40px', width: '100%', marginBottom: '16px' }} />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {Array.from({ length: 35 }).map((_, i) => (
                      <CPlaceholder
                        key={i}
                        style={{ width: '13%', height: '100px', flexGrow: 1 }}
                      />
                    ))}
                  </div>
                </CPlaceholder>
              </div>
            ) : (
              <CalendarGrid
                viewMode={viewMode}
                currentDate={currentDate}
                events={rawEvents}
                onEventClick={handleEventClick}
                onDateSelect={handleDateSelect}
                selectedDate={selectedCalendarDate}
              />
            )}
          </div>

          {/* Sidebar – Date Details */}
          <div style={{ flex: '1 1 350px', maxWidth: '450px' }}>
            <DateDetailsPanel
              selectedDate={selectedCalendarDate}
              dateBookings={dateBookings}
              amenities={amenities}
              selectedAmenityId={selectedAmenityId}
              onAmenitySelect={handleAmenitySelect}
              allSlots={allSlots}
              slotsLoading={slotsLoading}
              onSlotSelect={handleSlotSelect}
              selectedSlot={selectedSlot}
              onBookNow={() => setBookingModalVisible(true)}
              onClose={() => {}} // Remove close button action since it's always visible
            />
          </div>
        </div>

        {/* All Bookings List */}
        <div id="booking-history-section">
          <ResidentBookingList
            events={rawEvents}
            onEventClick={handleEventClick}
            onBookClick={() => setResidentBookingModalVisible(true)}
            loading={loading}
          />
        </div>

        {/* Booking Detail Drawer */}
        <ResidentEventDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          event={selectedEvent}
          onCancel={canCancel ? cancelBooking : null}
          onPayNow={handlePayNowClick}
        />

        {/* Resident Start Booking Modal */}
        <ResidentBookingModal
          visible={residentBookingModalVisible}
          onClose={() => setResidentBookingModalVisible(false)}
          amenities={amenities}
          onSlotSelect={handleModalSlotSelect}
        />

        {/* Booking Confirmation Modal */}
        <BookingConfirmationModal
          visible={bookingModalVisible}
          onClose={() => setBookingModalVisible(false)}
          onConfirm={handleConfirmBooking}
          isSubmitting={isSubmittingBooking}
          draft={draftForModal}
          amenity={selectedAmenity}
        />

        {/* Mock Payment Modal */}
        <MockPaymentModal
          visible={!!paymentIntent}
          paymentIntent={paymentIntent}
          onSuccess={handlePaymentSuccess}
          onFailure={handlePaymentClose}
          onClose={handlePaymentClose}
          draft={draftForModal}
          amenity={selectedAmenity}
        />
      </div>
    </div>
  )
}

export default ResidentCalendarView

// Force Vite reload
