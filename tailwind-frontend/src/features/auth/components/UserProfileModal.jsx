import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CFormLabel,
  CFormInput,
  CButton,
  CAlert,
  CSpinner,
} from '@coreui/react'
import useAuth from '../hooks/useAuth'
import '../styles/_auth.scss'

const schema = yup.object().shape({
  name: yup.string().trim().required('Name is required'),
  phone: yup.string().trim().optional(),
})

const UserProfileModal = ({ visible, onClose }) => {
  const { currentUser, updateProfile, loading, error, successMsg, clearStatus } = useAuth()
  const [previewUrl, setPreviewUrl] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      avatar: null,
    },
  })

  // Watch avatar file selection to update preview
  const avatarFile = watch('avatar')

  useEffect(() => {
    if (avatarFile && avatarFile.length > 0) {
      const file = avatarFile[0]
      const objectUrl = URL.createObjectURL(file)
      setPreviewUrl(objectUrl)

      // Clean up memory
      return () => URL.revokeObjectURL(objectUrl)
    } else {
      setPreviewUrl(null)
    }
  }, [avatarFile])

  // Populate or reset form fields when modal visibility changes
  useEffect(() => {
    if (visible && currentUser) {
      reset({
        name: currentUser.name || '',
        phone: currentUser.phone || '',
        email: currentUser.email || '',
        avatar: null,
      })
      clearStatus()
      setPreviewUrl(null)
    }
  }, [visible, currentUser, reset])

  const onSubmit = async (data) => {
    const formData = new FormData()
    formData.append('name', data.name)
    if (data.phone !== undefined) {
      formData.append('phone', data.phone)
    }
    if (data.avatar && data.avatar.length > 0) {
      formData.append('avatar', data.avatar[0])
    }

    const result = await updateProfile(formData)
    if (result.meta.requestStatus === 'fulfilled') {
      setTimeout(() => {
        onClose()
      }, 1000)
    }
  }

  // Derive static asset base URL
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5006/api'
  const backendHost = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase
  const existingAvatarUrl = currentUser?.avatar ? `${backendHost}/${currentUser.avatar.startsWith('/') ? currentUser.avatar.substring(1) : currentUser.avatar}` : null

  // Capitalized letter fallback
  const fallbackLetter = currentUser?.username ? currentUser.username.charAt(0).toUpperCase() : 'U'

  return (
    <CModal visible={visible} onClose={onClose} id="user-profile-modal" alignment="center">
      <CModalHeader>
        <CModalTitle style={{ fontSize: '1rem', fontWeight: 700 }}>
          My Profile Settings
        </CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CModalBody>
          {error && <CAlert color="danger" className="py-2 small">{error}</CAlert>}
          {successMsg && <CAlert color="success" className="py-2 small">{successMsg}</CAlert>}

          {/* Avatar Preview & File Upload */}
          <div className="profile-avatar-container">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="profile-avatar-preview" />
            ) : existingAvatarUrl ? (
              <img src={existingAvatarUrl} alt="Avatar" className="profile-avatar-preview" />
            ) : (
              <div className="profile-avatar-fallback">{fallbackLetter}</div>
            )}
            
            <div className="w-100 mt-2">
              <CFormLabel htmlFor="profile-avatar-input" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Upload New Avatar
              </CFormLabel>
              <CFormInput
                id="profile-avatar-input"
                type="file"
                accept="image/*"
                {...register('avatar')}
              />
              <div className="text-muted small mt-1">
                Accepted formats: JPG, PNG, WebP (Max size: 2MB)
              </div>
            </div>
          </div>

          {/* Email (Read Only) */}
          <div className="mb-3">
            <CFormLabel htmlFor="profile-email-input" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Email Address
            </CFormLabel>
            <CFormInput
              id="profile-email-input"
              type="email"
              disabled
              {...register('email')}
            />
            <div className="text-muted small mt-1">
              Email address is managed by administrator and cannot be changed.
            </div>
          </div>

          {/* Name */}
          <div className="mb-3">
            <CFormLabel htmlFor="profile-name-input" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Full Name
            </CFormLabel>
            <CFormInput
              id="profile-name-input"
              type="text"
              placeholder="e.g. John Doe"
              {...register('name')}
              invalid={!!errors.name}
            />
            {errors.name && (
              <div className="text-danger small mt-1">
                {errors.name.message}
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="mb-3">
            <CFormLabel htmlFor="profile-phone-input" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Phone Number
            </CFormLabel>
            <CFormInput
              id="profile-phone-input"
              type="text"
              placeholder="e.g. +1234567890"
              {...register('phone')}
              invalid={!!errors.phone}
            />
            {errors.phone && (
              <div className="text-danger small mt-1">
                {errors.phone.message}
              </div>
            )}
          </div>
        </CModalBody>
        <CModalFooter className="border-0 pt-0">
          <CButton id="close-profile-btn" color="light" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </CButton>
          <CButton
            id="save-profile-btn"
            type="submit"
            color="primary"
            size="sm"
            style={{ fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}

UserProfileModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default UserProfileModal
