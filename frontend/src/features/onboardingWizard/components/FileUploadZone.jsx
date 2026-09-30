import React, { useState, useRef } from 'react'
import PropTypes from 'prop-types'
import { CAlert, CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilFile } from '@coreui/icons'
import AppLoader from '../../../components/common/AppLoader'

const FileUploadZone = ({ handleFileUpload, loading, error }) => {
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      handleFileUpload(droppedFile)
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      handleFileUpload(selectedFile)
    }
  }

  const handleClickZone = () => {
    if (fileInputRef.current && !loading) {
      fileInputRef.current.click()
    }
  }

  return (
    <div className="file-upload-card">
      {error && (
        <CAlert color="danger" dismissible className="mb-4 text-start">
          {error}
        </CAlert>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv, .xlsx, .xls"
        className="d-none"
      />

      <div
        className={`dropzone ${isDragActive ? 'drag-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickZone}
      >
        {loading ? (
          <div className="d-flex flex-column align-items-center">
            <AppLoader variant="block" />
            <span className="fw-bold text-primary">Parsing & Validating File...</span>
            <small className="text-secondary mt-1">
              Please wait while rows are checked for format and DB duplicates.
            </small>
          </div>
        ) : (
          <>
            <CIcon icon={cilCloudUpload} className="dropzone-icon" />
            <div className="dropzone-title">Drag & Drop your onboarding spreadsheet here</div>
            <div className="dropzone-hint">Supports .csv, .xlsx, and .xls files (Max 10MB)</div>
            <CButton color="primary" size="md" className="px-4">
              <CIcon icon={cilFile} className="me-2" /> Browse File
            </CButton>
          </>
        )}
      </div>
    </div>
  )
}

FileUploadZone.propTypes = {
  handleFileUpload: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
}

export default FileUploadZone
