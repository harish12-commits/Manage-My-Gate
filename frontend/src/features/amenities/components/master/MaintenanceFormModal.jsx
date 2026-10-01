import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'

const schema = yup
  .object()
  .shape({
    amenityId: yup.string().required('Amenity selection is required'),
    title: yup.string().required('Maintenance title is required'),
    description: yup.string(),
    startDate: yup
      .string()
      .matches(/^\d{4}-\d{2}-\d{2}$/, 'Required format YYYY-MM-DD')
      .required('Start date is required'),
    endDate: yup
      .string()
      .matches(/^\d{4}-\d{2}-\d{2}$/, 'Required format YYYY-MM-DD')
      .required('End date is required'),
    startTime: yup.string(),
    endTime: yup.string(),
    assignedStaff: yup.string(),
  })
  .test('date-check', 'End date/time must be after start date/time', function (value) {
    if (value.startDate && value.endDate) {
      if (new Date(value.endDate) < new Date(value.startDate)) {
        return this.createError({
          path: 'endDate',
          message: 'End date must be after or equal to start date',
        })
      }
      if (value.startDate === value.endDate && value.startTime && value.endTime) {
        if (value.endTime <= value.startTime) {
          return this.createError({
            path: 'endTime',
            message: 'End time must be after start time on the same day',
          })
        }
      }
    }
    return true
  })

const MaintenanceFormModal = ({ visible, onClose, onSave, amenities = [], initialData = null }) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      amenityId: '',
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      assignedStaff: '',
    },
  })

  useEffect(() => {
    if (visible) {
      if (initialData) {
        reset({
          amenityId: initialData.amenityId || '',
          title: initialData.title || '',
          description: initialData.description || '',
          startDate: initialData.startDate || '',
          endDate: initialData.endDate || '',
          startTime: initialData.startTime || '',
          endTime: initialData.endTime || '',
          assignedStaff: initialData.assignedStaff || '',
        })
      } else {
        reset({
          amenityId: '',
          title: '',
          description: '',
          startDate: '',
          endDate: '',
          startTime: '',
          endTime: '',
          assignedStaff: '',
        })
      }
    }
  }, [visible, initialData, reset])

  const onSubmit = async (data) => {
    // Separate out amenityId from the rest of the payload
    const { amenityId, ...maintenanceData } = data
    await onSave(amenityId, maintenanceData)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!visible) return null

  return (
    <div className="modal-overlay active amenity-os-theme" onClick={handleClose}>
      <div className="modal-box" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4 style={{ margin: 0 }} className="fs-4">
            {initialData ? 'Edit Maintenance Task' : 'Schedule Maintenance'}
          </h4>
          <button type="button" className="modal-close" onClick={handleClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="modal-body">
          <form id="maintenance-form" onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label className="form-label">Select Amenity *</label>
              <Controller
                name="amenityId"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <select
                      className={`form-control ${fieldState.error ? 'is-invalid' : ''}`}
                      {...field}
                    >
                      <option value="">-- Select Amenity --</option>
                      {amenities.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                    {fieldState.error && (
                      <span className="text-danger small">{fieldState.error.message}</span>
                    )}
                  </>
                )}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Maintenance Title *</label>
              <Controller
                name="title"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <input
                      type="text"
                      className={`form-control ${fieldState.error ? 'is-invalid' : ''}`}
                      placeholder="e.g. Pool Cleaning"
                      {...field}
                    />
                    {fieldState.error && (
                      <span className="text-danger small">{fieldState.error.message}</span>
                    )}
                  </>
                )}
              />
            </div>

            <div className="form-row-grid">
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <Controller
                  name="startDate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <>
                      <input
                        type="date"
                        className={`form-control ${fieldState.error ? 'is-invalid' : ''}`}
                        {...field}
                      />
                      {fieldState.error && (
                        <span className="text-danger small">{fieldState.error.message}</span>
                      )}
                    </>
                  )}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Date *</label>
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <>
                      <input
                        type="date"
                        className={`form-control ${fieldState.error ? 'is-invalid' : ''}`}
                        {...field}
                      />
                      {fieldState.error && (
                        <span className="text-danger small">{fieldState.error.message}</span>
                      )}
                    </>
                  )}
                />
              </div>
            </div>

            <div className="form-row-grid">
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <Controller
                  name="startTime"
                  control={control}
                  render={({ field, fieldState }) => (
                    <>
                      <input
                        type="time"
                        className={`form-control ${fieldState.error ? 'is-invalid' : ''}`}
                        {...field}
                      />
                      {fieldState.error && (
                        <span className="text-danger small">{fieldState.error.message}</span>
                      )}
                    </>
                  )}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Time</label>
                <Controller
                  name="endTime"
                  control={control}
                  render={({ field, fieldState }) => (
                    <>
                      <input
                        type="time"
                        className={`form-control ${fieldState.error ? 'is-invalid' : ''}`}
                        {...field}
                      />
                      {fieldState.error && (
                        <span className="text-danger small">{fieldState.error.message}</span>
                      )}
                    </>
                  )}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <Controller
                name="description"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <textarea
                      className={`form-control ${fieldState.error ? 'is-invalid' : ''}`}
                      placeholder="Describe the maintenance..."
                      rows="2"
                      {...field}
                    ></textarea>
                    {fieldState.error && (
                      <span className="text-danger small">{fieldState.error.message}</span>
                    )}
                  </>
                )}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Staff</label>
              <Controller
                name="assignedStaff"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <input
                      type="text"
                      className={`form-control ${fieldState.error ? 'is-invalid' : ''}`}
                      placeholder="e.g. John (Facilities)"
                      {...field}
                    />
                    {fieldState.error && (
                      <span className="text-danger small">{fieldState.error.message}</span>
                    )}
                  </>
                )}
              />
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="maintenance-form"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? initialData
                ? 'Saving...'
                : 'Scheduling...'
              : initialData
                ? 'Save Changes'
                : 'Schedule Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MaintenanceFormModal
