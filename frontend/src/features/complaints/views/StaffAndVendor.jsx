import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchStaffVendorsAnalytics } from '../store/complaintSlice'
import ComplaintTopNav from '../components/ComplaintTopNav'
import TechnicianModal from '../components/TechnicianModal'
import { technicianService } from '../services/technician.service'
import { toast } from 'react-hot-toast'
import '../styles/_complaints.scss'

const StaffAndVendor = () => {
  const dispatch = useDispatch()
  const { staffVendors, status } = useSelector((state) => state.complaints)

  const [filter, setFilter] = useState('All Departments')
  const [search, setSearch] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTechnician, setSelectedTechnician] = useState(null)

  useEffect(() => {
    dispatch(fetchStaffVendorsAnalytics({}))
  }, [dispatch])

  const technicians = staffVendors?.technicians || []
  const summary = staffVendors?.summary || {}

  const filteredStaff = technicians.filter((s) => {
    if (filter !== 'All Departments' && s.department !== filter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.phone.includes(search))
      return false
    return true
  })

  const handleAddNew = () => {
    setSelectedTechnician(null)
    setIsModalOpen(true)
  }

  const handleEdit = (technician) => {
    setSelectedTechnician(technician)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedTechnician(null)
    dispatch(fetchStaffVendorsAnalytics({})) // Refresh data after update
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this staff/vendor?')) return
    try {
      await technicianService.delete(id)
      toast.success('Deleted successfully')
      dispatch(fetchStaffVendorsAnalytics({}))
    } catch (error) {
      toast.error(error?.message || 'Failed to delete')
    }
  }

  return (
    <div className="complaints-module-wrapper complaints-os-theme">
      <ComplaintTopNav />
      <div className="view-container">
        <div className="view active" id="staff">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '32px',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <h2 style={{ margin: 0 }} className="fs-2">
                Staff & Vendors Directory
              </h2>
              <p style={{ color: 'var(--text-muted)', margin: 0 }} className="fw-medium">
                Manage technicians and monitor active workloads
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleAddNew}
              style={{ whiteSpace: 'nowrap', alignSelf: 'center' }}
            >
              <i className="fa-solid fa-plus"></i> Add New Staff/Vendor
            </button>
          </div>

          {/* Summary Cards */}
          <div
            className="kpi-row"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <div
              className="kpi-card card-hover"
              style={{
                background: 'var(--surface)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{ color: 'var(--ink-soft)', textTransform: 'uppercase' }}
                className="fw-semibold small"
              >
                Active Staff
              </div>
              <div style={{ color: 'var(--ink)', marginTop: '8px' }} className="fw-bold fs-2">
                {summary.activeStaff || 0}
              </div>
            </div>
            <div
              className="kpi-card card-hover"
              style={{
                background: 'var(--surface)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{ color: 'var(--ink-soft)', textTransform: 'uppercase' }}
                className="fw-semibold small"
              >
                Available Staff
              </div>
              <div style={{ color: 'var(--success)', marginTop: '8px' }} className="fw-bold fs-2">
                {summary.availableStaff || 0}
              </div>
            </div>
            <div
              className="kpi-card card-hover"
              style={{
                background: 'var(--surface)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{ color: 'var(--ink-soft)', textTransform: 'uppercase' }}
                className="fw-semibold small"
              >
                Busy Staff
              </div>
              <div style={{ color: 'var(--warning)', marginTop: '8px' }} className="fw-bold fs-2">
                {summary.busyStaff || 0}
              </div>
            </div>
            <div
              className="kpi-card card-hover"
              style={{
                background: 'var(--surface)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{ color: 'var(--ink-soft)', textTransform: 'uppercase' }}
                className="fw-semibold small"
              >
                Jobs Completed Today
              </div>
              <div style={{ color: 'var(--primary)', marginTop: '8px' }} className="fw-bold fs-2">
                {summary.completedToday || 0}
              </div>
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group">
              <div className="search-bar" style={{ flex: '0 0 350px' }}>
                <i
                  className="fa-solid fa-magnifying-glass"
                  style={{ color: 'var(--ink-faint)' }}
                ></i>
                <input
                  type="text"
                  placeholder="Search by name, phone or trade..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="filter-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option>All Departments</option>
                <option>Electrical</option>
                <option>Plumbing</option>
                <option>Housekeeping</option>
                <option>Security</option>
                <option>Carpentry</option>
                <option>Others</option>
              </select>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Trade / Dept</th>
                    <th>Type</th>
                    <th>Active Tasks</th>
                    <th>Completed Today</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {status === 'loading' && !staffVendors ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4">
                        Loading workloads...
                      </td>
                    </tr>
                  ) : filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4">
                        No staff/vendors found.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((s) => (
                      <tr key={s._id}>
                        <td>
                          <b style={{ color: 'var(--ink)', display: 'block' }}>{s.name}</b>
                          <span
                            style={{ color: 'var(--ink-faint)', display: 'block' }}
                            className="small"
                          >
                            {s.phone}
                          </span>
                          {s.email && (
                            <span
                              style={{ color: 'var(--ink-faint)', display: 'block' }}
                              className="small"
                            >
                              {s.email}
                            </span>
                          )}
                        </td>
                        <td>{s.department}</td>
                        <td>{s.type}</td>
                        <td>
                          <span
                            className={`badge ${s.activeComplaintsCount > 0 ? 'badge-warning' : 'badge-success'}`}
                          >
                            {s.activeComplaintsCount || 0} Active
                          </span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--primary)' }} className="fw-semibold">
                            {s.completedTodayCount || 0} Tasks
                          </span>
                        </td>
                        <td>
                          <span
                            className={s.status === 'Active' ? 'badge resolved' : 'badge normal'}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(s)}>
                              Edit
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: '#ef4444' }}
                              onClick={() => handleDelete(s._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <TechnicianModal
        visible={isModalOpen}
        technician={selectedTechnician}
        onClose={handleCloseModal}
      />
    </div>
  )
}

export default StaffAndVendor
