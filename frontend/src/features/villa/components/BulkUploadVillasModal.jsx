import React, { useState, useRef } from 'react'
import PropTypes from 'prop-types'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CAlert,
  CSpinner,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudDownload, cilCloudUpload, cilCheckCircle, cilWarning } from '@coreui/icons'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { downloadBulkUploadTemplate } from '../services/villaService'

const parseXLSX = (arrayBuffer) => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames.find((s) => s === 'Upload Data') || workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  if (jsonData.length < 2) return []

  const headers = (jsonData[0] || []).map((h) => (h || '').toString().trim().toLowerCase())

  const parsed = []
  for (let i = 1; i < jsonData.length; i++) {
    const values = jsonData[i]
    if (!values || values.length === 0 || (values.length === 1 && !values[0])) continue

    const row = {}
    headers.forEach((header, index) => {
      let key = header
      if (header.includes('unitnumber') || header.includes('unit number')) key = 'unitNumber'
      else if (
        header.includes('blockorbuilding') ||
        header.includes('block') ||
        header.includes('building')
      )
        key = 'blockOrBuilding'
      else if (header.includes('email')) key = 'email'
      else if (header.includes('residenttype') || header.includes('resident type'))
        key = 'residentType'
      else if (
        header.includes('unit type') ||
        header.includes('type') ||
        header.includes('configuration')
      )
        key = 'type'
      else if (header.includes('floor area') || header.includes('sq ft') || header.includes('area'))
        key = 'floorAreaSqFt'
      else if (header.includes('floor')) key = 'floor'
      else if (header.includes('occupancy') || header.includes('status')) key = 'status'
      else if (header.includes('role')) key = 'roleName'
      else if (header.includes('phone') || header.includes('mobile')) key = 'phone'
      else if (header.includes('name') || header.includes('resident name')) key = 'name'

      let rawVal =
        values[index] !== undefined && values[index] !== null ? values[index].toString().trim() : ''
      if (key === 'phone' && rawVal && /[eE]\+/i.test(rawVal)) {
        const num = Number(rawVal)
        if (!isNaN(num)) rawVal = num.toFixed(0)
      }
      row[key] = rawVal
    })

    row.isValidVilla = !!row.unitNumber

    if (row.email) {
      row.isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)
      row.isValidResidentType =
        !row.residentType ||
        ['owner', 'tenant', 'family', 'resident owner', 'resident tenant', 'family member'].some(
          (t) => (row.residentType || '').toLowerCase().includes(t),
        )

      // Fallback to determine roleName from residentType if not provided
      if (!row.roleName && row.residentType) {
        const lowerRes = row.residentType.toLowerCase()
        if (lowerRes.includes('owner')) row.roleName = 'Resident Owner'
        else if (lowerRes.includes('tenant') || lowerRes.includes('resident'))
          row.roleName = 'Resident Tenant'
        else if (lowerRes.includes('family')) row.roleName = 'Family Member'
        else row.roleName = 'Resident Tenant'
      }
      row.isValidRole = !!row.roleName
    } else {
      row.isValidEmail = true
      row.isValidResidentType = true
      row.isValidRole = true
    }

    row.isValid = row.isValidVilla && row.isValidEmail && row.isValidResidentType && row.isValidRole
    parsed.push(row)
  }
  return parsed
}

