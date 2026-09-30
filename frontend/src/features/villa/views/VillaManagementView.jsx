import React, { useMemo } from 'react'
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CButton,
  CSpinner,
  CAlert,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilGrid, cilPencil, cilSearch, cilCloudUpload } from '@coreui/icons'
import { useTranslation } from 'react-i18next'

import PageHeader from '../../../components/common/PageHeader'
import DataTable from '../../../components/common/DataTable'
import ActionIconButton from '../../../components/common/ActionIconButton'

import { useAuth } from '../../auth/hooks/useAuth'
import useVilla from '../hooks/useVilla'
import useVillaSocket from '../hooks/useVillaSocket'

import VillaToolbar from '../components/VillaToolbar'
import VillaDetailsModal from '../components/VillaDetailsModal'
import BatchGenerateModal from '../components/BatchGenerateModal'
import BulkUploadVillasModal from '../components/BulkUploadVillasModal'
import VillaFormModal from '../components/VillaFormModal'
import '../styles/_villa.scss'

/**
 * VillaManagementView container
 * Orchestrates layout, state hooks, search queries, pagination, and modals.
 */
export const VillaManagementView = () => {
  const { t } = useTranslation()
  const { checkPermission } = useAuth()
  const canCreate = checkPermission('villas:create')

  const {
    villas,
    blocks,
    blocksLoading,
    stats,
    searchQuery,
    blockFilter,
    statusFilter,
    currentPage,
    totalPages,
    loading,
    error,
    orgId,

    // Modal Control Flags
    detailsVisible,
    selectedVillaId,
    formVisible,
    editingVilla,
    batchVisible,
    bulkUploadVisible,

    // Actions
    openDetails,
    closeDetails,
    openForm,
    closeForm,
    openBatch,
    closeBatch,
    openBulkUpload,
    closeBulkUpload,
    handleSearch,
    handleBlockChange,
    handleStatusChange,
    handlePageChange,
    createVilla,
    updateVilla,
    bulkUploadVillas,
  } = useVilla()

  // Mount silent socket listener for real-time state sync
  useVillaSocket(orgId)

  const handleFormSubmit = async (formData) => {
    if (editingVilla) {
      await updateVilla(editingVilla._id, formData)
    } else {
      await createVilla(formData)
    }
  }

  // "?"? DataTable Columns Configuration "?"?
  const columns = useMemo(
    () => [
      {
        key: 'unitNumber',
        label: t('villas.table.unitNumber', 'Unit Number'),
        render: (val) => <span className="fw-semibold text-primary">{val}</span>,
      },
      {
        key: 'blockOrBuilding',
        label: t('villas.table.block', 'Block/Building'),
      },
      {
        key: 'type',
        label: t('villas.table.type', 'Type'),
      },
      {
        key: 'status',
        label: t('villas.table.status', 'Status'),
        render: (val) => {
          let badgeColor = 'secondary'
          if (val === 'Occupied') badgeColor = 'success'
          if (val === 'Vacant') badgeColor = 'warning'
          if (val === 'Under Maintenance') badgeColor = 'danger'
          return (
            <CBadge color={badgeColor} className="small px-2 py-1">
              {val}
            </CBadge>
          )
        },
      },
    ],
    [t],
  )

  // "?"? Render Actions for Data Grid "?"?
  const renderRowActions = (villa) => {
    return (
      <div className="d-flex gap-2">
        <ActionIconButton
          id={`view-villa-${villa._id}`}
          color="secondary"
          onClick={() => openDetails(villa)}
          title={t('common.viewDetails', 'View Details')}
          icon={<CIcon icon={cilSearch} size="sm" />}
        />
        {canCreate && (
          <ActionIconButton
            id={`edit-villa-${villa._id}`}
            color="primary"
            onClick={() => openForm(villa)}
            title={t('common.edit', 'Edit')}
            icon={<CIcon icon={cilPencil} size="sm" />}
          />
        )}
      </div>
    )
  }

  // "?"? Responsive Toolbar Wrapper "?"?
  const toolbar = (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 w-100">
      <VillaToolbar
        searchQuery={searchQuery}
        handleSearch={handleSearch}
        blockFilter={blockFilter}
        handleBlockChange={handleBlockChange}
        statusFilter={statusFilter}
        handleStatusChange={handleStatusChange}
        blocks={blocks}
        blocksLoading={blocksLoading}
      />

      {canCreate && (
        <div className="d-flex gap-2 flex-wrap">
          <CButton
            color="secondary"
            variant="outline"
            size="sm"
            onClick={openBulkUpload}
            className="fw-semibold d-flex align-items-center gap-1"
          >
            <CIcon icon={cilCloudUpload} size="sm" />
            <span>{t('villas.bulkUpload', 'Bulk Upload')}</span>
          </CButton>
          <CButton
            color="primary"
            variant="outline"
            size="sm"
            onClick={openBatch}
            className="fw-semibold d-flex align-items-center gap-1"
          >
            <CIcon icon={cilGrid} size="sm" />
            <span>{t('villas.batchGenerate', 'Batch Generate')}</span>
          </CButton>
        </div>
      )}
    </div>
  )

  return (
    <div className="p-4" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <PageHeader
        title={t('villas.pageTitle', 'Unit Management')}
        subtitle={t(
          'villas.pageSubtitle',
          'Manage community units, occupancies, and property configuration.',
        )}
        actionButtons={
          canCreate ? (
            <CButton
              color="primary"
              onClick={() => openForm()}
              className="fw-semibold d-flex align-items-center gap-2"
            >
              <CIcon icon={cilPlus} />
              {t('villas.createUnit', 'Create Unit')}
            </CButton>
          ) : null
        }
      />

      <CContainer fluid className="px-0">
        {/* Statistics Banner */}
        <CRow className="villa-dashboard-stats g-3 mb-4">
          <CCol xs={12} sm={3}>
            <CCard className="stat-card shadow-sm border-0">
              <CCardBody className="p-3 text-center">
                <div className="stat-title text-muted mb-1">
                  {t('villas.totalUnits', 'TOTAL UNITS')}
                </div>
                <div className="stat-value text-primary">{stats.total || 0}</div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={12} sm={3}>
            <CCard className="stat-card shadow-sm border-0">
              <CCardBody className="p-3 text-center">
                <div className="stat-title text-muted mb-1">
                  {t('villas.occupiedUnits', 'OCCUPIED UNITS')}
                </div>
                <div className="stat-value text-success">{stats.occupied || 0}</div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={12} sm={3}>
            <CCard className="stat-card shadow-sm border-0">
              <CCardBody className="p-3 text-center">
                <div className="stat-title text-muted mb-1">
                  {t('villas.vacantUnits', 'VACANT UNITS')}
                </div>
                <div className="stat-value text-secondary">{stats.vacant || 0}</div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={12} sm={3}>
            <CCard className="stat-card shadow-sm border-0">
              <CCardBody className="p-3 text-center">
                <div className="stat-title text-muted mb-1">
                  {t('villas.maintenanceUnits', 'UNDER MAINTENANCE')}
                </div>
                <div className="stat-value text-warning">{stats.maintenance || 0}</div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

        {/* Global Error Banner */}
        {error && (
          <CAlert color="danger" dismissible>
            {error}
          </CAlert>
        )}

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={villas}
          toolbar={toolbar}
          renderRowActions={renderRowActions}
          currentPage={currentPage}
          totalPages={totalPages}
          rowsPerPage={12}
          onPageChange={handlePageChange}
          loading={loading}
        />
      </CContainer>

      {/* Details Dialog */}
      <VillaDetailsModal
        visible={detailsVisible}
        onClose={closeDetails}
        villaId={selectedVillaId}
        onEdit={(villa) => {
          closeDetails()
          openForm(villa)
        }}
      />

      {/* Form Dialog (Create / Edit) */}
      <VillaFormModal
        visible={formVisible}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
        editingVilla={editingVilla}
      />

      {/* Batch Dialog */}
      <BatchGenerateModal visible={batchVisible} onClose={closeBatch} />

      {/* Bulk Upload Dialog */}
      <BulkUploadVillasModal
        visible={bulkUploadVisible}
        onClose={closeBulkUpload}
        onBulkUpload={bulkUploadVillas}
      />
    </div>
  )
}

export default VillaManagementView
