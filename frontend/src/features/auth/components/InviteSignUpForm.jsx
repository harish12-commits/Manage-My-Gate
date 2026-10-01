import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import {
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CButton,
  CSpinner,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilUser, cilEnvelopeClosed, cilLockLocked } from '@coreui/icons'

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\\[\]{};':"\\|,.<>\\/?]).{8,}$/

const EyeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
  </svg>
)

const EyeSlashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a18.883 18.883 0 0 0-2.79.223L6.36 3.868C7.458 3.597 8.761 3.5 9 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.7-.7zm-1.802 1.802a8.72 8.72 0 0 1-1.162.721C9.28 14.232 8.704 14.5 8 14.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8c.028-.042.063-.092.109-.151.272-.349.689-.817 1.218-1.348l1.414 1.414A3.5 3.5 0 0 0 8 11.5c.34 0 .668-.05 1.002-.132l1.155 1.155z" />
    <path d="M11.643 14.127L1.393 3.877l-.707.707 1.848 1.848A18.883 18.883 0 0 0 0 8s3 5.5 8 5.5a9.06 9.06 0 0 0 2.737-.418l1.199 1.199.707-.707zM5.337 7.45L8.55 10.662A2.5 2.5 0 0 1 5.337 7.45z" />
    <path d="M12.454 9.638A3.491 3.491 0 0 0 12.5 8a3.5 3.5 0 0 0-7-0c0 .343.05.668.132 1.002L3.93 7.302A3.5 3.5 0 0 1 8 4.5c1.93 0 3.5 1.57 3.5 3.5a3.49 3.49 0 0 1-.132 1.002l1.086 1.336z" />
  </svg>
)

