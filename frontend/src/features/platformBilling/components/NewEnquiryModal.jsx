import React, { useState } from 'react'
import { usePlatformBilling } from '../hooks/usePlatformBilling'

const NewEnquiryModal = ({ isOpen, onClose }) => {
  const { createInquiry } = usePlatformBilling()
  const [formData, setFormData] = useState({
    customerName: '',
    organizationName: '',
    unitCount: '',
    contactEmail: '',
    contactPhone: '',
    originSource: 'MANUAL',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const dataToSubmit = {
        ...formData,
        unitCount: parseInt(formData.unitCount, 10),
      }

      await createInquiry(dataToSubmit)
      setFormData({
        customerName: '',
        organizationName: '',
        unitCount: '',
        contactEmail: '',
        contactPhone: '',
        originSource: 'MANUAL',
      })
      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to create enquiry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2>New Enquiry</h2>
          <button style={closeButtonStyle} onClick={onClose}>
            &times;
          </button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={formGroupStyle}>
            <label>Customer Name *</label>
            <input
              type="text"
              name="customerName"
              value={formData.customerName}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </div>

          <div style={formGroupStyle}>
            <label>Organization Name *</label>
            <input
              type="text"
              name="organizationName"
              value={formData.organizationName}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </div>

          <div style={formGroupStyle}>
            <label>Unit Count *</label>
            <input
              type="number"
              name="unitCount"
              value={formData.unitCount}
              onChange={handleChange}
              required
              min="1"
              style={inputStyle}
            />
          </div>

          <div style={formGroupStyle}>
            <label>Contact Email *</label>
            <input
              type="email"
              name="contactEmail"
              value={formData.contactEmail}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </div>

          <div style={formGroupStyle}>
            <label>Contact Phone</label>
            <input
              type="text"
              name="contactPhone"
              value={formData.contactPhone}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={footerStyle}>
            <button type="button" onClick={onClose} style={cancelButtonStyle} disabled={loading}>
              Cancel
            </button>
            <button type="submit" style={submitButtonStyle} disabled={loading}>
              {loading ? 'Saving...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Basic inline styles for the modal
const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const modalStyle = {
  backgroundColor: '#fff',
  borderRadius: '8px',
  width: '400px',
  maxWidth: '90%',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  display: 'flex',
  flexDirection: 'column',
}

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px',
  borderBottom: '1px solid #e5e7eb',
}

const closeButtonStyle = {
  background: 'none',
  border: 'none',
  fontSize: '24px',
  cursor: 'pointer',
}

const formStyle = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const formGroupStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const inputStyle = {
  padding: '8px',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '14px',
}

const errorStyle = {
  margin: '16px 16px 0',
  padding: '10px',
  backgroundColor: '#fee2e2',
  color: '#991b1b',
  borderRadius: '4px',
  fontSize: '14px',
}

const footerStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  marginTop: '16px',
}

const cancelButtonStyle = {
  padding: '8px 16px',
  background: '#fff',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  cursor: 'pointer',
}

const submitButtonStyle = {
  padding: '8px 16px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
}

export default NewEnquiryModal
