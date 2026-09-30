import React, { useEffect, useState } from 'react'
import { CSpinner } from '@coreui/react'
import useAmenityMaster from '../hooks/useAmenityMaster.js'
import AmenityGrid from '../components/master/AmenityGrid.jsx'
import AmenityFormModal from '../components/master/AmenityFormModal.jsx'
import AmenityDetailsDrawer from '../components/master/AmenityDetailsDrawer.jsx'
import DeleteConfirmationModal from '../components/common/DeleteConfirmationModal.jsx'
import AmenityDeactivationConflictModal from '../components/master/AmenityDeactivationConflictModal.jsx'
import AmenitiesTopNav from '../components/AmenitiesTopNav.jsx'
import toast from 'react-hot-toast'
import '../styles/_amenities.scss'
import AppLoader from '../../../components/common/AppLoader'

const AmenitiesMasterView = () => {
  const {
    items,
    loading,
    error,
    canManage,
    canCreate,
    canUpdate,
    canDelete,
    search,
    setSearch,
    loadAmenities,
    createAmenity,
    updateAmenity,
    updateAmenityStatus,
    deleteAmenity,
  } = useAmenityMaster()

  const [formModalVisible, setFormModalVisible] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [selectedAmenity, setSelectedAmenity] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [statusModalVisible, setStatusModalVisible] = useState(false)
  const [deactivationConflict, setDeactivationConflict] = useState(null)

  useEffect(() => {
    loadAmenities()
  }, [loadAmenities])

  const handleAddClick = () => {
    setSelectedAmenity(null)
    setFormModalVisible(true)
  }

  const handleEditClick = (amenity) => {
    setSelectedAmenity(amenity)
    setFormModalVisible(true)
  }

  const handleViewDetails = (amenity) => {
    setSelectedAmenity(amenity)
    setDrawerVisible(true)
  }

  const handleSave = async (data) => {
    try {
      if (!data) throw new Error("Form data is undefined")

      // Map the legacy UI data to the new Domain schema required by backend V2
      const mappedPayload = {
        ...data,
        code: data.code || (data.name || 'FACILITY').toUpperCase().replace(/\s+/g, '-').substring(0, 15) + '-' + Math.floor(1000 + Math.random() * 9000),
        archetype:
          data.type === 'Event Space'
            ? 'EVENT_SPACE'
            : data.type === 'Sports'
            ? 'EXCLUSIVE_HOURLY'
            : 'SHARED_CAPACITY',
        operatingHours:
          data.openDays?.map((day) => ({
            dayOfWeek: day,
            openTime: data.bookingRules?.openTime || '06:00',
            closeTime: data.bookingRules?.closeTime || '22:00',
            isOpen: true,
          })) || [],
        slotDurationMinutes: data.bookingRules?.slotDurationMinutes || 60,
        setupBufferMinutes: data.bookingRules?.bufferTimeMinutes || 0,
        advanceBookingDays: data.bookingRules?.advanceBookingDays || 7,
        maxCapacity: data.capacity || 1,
        maxHeadcountPerReservation: data.maxBookingsPerUserPerSlot || 1,
        pricingConfig: {
          pricingType: (data.pricing?.pricingType || 'FREE').toUpperCase(),
          baseRate: data.pricing?.baseRate || 0,
        },
        cancellationPolicy: {
          isAllowed: data.bookingRules?.isCancellationEnabled || false,
          refundCutoffHours: data.bookingRules?.cancellationRefundRules?.[0]?.cancelBeforeHours || 0,
          refundPercentage: data.bookingRules?.cancellationRefundRules?.[0]?.refundPercentage || 0,
        },
        location: data.location || 'N/A',
        status: (String(data.status || 'ACTIVE')).toUpperCase(),
      }

      if (selectedAmenity) {
        await updateAmenity(selectedAmenity._id, mappedPayload)
        toast.success('Amenity updated successfully!')
      } else {
        await createAmenity(mappedPayload)
        toast.success('Amenity created successfully!')
      }
      setFormModalVisible(false)
      loadAmenities()
    } catch (err) {
      console.error('Failed to save amenity:', err)
      toast.error(typeof err === 'string' ? err : err.message || 'Failed to save amenity')
    }
  }

  const handleToggleStatusClick = (amenity) => {
    setSelectedAmenity(amenity)
    setStatusModalVisible(true)
  }

  const handleDeleteClick = (amenity) => {
    setSelectedAmenity(amenity)
    setDeleteModalVisible(true)
  }

  const confirmDelete = async () => {
    if (selectedAmenity) {
      setIsDeleting(true)
      try {
        await deleteAmenity(selectedAmenity._id)
        setDeleteModalVisible(false)
        toast.success(`${selectedAmenity.name} deleted successfully`)
      } catch (err) {
        toast.error(typeof err === 'string' ? err : err.message || 'Failed to delete amenity')
      } finally {
        setIsDeleting(false)
      }
    }
  }

  const confirmStatusChange = async () => {
    if (selectedAmenity) {
      const target = selectedAmenity
      const newStatus = target.status === 'active' ? 'inactive' : 'active'
      setStatusModalVisible(false)
      setIsDeleting(true)
      try {
        await updateAmenityStatus(target._id, newStatus)
        toast.success(
          `${target.name} ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
        )
      } catch (err) {
        const errMsg = typeof err === 'string' ? err : err.message || ''
        if (errMsg.includes('bookingAction') || errMsg.includes('upcoming confirmed booking')) {
          const match = errMsg.match(/(\d+)\s+upcoming/i)
          const count = match ? parseInt(match[1], 10) : 1
          setDeactivationConflict({
            amenity: target,
            count,
            message: errMsg,
          })
        } else {
          toast.error(errMsg || 'Failed to update amenity status')
        }
      } finally {
        setIsDeleting(false)
      }
    }
  }

  const handleResolveDeactivationConflict = async (bookingAction) => {
    if (!deactivationConflict?.amenity) return
    setIsDeleting(true)
    const target = deactivationConflict.amenity
    try {
      await updateAmenityStatus(target._id, 'inactive', bookingAction)
      setDeactivationConflict(null)
      toast.success(
        bookingAction === 'HONOR_EXISTING'
          ? `${target.name} deactivated. Existing bookings will be honored.`
          : `${target.name} deactivated. Existing bookings cancelled with 100% full refund.`
      )
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err.message || 'Failed to deactivate facility')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="amenities-module-wrapper amenity-os-theme">
      <AmenitiesTopNav />
      <div className="view-container">
        <div className="view active" id="view-admin-amenities">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '28px',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <h2 style={{ margin: 0, lineHeight: 1.3 }} className="fs-3">
                Amenity Master
              </h2>
              <p
                style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}
                className="fw-medium small"
              >
                Manage every bookable facility in your community.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <i
                  className="small fa-solid fa-magnifying-glass"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    color: '#6c757d',
                    pointerEvents: 'none',
                  }}
                ></i>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search amenities..."
                  style={{
                    paddingLeft: '38px',
                    width: '260px',
                    borderRadius: '6px',
                    height: '42px',
                    border: '1px solid #ced4da',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {canCreate && (
                <button
                  className="btn btn-primary"
                  onClick={handleAddClick}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <i className="fa-solid fa-plus"></i> Add New
                </button>
              )}
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          {loading && items.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <AppLoader variant="block" />
            </div>
          ) : (
            <AmenityGrid
              amenities={items}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onToggleStatus={handleToggleStatusClick}
              onViewDetails={handleViewDetails}
            />
          )}
        </div>

        {/* Overlays */}
        <AmenityFormModal
          visible={formModalVisible}
          onClose={() => setFormModalVisible(false)}
          onSave={handleSave}
          initialData={selectedAmenity}
        />

        <AmenityDetailsDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          amenity={selectedAmenity}
        />

        <DeleteConfirmationModal
          visible={statusModalVisible}
          onClose={() => setStatusModalVisible(false)}
          onConfirm={confirmStatusChange}
          isDeleting={isDeleting}
          title={selectedAmenity?.status === 'active' ? 'Confirm Deactivate' : 'Confirm Activate'}
          confirmText={selectedAmenity?.status === 'active' ? 'Deactivate' : 'Activate'}
          loadingText={selectedAmenity?.status === 'active' ? 'Deactivating...' : 'Activating...'}
          confirmColor={selectedAmenity?.status === 'active' ? 'var(--warning)' : 'var(--success)'}
          message={
            selectedAmenity
              ? `Are you sure you want to ${selectedAmenity.status === 'active' ? 'deactivate' : 'activate'} ${selectedAmenity.name}? ${selectedAmenity.status === 'active' ? 'It will no longer be available for booking.' : 'It will become available for booking.'}`
              : ''
          }
        />

        <AmenityDeactivationConflictModal
          visible={!!deactivationConflict}
          amenity={deactivationConflict?.amenity}
          bookingsCount={deactivationConflict?.count || 1}
          isLoading={isDeleting}
          onHonorExisting={() => handleResolveDeactivationConflict('HONOR_EXISTING')}
          onCancelAndRefund={() => handleResolveDeactivationConflict('CANCEL_AND_REFUND')}
          onClose={() => setDeactivationConflict(null)}
        />

        <DeleteConfirmationModal
          visible={deleteModalVisible}
          onClose={() => setDeleteModalVisible(false)}
          onConfirm={confirmDelete}
          isDeleting={isDeleting}
          title="Confirm Delete"
          confirmText="Delete"
          loadingText="Deleting..."
          confirmColor="var(--danger)"
          message={
            selectedAmenity
              ? `Are you sure you want to completely delete ${selectedAmenity.name}? This action cannot be undone.`
              : ''
          }
        />
      </div>
    </div>
  )
}

export default AmenitiesMasterView
