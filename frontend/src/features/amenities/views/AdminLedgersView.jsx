import React, { useState } from 'react'
import AmenitiesTopNav from '../components/AmenitiesTopNav.jsx'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { useAdminLedgers } from '../hooks/useAdminLedgers.js'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CSpinner,
} from '@coreui/react'
import '../styles/_amenities.scss'

const AdminLedgersView = () => {
  const {
    bookings,
    loading,
    search,
    amenityId,
    status,
    paymentStatus,
    datePreset,
    startDate,
    endDate,
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
  } = useAdminLedgers()

  const [showAmenityBreakdown, setShowAmenityBreakdown] = useState(true)

  const handleExportCSV = () => {
    if (!bookings || bookings.length === 0) {
      alert('No booking records available to export.')
      return
    }

    const exportData = bookings.map((b) => {
      const userObj = b.userId || {}
      const amenityObj = b.amenityId || {}
      const residentName = userObj.name || userObj.username || b.userName || 'Community Resident'
      const villaUnit = b.villaNumber || userObj.villaNumber || userObj.flatNumber || userObj.unit || 'N/A'
      const amenityName = amenityObj.name || b.amenityName || 'Amenity'
      
      const bookingAmt = Number(b.bookingAmount || b.pricingDetails?.totalAmount || b.totalPrice || 0)
      const paidAmt = Number(b.paidAmount || (['confirmed', 'checked-in', 'completed'].includes(b.status) || ['paid', 'success', 'captured'].includes(b.paymentStatus) ? bookingAmt : 0))
      const refundedAmt = Number(b.refundAmount || b.pricingDetails?.refundAmount || 0)
      const netRev = Math.max(0, paidAmt - refundedAmt)

      return {
        'Booking Reference': b.bookingId || b._id,
        'Resident Name': residentName,
        'Unit / Villa': villaUnit,
        'Amenity Name': amenityName,
        'Booking Date': b.bookingDate || '',
        'Start Time': b.startTime || '',
        'End Time': b.endTime || '',
        'Headcount / Persons': b.numberOfPersons || 1,
        'Booking Amount (₹)': bookingAmt,
        'Paid Amount (₹)': paidAmt,
        'Refunded Amount (₹)': refundedAmt,
        'Net Revenue (₹)': netRev,
        'Payment Status': (b.paymentStatus || 'pending').toUpperCase(),
        'Booking Status': (b.status || 'pending').toUpperCase(),
        'Payment Method': b.paymentMethod || 'Online',
        'Transaction Reference': b.paymentId || b.razorpayTransactionId || 'N/A',
        'Created Date': b.createdAt ? new Date(b.createdAt).toLocaleString() : '',
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet)
    const dataBlob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' })
    const dateStr = new Date().toISOString().split('T')[0]
    saveAs(dataBlob, `amenity_master_ledger_${dateStr}.csv`)
  }

  const getStatusBadge = (bStatus) => {
    const s = String(bStatus || '').toLowerCase()
    switch (s) {
      case 'confirmed':
        return <span className="badge badge-success"><i className="fa-solid fa-check-circle me-1"></i> Confirmed</span>
      case 'pending':
        return <span className="badge badge-warning"><i className="fa-solid fa-clock me-1"></i> Pending</span>
      case 'cancelled':
        return <span className="badge badge-danger"><i className="fa-solid fa-times-circle me-1"></i> Cancelled</span>
      case 'checked-in':
      case 'checked_in':
        return <span className="badge badge-info"><i className="fa-solid fa-sign-in-alt me-1"></i> Checked In</span>
      case 'completed':
        return <span className="badge badge-secondary"><i className="fa-solid fa-flag-checkered me-1"></i> Completed</span>
      case 'rejected':
        return <span className="badge badge-danger"><i className="fa-solid fa-ban me-1"></i> Rejected</span>
      default:
        return <span className="badge badge-secondary">{bStatus}</span>
    }
  }

  const getPaymentBadge = (pStatus, bStatus) => {
    const ps = String(pStatus || '').toLowerCase()
    const bs = String(bStatus || '').toLowerCase()

    if (['success', 'completed', 'paid', 'captured'].includes(ps) || ['confirmed', 'checked-in', 'completed'].includes(bs)) {
      return <span className="badge badge-success text-white">Paid</span>
    }
    if (['refunded', 'partial_refund'].includes(ps) || bs === 'cancelled') {
      return <span className="badge badge-info text-white">Refunded</span>
    }
    if (ps === 'failed') {
      return <span className="badge badge-danger text-white">Failed</span>
    }
    return <span className="badge badge-warning text-body">Pending</span>
  }

  return (
    <div className="amenities-module-wrapper amenity-os-theme">
      <AmenitiesTopNav />
      <div className="view-container">
        <div className="view active" id="view-admin-bookings">
          
          {/* Header Section */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 className="fs-2 mb-1">Master Financial & Booking Ledger</h2>
              <p className="text-muted fw-medium mb-0">
                Centralized financial audit & revenue oversight across all community facilities.
              </p>
            </div>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-secondary"
                onClick={() => setShowAmenityBreakdown(!showAmenityBreakdown)}
              >
                <i className={`fa-solid fa-chart-pie me-1`}></i>
                {showAmenityBreakdown ? 'Hide Amenity Summary' : 'Show Amenity Summary'}
              </button>
              <button className="btn btn-primary d-flex align-items-center gap-1" onClick={handleExportCSV}>
                <i className="fa-solid fa-file-csv me-1"></i> Export CSV
              </button>
            </div>
          </div>

          {/* KPI Summary Header Cards */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="card border-0 shadow-sm p-3 h-100" style={{ background: 'linear-gradient(135deg, #0084FF 0%, #0066CC 100%)', color: '#fff' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small text-white-50 text-uppercase fw-bold">Total Net Revenue</span>
                  <i className="fa-solid fa-indian-rupee-sign fa-lg opacity-75"></i>
                </div>
                <h3 className="fs-2 text-white mb-0">₹{(summary.totalRevenue || 0).toLocaleString('en-IN')}</h3>
                <span className="small text-white-50 mt-1 d-block">Collected from paid bookings</span>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="card border-0 shadow-sm p-3 h-100" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#fff' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small text-white-50 text-uppercase fw-bold">Today's Revenue</span>
                  <i className="fa-solid fa-calendar-day fa-lg opacity-75"></i>
                </div>
                <h3 className="fs-2 text-white mb-0">₹{(summary.todayRevenue || 0).toLocaleString('en-IN')}</h3>
                <span className="small text-white-50 mt-1 d-block">Collected today</span>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-2">
              <div className="card border-0 shadow-sm p-3 h-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small text-muted text-uppercase fw-bold">Total Bookings</span>
                  <i className="fa-solid fa-receipt text-primary"></i>
                </div>
                <h3 className="fs-2 mb-0">{summary.totalBookings || 0}</h3>
                <span className="small text-muted mt-1 d-block">{summary.paidBookings || 0} Paid</span>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-2">
              <div className="card border-0 shadow-sm p-3 h-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small text-muted text-uppercase fw-bold">Refunded Amount</span>
                  <i className="fa-solid fa-hand-holding-dollar text-info"></i>
                </div>
                <h3 className="fs-2 mb-0 text-info">₹{(summary.refundedAmount || 0).toLocaleString('en-IN')}</h3>
                <span className="small text-muted mt-1 d-block">{summary.cancelledBookings || 0} Cancelled</span>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-2">
              <div className="card border-0 shadow-sm p-3 h-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small text-muted text-uppercase fw-bold">Pending Payments</span>
                  <i className="fa-solid fa-clock-rotate-left text-warning"></i>
                </div>
                <h3 className="fs-2 mb-0 text-warning">{summary.pendingPayments || 0}</h3>
                <span className="small text-muted mt-1 d-block">Awaiting settlement</span>
              </div>
            </div>
          </div>

          {/* Amenity Revenue Distribution Summary */}
          {showAmenityBreakdown && amenitySummary && amenitySummary.length > 0 && (
            <div className="card border-0 shadow-sm mb-4 p-4">
              <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="fa-solid fa-chart-simple text-primary"></i> Amenity-Wise Revenue & Booking Distribution
              </h5>
              <div className="row g-3">
                {amenitySummary.map((item, idx) => (
                  <div key={idx} className="col-12 col-sm-6 col-md-4 col-lg-3">
                    <div className="p-3 rounded-3 border bg-body-secondary">
                      <div className="fw-bold text-truncate mb-1">{item.amenityName}</div>
                      <div className="d-flex justify-content-between align-items-center text-muted small mb-1">
                        <span>Bookings:</span>
                        <strong className="text-body">{item.bookingsCount}</strong>
                      </div>
                      <div className="d-flex justify-content-between align-items-center text-muted small mb-1">
                        <span>Gross Revenue:</span>
                        <span className="fw-semibold">₹{(item.grossRevenue || 0).toLocaleString('en-IN')}</span>
                      </div>
                      {item.refundedAmount > 0 && (
                        <div className="d-flex justify-content-between align-items-center text-danger small mb-1">
                          <span>Refunded:</span>
                          <span>-₹{(item.refundedAmount || 0).toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className="d-flex justify-content-between align-items-center border-top pt-1 mt-1">
                        <span className="fw-bold small">Net Revenue:</span>
                        <strong className="text-success">₹{(item.netRevenue || 0).toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter & Search Toolbar */}
          <div className="card border-0 shadow-sm p-4 mb-4">
            <div className="row g-3 align-items-end">
              {/* Search Bar */}
              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold text-muted mb-1">Search Records</label>
                <div className="input-group">
                  <span className="input-group-text bg-body-secondary border-end-0">
                    <i className="fa-solid fa-magnifying-glass text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="Resident, ID, Villa, Amenity..."
                    value={search}
                    onChange={handleSearchChange}
                  />
                </div>
              </div>

              {/* Date Preset Selector */}
              <div className="col-6 col-md-2">
                <label className="form-label small fw-bold text-muted mb-1">Date Period</label>
                <select className="form-select" value={datePreset} onChange={handleDatePresetChange}>
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {/* Custom Date Inputs if selected */}
              {datePreset === 'custom' && (
                <>
                  <div className="col-6 col-md-2">
                    <label className="form-label small fw-bold text-muted mb-1">From Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={startDate}
                      onChange={handleStartDateChange}
                    />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label small fw-bold text-muted mb-1">To Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={endDate}
                      onChange={handleEndDateChange}
                    />
                  </div>
                </>
              )}

              {/* Facility Filter */}
              <div className="col-6 col-md-2">
                <label className="form-label small fw-bold text-muted mb-1">Facility</label>
                <select className="form-select" value={amenityId} onChange={handleAmenityChange}>
                  <option value="All">All Facilities</option>
                  {amenitiesList.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Status Filter */}
              <div className="col-6 col-md-1">
                <label className="form-label small fw-bold text-muted mb-1">Payment</label>
                <select className="form-select" value={paymentStatus} onChange={handlePaymentStatusChange}>
                  <option value="All">All</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="refunded">Refunded</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* Booking Status Filter */}
              <div className="col-6 col-md-1">
                <label className="form-label small fw-bold text-muted mb-1">Status</label>
                <select className="form-select" value={status} onChange={handleStatusChange}>
                  <option value="All">All</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked-in">Checked In</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Reset Filters */}
              <div className="col-6 col-md-1">
                <button
                  className="btn btn-outline-secondary w-100 py-2 px-0"
                  onClick={handleResetFilters}
                  title="Reset Filters"
                >
                  <i className="fa-solid fa-arrow-rotate-left"></i> Reset
                </button>
              </div>
            </div>
          </div>

          {/* Master Ledger Data Table */}
          <div className="card border-0 shadow-sm p-0 overflow-hidden">
            <div className="table-wrapper border-0 rounded-0">
              <table className="ent-table align-middle" id="bookings-ledger">
                <thead>
                  <tr>
                    <th>BOOKING REF</th>
                    <th>RESIDENT & VILLA</th>
                    <th>AMENITY & SLOT</th>
                    <th>HEADCOUNT</th>
                    <th>FINANCIAL BREAKDOWN</th>
                    <th>PAYMENT STATUS</th>
                    <th>BOOKING STATUS</th>
                    <th className="text-end me-3">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5">
                        <CSpinner size="sm" className="me-2" /> Loading financial ledger entries...
                      </td>
                    </tr>
                  ) : bookings.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5">
                        <i className="fa-regular fa-folder-open fa-3x text-muted mb-3 opacity-50 d-block"></i>
                        <h5 className="fw-bold">No Ledger Entries Found</h5>
                        <p className="text-muted small mb-0">No booking records match your selected criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    bookings.map((b) => {
                      const userObj = b.userId || {}
                      const amenityObj = b.amenityId || {}
                      const residentName = userObj.name || userObj.username || b.userName || 'Resident'
                      const villaUnit = b.villaNumber || userObj.villaNumber || userObj.flatNumber || userObj.unit || '-'
                      const amenityName = amenityObj.name || b.amenityName || 'Amenity'

                      const bookingAmt = Number(b.bookingAmount || b.pricingDetails?.totalAmount || b.totalPrice || 0)
                      const paidAmt = Number(b.paidAmount || (['confirmed', 'checked-in', 'completed'].includes(b.status) || ['paid', 'success', 'captured'].includes(b.paymentStatus) ? bookingAmt : 0))
                      const refundedAmt = Number(b.refundAmount || b.pricingDetails?.refundAmount || 0)
                      const netRev = Math.max(0, paidAmt - refundedAmt)

                      return (
                        <tr key={b._id}>
                          <td style={{ color: 'var(--primary)' }} className="fw-bold">
                            #{b.bookingId || b._id.substring(b._id.length - 6).toUpperCase()}
                          </td>
                          <td>
                            <div className="fw-bold">{residentName}</div>
                            <div className="text-muted small">Unit: {villaUnit}</div>
                          </td>
                          <td>
                            <div className="fw-bold text-primary">{amenityName}</div>
                            <div className="text-muted small">
                              {b.bookingDate} • {b.startTime} - {b.endTime}
                            </div>
                          </td>
                          <td className="fw-semibold">
                            <span className="badge bg-light text-dark border">{b.numberOfPersons || 1} Persons</span>
                          </td>
                          <td>
                            <div className="fw-bold text-dark">₹{bookingAmt.toLocaleString('en-IN')}</div>
                            <div className="small text-muted">
                              Paid: <span className="text-success fw-semibold">₹{paidAmt.toLocaleString('en-IN')}</span>
                              {refundedAmt > 0 && (
                                <span className="text-danger ms-1">(Ref: ₹{refundedAmt})</span>
                              )}
                            </div>
                          </td>
                          <td>{getPaymentBadge(b.paymentStatus, b.status)}</td>
                          <td>{getStatusBadge(b.status)}</td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-outline-primary py-1 px-3 rounded-pill"
                              onClick={() => setSelectedLedgerDetail(b)}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {pagination && pagination.totalRecords > 0 && (
              <div className="card-footer bg-body border-top d-flex justify-content-between align-items-center p-3">
                <div className="text-muted small">
                  Showing {(pagination.currentPage - 1) * pagination.limit + 1} -{' '}
                  {Math.min(pagination.currentPage * pagination.limit, pagination.totalRecords)} of{' '}
                  {pagination.totalRecords} entries
                </div>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                    disabled={pagination.currentPage <= 1}
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                  >
                    <i className="fa-solid fa-chevron-left"></i> Prev
                  </button>
                  <span className="px-2 align-self-center small fw-bold">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                    disabled={pagination.currentPage >= pagination.totalPages}
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                  >
                    Next <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ledger Detail Inspection Modal */}
      <CModal
        visible={!!selectedLedgerDetail}
        onClose={() => setSelectedLedgerDetail(null)}
        alignment="center"
        size="lg"
      >
        <CModalHeader>
          <CModalTitle className="fw-bold">
            Ledger Entry Details #{selectedLedgerDetail?.bookingId || selectedLedgerDetail?._id?.substring(0, 8).toUpperCase()}
          </CModalTitle>
        </CModalHeader>
        <CModalBody className="p-4">
          {selectedLedgerDetail && (
            <div>
              {/* Resident & Amenity Overview */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-6">
                  <div className="p-3 bg-light rounded-3">
                    <h6 className="fw-bold text-muted small text-uppercase mb-2">Resident Information</h6>
                    <div className="fw-bold fs-5">{selectedLedgerDetail.userId?.name || selectedLedgerDetail.userName || 'Resident'}</div>
                    <div className="text-muted small">Unit / Villa: {selectedLedgerDetail.villaNumber || selectedLedgerDetail.userId?.villaNumber || selectedLedgerDetail.userId?.flatNumber || 'N/A'}</div>
                    <div className="text-muted small">Email: {selectedLedgerDetail.userId?.email || 'N/A'}</div>
                    <div className="text-muted small">Phone: {selectedLedgerDetail.userId?.phoneNumber || 'N/A'}</div>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="p-3 bg-light rounded-3">
                    <h6 className="fw-bold text-muted small text-uppercase mb-2">Facility & Time Window</h6>
                    <div className="fw-bold fs-5 text-primary">{selectedLedgerDetail.amenityId?.name || selectedLedgerDetail.amenityName || 'Amenity'}</div>
                    <div className="text-muted small">Date: {selectedLedgerDetail.bookingDate}</div>
                    <div className="text-muted small">Time Slot: {selectedLedgerDetail.startTime} - {selectedLedgerDetail.endTime}</div>
                    <div className="text-muted small">Headcount: {selectedLedgerDetail.numberOfPersons || 1} Persons</div>
                  </div>
                </div>
              </div>

              {/* Financial Audit Details */}
              <div className="card border-0 bg-body-secondary p-3 mb-4">
                <h6 className="fw-bold text-uppercase small text-muted mb-3">Financial Audit Breakdown</h6>
                <div className="row g-2">
                  <div className="col-6 col-sm-3">
                    <div className="text-muted small">Booking Amount:</div>
                    <div className="fw-bold fs-6">₹{Number(selectedLedgerDetail.bookingAmount || selectedLedgerDetail.pricingDetails?.totalAmount || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="text-muted small">Paid Amount:</div>
                    <div className="fw-bold fs-6 text-success">₹{Number(selectedLedgerDetail.paidAmount || (['confirmed', 'checked-in', 'completed'].includes(selectedLedgerDetail.status) ? (selectedLedgerDetail.pricingDetails?.totalAmount || 0) : 0)).toLocaleString('en-IN')}</div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="text-muted small">Refunded Amount:</div>
                    <div className="fw-bold fs-6 text-danger">₹{Number(selectedLedgerDetail.refundAmount || selectedLedgerDetail.pricingDetails?.refundAmount || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="text-muted small">Net Revenue:</div>
                    <div className="fw-bold fs-6 text-primary">
                      ₹{Math.max(0, Number(selectedLedgerDetail.paidAmount || (['confirmed', 'checked-in', 'completed'].includes(selectedLedgerDetail.status) ? (selectedLedgerDetail.pricingDetails?.totalAmount || 0) : 0)) - Number(selectedLedgerDetail.refundAmount || 0)).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Identifiers & Status Metadata */}
              <div className="row g-3">
                <div className="col-6">
                  <div className="small text-muted">Payment Status:</div>
                  <div>{getPaymentBadge(selectedLedgerDetail.paymentStatus, selectedLedgerDetail.status)}</div>
                </div>
                <div className="col-6">
                  <div className="small text-muted">Booking Status:</div>
                  <div>{getStatusBadge(selectedLedgerDetail.status)}</div>
                </div>
                <div className="col-6">
                  <div className="small text-muted">Payment Method:</div>
                  <div className="fw-semibold">{selectedLedgerDetail.paymentMethod || 'Online'}</div>
                </div>
                <div className="col-6">
                  <div className="small text-muted">Transaction ID:</div>
                  <div className="fw-semibold text-truncate">{selectedLedgerDetail.paymentId || selectedLedgerDetail.razorpayTransactionId || 'N/A'}</div>
                </div>
                <div className="col-12">
                  <div className="small text-muted">Created Timestamp:</div>
                  <div className="fw-semibold">{selectedLedgerDetail.createdAt ? new Date(selectedLedgerDetail.createdAt).toLocaleString() : 'N/A'}</div>
                </div>
                {selectedLedgerDetail.cancellationReason && (
                  <div className="col-12">
                    <div className="p-2 bg-danger-subtle rounded border border-danger-subtle text-danger small">
                      <strong>Cancellation Reason:</strong> {selectedLedgerDetail.cancellationReason}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={() => setSelectedLedgerDetail(null)}>
            Close
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}

export default AdminLedgersView