const parseCSV = (csvText) => {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  // Simple CSV parser that handles quotes
  const parseLine = (line) => {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    result.push(current)
    return result
  }

  const headers = parseLine(lines[0]).map((h) => (h || '').toString().trim().toLowerCase())

  const parsed = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    if (!values || values.length === 0 || (values.length === 1 && !values[0])) continue

    const row = {}
    headers.forEach((header, index) => {
      let key = header
      if (header.includes('unitnumber') || header.includes('unit number')) key = 'unitNumber'
      else if (
        header.includes('blockorbuilding') ||
        header.includes('block') ||
        header.includes('building')
      )
        key = 'blockOrBuilding'
      else if (header.includes('email')) key = 'email'
      else if (header.includes('residenttype') || header.includes('resident type'))
        key = 'residentType'
      else if (
        header.includes('unit type') ||
        header.includes('type') ||
        header.includes('configuration')
      )
        key = 'type'
      else if (header.includes('floor area') || header.includes('sq ft') || header.includes('area'))
        key = 'floorAreaSqFt'
      else if (header.includes('floor')) key = 'floor'
      else if (header.includes('occupancy') || header.includes('status')) key = 'status'
      else if (header.includes('role')) key = 'roleName'
      else if (header.includes('phone') || header.includes('mobile')) key = 'phone'
      else if (header.includes('name') || header.includes('resident name')) key = 'name'

      let rawVal =
        values[index] !== undefined && values[index] !== null ? values[index].toString().trim() : ''
      if (key === 'phone' && rawVal && /[eE]\+/i.test(rawVal)) {
        const num = Number(rawVal)
        if (!isNaN(num)) rawVal = num.toFixed(0)
      }
      row[key] = rawVal
    })

    row.isValidVilla = !!row.unitNumber
    if (row.email) {
      row.isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)
      row.isValidResidentType =
        !row.residentType ||
        ['owner', 'tenant', 'family', 'resident owner', 'resident tenant', 'family member'].some(
          (t) => (row.residentType || '').toLowerCase().includes(t),
        )

      if (!row.roleName && row.residentType) {
        const lowerRes = row.residentType.toLowerCase()
        if (lowerRes.includes('owner')) row.roleName = 'Resident Owner'
        else if (lowerRes.includes('tenant') || lowerRes.includes('resident'))
          row.roleName = 'Resident Tenant'
        else if (lowerRes.includes('family')) row.roleName = 'Family Member'
        else row.roleName = 'Resident Tenant'
      }
      row.isValidRole = !!row.roleName
    } else {
      row.isValidEmail = true
      row.isValidResidentType = true
      row.isValidRole = true
    }
    row.isValid = row.isValidVilla && row.isValidEmail && row.isValidResidentType && row.isValidRole
    parsed.push(row)
  }
  return parsed
}

