import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import toast from 'react-hot-toast'

export const VisitorLogsTable = ({ logs }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Filter logs based on search and drop-downs
  const filteredLogs = logs.filter((log) => {
    const name = log.visitorName || log.snapshot?.visitorName || ''
    const destination =
      log.villa || log.passId?.villaId?.unitNumber || log.passId?.villaId?.villaNumber || ''
    const guardName = log.guard || log.guardId?.name || ''
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guardName.toLowerCase().includes(searchQuery.toLowerCase())

    const type = log.type || (log.entryType === 'PRE_APPROVED' ? 'guest' : 'walk_in')
    const matchesType = typeFilter === 'all' || type === typeFilter

    const status = log.status || log.logStatus
    const matchesStatus = statusFilter === 'all' || status === statusFilter

    return matchesSearch && matchesType && matchesStatus
  })

  const handleExportCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast.error('No visitor log records available to export.')
      return
    }

    const exportData = filteredLogs.map((log) => {
      const name = log.visitorName || log.snapshot?.visitorName || '—'
      const type = (log.type || (log.entryType === 'PRE_APPROVED' ? 'guest' : 'walk_in')).replace(
        '_',
        ' ',
      )
      const destination =
        log.villa ||
        log.passId?.villaId?.unitNumber ||
        log.passId?.villaId?.villaNumber ||
        'Villa Gate'
      const resident = log.resident || log.residentId?.name || '—'
      const checkIn =
        log.checkIn || (log.checkInTime ? new Date(log.checkInTime).toLocaleString('en-US') : '—')
      const checkOut =
        log.checkOut ||
        (log.checkOutTime ? new Date(log.checkOutTime).toLocaleString('en-US') : '—')
      const status = log.status || log.logStatus || '—'
      const guard = log.guard || log.guardId?.name || 'Gate Operator'

      return {
        'Visitor Name': name,
        'Visitor Type': type.toUpperCase(),
        'Destination Unit': destination,
        'Host Resident': resident,
        'Check-In Time': checkIn,
        'Check-Out Time': checkOut,
        Status: status,
        'Guard Operator': guard,
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet)
    const dataBlob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' })
    const dateStr = new Date().toISOString().split('T')[0]
    saveAs(dataBlob, `visitor_logs_${dateStr}.csv`)
    toast.success('Visitor logs exported as CSV successfully')
  }

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentLogs = filteredLogs.slice(indexOfFirstItem, indexOfLastItem)

  return (
    <div className="card logs-card">
      {/* Top filter toolbar */}
      <div className="flex-grow-1">
        <div className="logs-toolbar">
          <h3 style={{ fontSize: '18px' }}>
            <i className="fa-solid fa-list-check card-title-icon"></i> Visitor Logs Database
          </h3>

          <div className="logs-filters-group">
            {/* Search Input */}
            <input
              type="text"
              className="form-control filter-input-search"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
            />

            {/* Export CSV Button */}
            <button
              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
              onClick={handleExportCSV}
            >
              <i className="fa-solid fa-file-csv"></i> Export CSV
            </button>

            {/* Type Selector */}
            <select
              className="form-control filter-select"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="all">All Types</option>
              <option value="guest">Guest</option>
              <option value="cab_delivery">Cab & Delivery</option>
              <option value="service">Service</option>
              <option value="walk_in">Walk-in</option>
            </select>

            {/* Status Selector */}
            <select
              className="form-control filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="all">All Statuses</option>
              <option value="INSIDE">Inside</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {currentLogs.length === 0 ? (
          <div className="empty-state-container" style={{ minHeight: '220px' }}>
            <i className="fa-solid fa-folder-open empty-state-icon-history"></i>
            <span className="empty-state-text-sub">No entry logs found matching filters.</span>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Visitor Name</th>
                  <th>Destination</th>
                  <th>Check-In Time</th>
                  <th>Check-Out Time</th>
                  <th>Status</th>
                  <th>Guard Operator</th>
                </tr>
              </thead>
              <tbody>
                {currentLogs.map((log) => {
                  const logId = log.id || log._id
                  const name = log.visitorName || log.snapshot?.visitorName || '—'
                  const type = log.type || (log.entryType === 'PRE_APPROVED' ? 'guest' : 'walk-in')
                  const villa =
                    log.villa ||
                    log.passId?.villaId?.unitNumber ||
                    log.passId?.villaId?.villaNumber ||
                    'Villa Gate'
                  const resident = log.resident || log.residentId?.name || '—'

                  const checkIn =
                    log.checkIn ||
                    (log.checkInTime
                      ? new Date(log.checkInTime).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—')
                  const checkOut =
                    log.checkOut ||
                    (log.checkOutTime
                      ? new Date(log.checkOutTime).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—')

                  const status = log.status || log.logStatus
                  const guard = log.guard || log.guardId?.name || 'Gate Operator'

                  return (
                    <tr key={logId}>
                      <td>
                        <div className="table-cell-bold">{name}</div>
                        <div className="table-cell-sub text-capitalize">
                          Type: {type.replace('_', ' & ')}
                        </div>
                      </td>
                      <td>
                        <div className="table-cell-muted">{villa}</div>
                        <div className="table-cell-sub">Host: {resident}</div>
                      </td>
                      <td>
                        <span className="table-cell-muted">{checkIn}</span>
                      </td>
                      <td>
                        <span className="table-cell-muted">{checkOut}</span>
                      </td>
                      <td>
                        {status === 'INSIDE' && (
                          <span className="log-status-badge inside">INSIDE</span>
                        )}
                        {(status === 'COMPLETED' || status === 'RESOLVED') && (
                          <span className="log-status-badge completed">COMPLETED</span>
                        )}
                        {(status === 'DENIED' || status === 'REJECTED') && (
                          <span className="log-status-badge denied">{status}</span>
                        )}
                      </td>
                      <td>
                        <span className="table-cell-muted">{guard}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination control stuck at the absolute bottom of the card */}
      {totalPages > 1 && (
        <div className="table-pagination-footer">
          <span className="table-cell-muted">
            Page {currentPage} of {totalPages} ({filteredLogs.length} total entries)
          </span>
          <div className="table-pagination-buttons">
            <button
              className="btn btn-secondary"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
            >
              <i className="fa-solid fa-chevron-left me-1"></i> Previous
            </button>
            <button
              className="btn btn-secondary"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Next <i className="fa-solid fa-chevron-right ms-1"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default VisitorLogsTable