export const InviteSignUpForm = ({ email, token, onSubmit, submitting, submissionError }) => {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [selectedDialCode, setSelectedDialCode] = useState('91')
  const [expectedPhoneLength, setExpectedPhoneLength] = useState(12)

  const schema = yup.object().shape({
    name: yup
      .string()
      .required(t('auth.invite.nameRequired', 'Full name is required'))
      .min(2, t('auth.invite.nameMin', 'Name must be at least 2 characters')),
    phone: yup
      .string()
      .optional()
      .test(
        'phone-valid',
        t(
          'auth.invite.phoneInvalid',
          'Please enter a valid phone number for the selected country.',
        ),
        (value) => {
          const clean = value ? String(value).replace(/\D/g, '') : ''
          if (!clean || clean === selectedDialCode) return true
          return clean.length >= expectedPhoneLength
        },
      ),
    password: yup
      .string()
      .required(t('auth.invite.passwordRequired', 'Password is required'))
      .min(8, t('auth.invite.passwordMinLength', 'Password must be at least 8 characters long'))
      .matches(
        passwordRegex,
        t(
          'auth.invite.passwordStrength',
          'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character',
        ),
      ),
    confirmPassword: yup
      .string()
      .required(t('auth.invite.confirmPasswordRequired', 'Confirm password is required'))
      .oneOf([yup.ref('password')], t('auth.invite.passwordsMustMatch', 'Passwords must match')),
  })

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  })

  const onFormSubmit = (data) => {
    const cleanPhone = data.phone ? String(data.phone).replace(/\D/g, '') : ''
    const formattedPhone = cleanPhone && cleanPhone !== selectedDialCode ? `+${cleanPhone}` : ''

    onSubmit({
      token,
      email,
      name: data.name,
      phone: formattedPhone,
      password: data.password,
    })
  }

  return (
    <CForm onSubmit={handleSubmit(onFormSubmit)} className="invite-signup-form">
      {submissionError && (
        <CAlert color="danger" className="mb-3 py-2 small">
          {submissionError}
        </CAlert>
      )}

      {/* Full Name */}
      <div className="mb-3">
        <label className="form-label small fw-semibold text-muted">
          {t('auth.invite.nameLabel', 'Full Name')} *
        </label>
        <CInputGroup>
          <CInputGroupText className="bg-light">
            <CIcon icon={cilUser} />
          </CInputGroupText>
          <CFormInput
            type="text"
            placeholder={t('auth.invite.namePlaceholder', 'e.g. Jane Doe')}
            disabled={submitting}
            invalid={!!errors.name}
            {...register('name')}
          />
        </CInputGroup>
        {errors.name && <div className="text-danger small mt-1">{errors.name.message}</div>}
      </div>

      {/* Pre-filled Email (Read-Only) */}
      <div className="mb-3">
        <label className="form-label small fw-semibold text-muted">
          {t('auth.invite.emailLabel', 'Email Address')} (
          {t('auth.invite.invitedEmailLocked', 'Verified Invitation Recipient')})
        </label>
        <CInputGroup>
          <CInputGroupText className="bg-light">
            <CIcon icon={cilEnvelopeClosed} />
          </CInputGroupText>
          <CFormInput
            type="email"
            value={email}
            readOnly
            disabled
            className="bg-light text-muted font-monospace"
          />
        </CInputGroup>
        <small className="text-muted" style={{ fontSize: '0.75rem' }}>
          {t(
            'auth.invite.emailLockedHelp',
            'This account will be permanently registered to the invited email.',
          )}
        </small>
      </div>

      {/* Phone with Country Code Selector & Validation */}
      <div className="mb-3">
        <label className="form-label small fw-semibold text-muted">
          {t('auth.invite.phoneLabel', 'Phone Number')} ({t('common.optional', 'Optional')})
        </label>
        <Controller
          name="phone"
          control={control}
          render={({ field: { onChange, value } }) => (
            <PhoneInput
              country={'in'}
              enableSearch
              searchPlaceholder={t('common.searchCountry', 'Search country...')}
              value={value}
              onChange={(phoneVal, countryData) => {
                if (countryData?.dialCode) {
                  setSelectedDialCode(String(countryData.dialCode))
                }
                if (countryData?.format) {
                  const formatDigits = countryData.format.replace(/[^.]/g, '').length
                  setExpectedPhoneLength(formatDigits || 10)
                }
                onChange(phoneVal)
              }}
              disabled={submitting}
              containerClass="invite-phone-container"
              inputClass={`invite-phone-input ${errors.phone ? 'is-invalid' : ''}`}
              buttonClass="invite-phone-button"
              dropdownClass="invite-phone-dropdown"
            />
          )}
        />
        {errors.phone && <div className="text-danger small mt-1">{errors.phone.message}</div>}
      </div>

      {/* Password */}
      <div className="mb-3">
        <label className="form-label small fw-semibold text-muted">
          {t('auth.invite.password', 'Password')} *
        </label>
        <CInputGroup className="position-relative">
          <CInputGroupText className="bg-light">
            <CIcon icon={cilLockLocked} />
          </CInputGroupText>
          <CFormInput
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            disabled={submitting}
            invalid={!!errors.password}
            className="pe-5"
            {...register('password')}
          />
          <button
            type="button"
            className="position-absolute end-0 top-50 translate-middle-y border-0 bg-transparent text-secondary opacity-75 pe-3"
            onClick={() => setShowPassword(!showPassword)}
            style={{ zIndex: 10 }}
            aria-label={
              showPassword
                ? t('common.hidePassword', 'Hide password')
                : t('common.showPassword', 'Show password')
            }
          >
            {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
          </button>
        </CInputGroup>
        {errors.password ? (
          <div className="text-danger small mt-1">{errors.password.message}</div>
        ) : (
          <small className="text-muted" style={{ fontSize: '0.75rem' }}>
            {t(
              'auth.invite.passwordHint',
              'Minimum 8 characters with upper, lower, number, and symbol.',
            )}
          </small>
        )}
      </div>

      {/* Confirm Password */}
      <div className="mb-4">
        <label className="form-label small fw-semibold text-muted">
          {t('auth.invite.confirmPassword', 'Confirm Password')} *
        </label>
        <CInputGroup className="position-relative">
          <CInputGroupText className="bg-light">
            <CIcon icon={cilLockLocked} />
          </CInputGroupText>
          <CFormInput
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="••••••••"
            disabled={submitting}
            invalid={!!errors.confirmPassword}
            className="pe-5"
            {...register('confirmPassword')}
          />
          <button
            type="button"
            className="position-absolute end-0 top-50 translate-middle-y border-0 bg-transparent text-secondary opacity-75 pe-3"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            style={{ zIndex: 10 }}
            aria-label={
              showConfirmPassword
                ? t('common.hidePassword', 'Hide password')
                : t('common.showPassword', 'Show password')
            }
          >
            {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
          </button>
        </CInputGroup>
        {errors.confirmPassword && (
          <div className="text-danger small mt-1">{errors.confirmPassword.message}</div>
        )}
      </div>

      <CButton
        type="submit"
        color="primary"
        className="w-100 py-2 fw-bold rounded-3 shadow-sm text-white"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <CSpinner size="sm" className="me-2" />
            {t('auth.invite.activating', 'Activating Account...')}
          </>
        ) : (
          t('auth.invite.signUpAndJoinCta', 'Create Account & Join Community')
        )}
      </CButton>
    </CForm>
  )
}

InviteSignUpForm.propTypes = {
  email: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired,
  onSubmit: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
  submissionError: PropTypes.string,
}

export default InviteSignUpForm