export const BulkUploadVillasModal = ({ visible, onClose, onBulkUpload }) => {
  const { t } = useTranslation()
  const [parsedRows, setParsedRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef(null)

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadBulkUploadTemplate()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', 'bulk_upload_units_template.csv')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Download Template Error:', err)
      setErrorMsg(t('villas.bulk.downloadError', 'Failed to download template.'))
    }
  }

  const processFile = (file) => {
    setFileName(file.name)
    setErrorMsg('')
    setResults(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        let rows = []
        if (file.name.endsWith('.csv')) {
          rows = parseCSV(event.target.result)
        } else {
          rows = parseXLSX(event.target.result)
        }
        if (rows.length === 0) {
          setErrorMsg(t('villas.bulk.emptyError', 'The uploaded file is empty or missing headers.'))
        } else {
          setParsedRows(rows)
        }
      } catch (err) {
        console.error('File parsing error:', err)
        setErrorMsg(t('villas.bulk.parseError', 'Failed to parse file: ') + err.message)
      }
    }

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file)
    } else {
      reader.readAsArrayBuffer(file)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    processFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.csv'))) {
      processFile(file)
    } else {
      setErrorMsg(
        t('villas.bulk.invalidType', 'Please upload a valid Excel (.xlsx) or CSV (.csv) file.'),
      )
    }
  }

  const handleSubmit = async () => {
    const validRows = parsedRows.filter((r) => r.isValid)
    if (validRows.length === 0) {
      setErrorMsg(t('villas.bulk.noValidRows', 'No valid rows found to upload.'))
      return
    }

    setLoading(true)
    setErrorMsg('')
    try {
      const payload = validRows.map((r) => ({
        unitNumber: r.unitNumber,
        blockOrBuilding: r.blockOrBuilding || undefined,
        floor: r.floor || '',
        type: r.type || 'Apartment',
        status: r.status || 'Vacant',
        floorAreaSqFt: r.floorAreaSqFt ? parseFloat(r.floorAreaSqFt) : undefined,
        name: r.name || undefined,
        email: r.email || undefined,
        phone: r.phone || undefined,
        residentType: r.email ? r.residentType : undefined,
        roleName: r.email ? r.roleName : undefined,
      }))
      const res = await onBulkUpload(payload)
      setResults(res)
      setParsedRows([])
      setFileName('')
    } catch (err) {
      setErrorMsg(err.message || t('villas.bulk.failed', 'Bulk unit upload request failed.'))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setParsedRows([])
    setFileName('')
    setResults(null)
    setErrorMsg('')
    onClose()
  }

  const validCount = parsedRows.filter((r) => r.isValid).length
  const invalidCount = parsedRows.length - validCount

  return (
    <CModal
      visible={visible}
      onClose={handleClose}
      alignment="center"
      size="lg"
      className="bulk-upload-villas-modal"
    >
      <CModalHeader className="border-bottom">
        <CModalTitle className="modal-title-bold">
          {t('villas.bulk.title', 'Bulk Upload Units & Residents')}
        </CModalTitle>
      </CModalHeader>

      <CModalBody className="p-4">
        {!fileName && !parsedRows.length && !results && (
          <div className="mb-4 text-center p-4 border rounded-3 bg-body-secondary">
            <h5 className="fw-semibold mb-2 section-title">
              {t('villas.bulk.step1Title', '1. Download Excel Template')}
            </h5>
            <p className="text-muted small mb-3">
              {t(
                'villas.bulk.step1Desc',
                'Use our template to upload your community units grid. If you supply resident emails, invitations will be sent automatically.',
              )}
            </p>
            <CButton
              color="primary"
              size="sm"
              onClick={handleDownloadTemplate}
              className="d-inline-flex align-items-center gap-2 fw-semibold"
            >
              <CIcon icon={cilCloudDownload} size="sm" />
              {t('villas.bulk.download', 'Download Template')}
            </CButton>
          </div>
        )}

        {errorMsg && (
          <CAlert color="danger" className="mb-4 d-flex align-items-center gap-2 py-2 small">
            <CIcon icon={cilWarning} size="sm" />
            <span>{errorMsg}</span>
          </CAlert>
        )}

        {!results && (
          <div className="mb-4">
            <h5 className="fw-semibold mb-3 section-title">
              {fileName
                ? t('villas.bulk.uploadedFile', 'Uploaded File')
                : t('villas.bulk.step2Title', '2. Upload Excel File')}
            </h5>
            <div
              className="p-4 border rounded-3 text-center bg-body-secondary bulk-dropzone pointer-clickable"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".xlsx,.csv"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="d-none"
              />
              <CIcon icon={cilCloudUpload} size="xl" className="text-muted mb-2 icon-opacity-60" />
              {fileName ? (
                <div>
                  <div className="fw-semibold text-primary mb-1">{fileName}</div>
                  <div className="text-muted small">
                    {t('villas.bulk.replaceDesc', 'Click or drag another file to replace')}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="fw-semibold mb-1">
                    {t('villas.bulk.dropzoneTitle', 'Click to Upload or Drag & Drop File')}
                  </div>
                  <div className="text-muted small">
                    {t(
                      'villas.bulk.dropzoneDesc',
                      'Excel (.xlsx) files only. Maximum file size 2MB.',
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!results && parsedRows.length > 0 && (
          <div className="parsed-preview mb-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-semibold mb-0 section-title">
                {t('villas.bulk.step3Title', '3. Preview Uploaded List')}
              </h5>
              <div className="d-flex gap-2">
                <CBadge color="success">
                  {validCount} {t('villas.bulk.valid', 'Valid')}
                </CBadge>
                {invalidCount > 0 && (
                  <CBadge color="danger">
                    {invalidCount} {t('villas.bulk.invalid', 'Invalid')}
                  </CBadge>
                )}
              </div>
            </div>

            <div className="table-responsive border rounded-3 bulk-table-container">
              <table className="table table-hover align-middle mb-0 small">
                <thead className="table-light sticky-top">
                  <tr>
                    <th scope="col" className="ps-3">
                      {t('villas.bulk.csvUnitNumber', 'Unit Number')}
                    </th>
                    <th scope="col">{t('villas.bulk.csvBlock', 'Block/Building')}</th>
                    <th scope="col">{t('villas.bulk.csvFloor', 'Floor')}</th>
                    <th scope="col">{t('villas.bulk.csvUnitType', 'Unit Type')}</th>
                    <th scope="col">{t('villas.bulk.csvFloorArea', 'Floor Area (Sq.Ft)')}</th>
                    <th scope="col">{t('villas.bulk.csvStatus', 'Occupancy Status')}</th>
                    <th scope="col">{t('villas.bulk.csvName', 'Name')}</th>
                    <th scope="col">{t('villas.bulk.csvEmail', 'Email')}</th>
                    <th scope="col">{t('villas.bulk.csvResidentType', 'Resident Type')}</th>
                    <th scope="col">{t('villas.bulk.csvRole', 'Role')}</th>
                    <th scope="col" className="pe-3 text-center">
                      {t('villas.bulk.tableValidation', 'Validation')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} className={row.isValid ? '' : 'table-warning-row'}>
                      <td className="ps-3 fw-bold text-primary">
                        {row.unitNumber || <span className="text-danger">Missing</span>}
                      </td>
                      <td>{row.blockOrBuilding || <span className="text-muted">—</span>}</td>
                      <td>{row.floor || <span className="text-muted">—</span>}</td>
                      <td>{row.type || <span className="text-muted">—</span>}</td>
                      <td>{row.floorAreaSqFt || <span className="text-muted">—</span>}</td>
                      <td>{row.status || <span className="text-muted">—</span>}</td>
                      <td>{row.name || <span className="text-muted">—</span>}</td>
                      <td>{row.email || <span className="text-muted">—</span>}</td>
                      <td>{row.residentType || <span className="text-muted">—</span>}</td>
                      <td>{row.roleName || <span className="text-muted">—</span>}</td>
                      <td className="pe-3 text-center">
                        {row.isValid ? (
                          <CBadge color="success">{t('villas.bulk.valid', 'Valid')}</CBadge>
                        ) : (
                          <CBadge color="danger">{t('villas.bulk.fixRow', 'Fix Row')}</CBadge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {results && (
          <div className="upload-results">
            <CAlert
              color={results.failureCount === 0 ? 'success' : 'warning'}
              className="mb-4 py-3"
            >
              <div className="d-flex align-items-center gap-2 mb-2">
                <CIcon icon={results.failureCount === 0 ? cilCheckCircle : cilWarning} size="xl" />
                <h6 className="fw-semibold mb-0">
                  {t('villas.bulk.completed', 'Bulk Unit Upload Completed')}
                </h6>
              </div>
              <p className="mb-0 small">
                {t('villas.bulk.resultSummary', {
                  count: results.successCount,
                  total: results.total,
                  defaultValue: `Successfully processed ${results.successCount} of ${results.total} units.`,
                })}
              </p>
            </CAlert>

            {results.successes.length > 0 && (
              <div className="mb-4">
                <h6 className="fw-semibold text-success mb-2 fs-smaller">
                  {t('villas.bulk.processed', 'Successfully Processed:')}
                </h6>
                <div className="list-group rounded-3 bulk-list-container-lg">
                  {results.successes.map((s, idx) => (
                    <div
                      key={idx}
                      className="list-group-item d-flex justify-content-between align-items-center py-2 small"
                    >
                      <div>
                        <span className="fw-bold text-primary">{s.unitNumber}</span>
                        <span className="text-muted ms-2">({s.action})</span>
                        {s.email && (
                          <div className="text-muted bulk-text-xxs">
                            Resident:{' '}
                            <span className="fw-semibold">
                              {s.name ? `${s.name} (${s.email})` : s.email}
                            </span>
                            {s.userInvited ? (
                              <span className="text-success ms-1">✓ Invited</span>
                            ) : (
                              <span className="text-danger ms-1">✗ Failed: {s.inviteError}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <CBadge color="success">Success</CBadge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.failures.length > 0 && (
              <div>
                <h6 className="fw-semibold text-danger mb-2 alert-title-sm">
                  {t('villas.bulk.failedHeader', 'Failed to Process:')}
                </h6>
                <div className="list-group rounded-3 bulk-list-container">
                  {results.failures.map((f, idx) => (
                    <div
                      key={idx}
                      className="list-group-item d-flex justify-content-between align-items-start py-2 small bg-body-secondary-danger"
                    >
                      <div className="ms-2 me-auto">
                        <div className="fw-semibold text-body">{f.unitNumber}</div>
                        <span className="text-muted bulk-text-xxs">Reason: {f.error}</span>
                      </div>
                      <CBadge color="danger">Failed</CBadge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CModalBody>

      <CModalFooter className="border-0 pt-0">
        <CButton color="light" size="sm" onClick={handleClose} disabled={loading}>
          {results ? t('villas.bulk.close', 'Close') : t('villas.bulk.cancel', 'Cancel')}
        </CButton>
        {!results && parsedRows.length > 0 && (
          <CButton
            id="confirm-bulk-upload-villas-btn"
            color="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={loading || validCount === 0}
            className="fw-semibold d-flex align-items-center gap-2"
          >
            {loading ? (
              <>
                <CSpinner size="sm" />
                {t('villas.bulk.processing', 'Processing...')}
              </>
            ) : (
              <>
                {t('villas.bulk.uploadCount', {
                  count: validCount,
                  defaultValue: `Upload ${validCount} Units`,
                })}
              </>
            )}
          </CButton>
        )}
      </CModalFooter>
    </CModal>
  )
}

BulkUploadVillasModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onBulkUpload: PropTypes.func.isRequired,
}

export default BulkUploadVillasModal
