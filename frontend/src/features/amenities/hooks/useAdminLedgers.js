import { useState, useEffect, useCallback } from 'react'
import { fetchBookingQueue } from '../services/amenityBookingApi.js'
import apiClient from '../../../services/apiClient.js'
import toast from 'react-hot-toast'

export const useAdminLedgers = () => {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [amenityId, setAmenityId] = useState('All')
  const [status, setStatus] = useState('All')
  const [paymentStatus, setPaymentStatus] = useState('All')
  const [datePreset, setDatePreset] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10,
  })
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    todayRevenue: 0,
    totalBookings: 0,
    paidBookings: 0,
    pendingPayments: 0,
    refundedAmount: 0,
    cancelledBookings: 0,
  })
  const [amenitySummary, setAmenitySummary] = useState([])
  const [amenitiesList, setAmenitiesList] = useState([])
  const [selectedLedgerDetail, setSelectedLedgerDetail] = useState(null)

  // Load facility list for dropdown
  useEffect(() => {
    const loadAmenities = async () => {
      try {
        const res = await apiClient.get('/amenities?status=active')
        setAmenitiesList(res.data?.data || res.data || [])
      } catch (err) {
        console.error('Failed to load amenities list for ledger', err)
      }
    }
    loadAmenities()
  }, [])

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        page,
        limit: 10,
        search: search.trim() || undefined,
        amenityId: amenityId !== 'All' ? amenityId : undefined,
        status: status !== 'All' ? status : undefined,
        paymentStatus: paymentStatus !== 'All' ? paymentStatus : undefined,
      }

      if (datePreset === 'custom') {
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
      } else if (datePreset !== 'all') {
        params.datePreset = datePreset
      }

      const res = await fetchBookingQueue(params)
      if (res) {
        const payload = res.data || res
        setBookings(payload.data || [])
        setPagination(
          payload.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 },
        )
        if (payload.summary) {
          setSummary(payload.summary)
        }
        if (payload.amenitySummary) {
          setAmenitySummary(payload.amenitySummary)
        }
      }
    } catch (err) {
      toast.error('Failed to fetch ledger bookings')
    } finally {
      setLoading(false)
    }
  }, [page, search, amenityId, status, paymentStatus, datePreset, startDate, endDate])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const handleSearchChange = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handleAmenityChange = (e) => {
    setAmenityId(e.target.value)
    setPage(1)
  }

  const handleStatusChange = (e) => {
    setStatus(e.target.value)
    setPage(1)
  }

  const handlePaymentStatusChange = (e) => {
    setPaymentStatus(e.target.value)
    setPage(1)
  }

  const handleDatePresetChange = (e) => {
    setDatePreset(e.target.value)
    setPage(1)
  }

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value)
    setPage(1)
  }

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value)
    setPage(1)
  }

  const handlePageChange = (newPage) => {
    setPage(newPage)
  }

  const handleResetFilters = () => {
    setSearch('')
    setAmenityId('All')
    setStatus('All')
    setPaymentStatus('All')
    setDatePreset('all')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return {
    bookings,
    loading,
    search,
    amenityId,
    status,
    paymentStatus,
    datePreset,
    startDate,
    endDate,
    page,
    pagination,
    summary,
    amenitySummary,
    amenitiesList,
    selectedLedgerDetail,
    setSelectedLedgerDetail,
    handleSearchChange,
    handleAmenityChange,
    handleStatusChange,
    handlePaymentStatusChange,
    handleDatePresetChange,
    handleStartDateChange,
    handleEndDateChange,
    handlePageChange,
    handleResetFilters,
    refetch: fetchBookings,
  }
}

export default useAdminLedgers
