import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CForm,
  CFormInput,
  CButton,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser, cilBuilding } from '@coreui/icons'
import { toast } from 'react-hot-toast'
import apiClient from '../../../services/apiClient'
import loginBG from '../../../assets/images/loginBackGr.avif'
import { setActiveWorkspace } from '../../../features/workspace/store/workspaceSlice.js'

const SetPasswordPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const emailParam = searchParams.get('email') || 'naveenpv5886@gmail.com'
  const orgParam = searchParams.get('org') || 'Your Organization'

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isCheckingAccount, setIsCheckingAccount] = useState(true)
  const [isAlreadyConfigured, setIsAlreadyConfigured] = useState(false)

  useEffect(() => {
    let isMounted = true
    const checkAccount = async () => {
      if (!emailParam) {
        setIsCheckingAccount(false)
        return
      }
      try {
        const response = await apiClient.get(
          `/auth/check-account-status?email=${encodeURIComponent(emailParam)}`,
        )
        const resData = response.data?.data || response.data || {}
        if (isMounted && resData.isAlreadyConfigured) {
          setIsAlreadyConfigured(true)
        }
      } catch (err) {
        // Non-blocking status check fallback
      } finally {
        if (isMounted) setIsCheckingAccount(false)
      }
    }
    checkAccount()
    return () => {
      isMounted = false
    }
  }, [emailParam])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your confirm password.')
      return
    }

    try {
      setIsSubmitting(true)
      toast.loading('Setting account password & activating workspace...', { id: 'set-pass' })

      const response = await apiClient.post('/auth/setup-account-password', {
        email: emailParam,
        password: password,
        orgName: orgParam,
      })

      const responseData = response.data?.data || response.data || {}
      const token = responseData.token
      const user = responseData.user
      const availableWorkspaces =
        responseData.availableWorkspaces || user?.availableWorkspaces || []

      if (token && user) {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
        if (availableWorkspaces.length > 0) {
          localStorage.setItem('availableWorkspaces', JSON.stringify(availableWorkspaces))
        }

        dispatch(
          setActiveWorkspace({
            activeOrganizationId: user.orgId || availableWorkspaces[0]?.orgId,
            activeVillaId: user.villaId || null,
            activeRole: user.role,
            allowedFeatures: user.permissions || [],
            isPlatform: user.isPlatform || false,
            availableWorkspaces: availableWorkspaces,
          }),
        )

        dispatch({
          type: 'auth/loginUser/fulfilled',
          payload: { data: { token, user, availableWorkspaces }, message: 'Account activated!' },
        })

        toast.success('Password configured & workspace activated! Redirecting to Dashboard...', {
          id: 'set-pass',
        })

        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 1000)
      } else {
        localStorage.removeItem('token')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('user')
        sessionStorage.clear()

        toast.success('Password configured & account activated! Redirecting to Login page...', {
          id: 'set-pass',
        })

        setTimeout(() => {
          navigate(`/login?email=${encodeURIComponent(emailParam)}`)
        }, 1000)
      }
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Failed to set password. Please try again.'
      setErrorMsg(msg)
      toast.error(msg, { id: 'set-pass' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAlreadyConfigured) {
    return (
      <div
        className="min-vh-100 d-flex flex-row align-items-center position-relative overflow-hidden"
        style={{ backgroundColor: '#f0f4f8' }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${loginBG})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 1,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.45) 100%)',
            backdropFilter: 'blur(3px)',
            zIndex: 2,
          }}
        />
        <CContainer style={{ position: 'relative', zIndex: 4 }}>
          <CRow className="justify-content-center">
            <CCol md={6} lg={5}>
              <CCard
                className="p-4 border-0 shadow-lg"
                style={{ borderRadius: '16px', background: 'rgba(255, 255, 255, 0.95)' }}
              >
                <CCardBody className="text-center">
                  <div
                    className="d-inline-flex align-items-center justify-content-center bg-success text-white rounded-circle mb-3 shadow"
                    style={{ width: '60px', height: '60px', fontSize: '26px', fontWeight: 'bold' }}
                  >
                    ✓
                  </div>
                  <h2 className="h4 font-weight-bold text-dark mb-2">
                    Account Password Already Set! 🎉
                  </h2>
                  <p className="text-muted small mb-4">
                    The account password for <strong>{emailParam}</strong> has already been
                    configured and activated. You can sign in directly to access your workspace.
                  </p>

                  <div className="p-3 mb-4 rounded-3 border bg-light text-start">
                    <div className="d-flex align-items-center mb-1">
                      <span className="badge bg-success me-2">ACTIVE WORKSPACE</span>
                      <strong className="text-dark">{orgParam}</strong>
                    </div>
                    <div className="text-muted small">
                      Registered Email: <strong>{emailParam}</strong>
                    </div>
                  </div>

                  <CButton
                    color="primary"
                    className="w-100 py-2 font-weight-bold shadow-sm"
                    onClick={() => navigate(`/login?email=${encodeURIComponent(emailParam)}`)}
                  >
                    🔐 Click Here to Sign In ➔
                  </CButton>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CContainer>
      </div>
    )
  }

  return (
    <div
      className="min-vh-100 d-flex flex-row align-items-center position-relative overflow-hidden"
      style={{ backgroundColor: '#f0f4f8' }}
    >
      {/* Background Image Layer */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${loginBG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 1,
          animation: 'subtlePanZoom 30s ease-in-out infinite alternate',
        }}
      />

      <style>
        {`
          @keyframes subtlePanZoom {
            0% { transform: scale(1.0) translate(0, 0); }
            100% { transform: scale(1.1) translate(-1%, -1%); }
          }
        `}
      </style>

      {/* Frosted Glass Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.45) 100%)',
          backdropFilter: 'blur(3px)',
          zIndex: 2,
        }}
      />

      <CContainer style={{ position: 'relative', zIndex: 4 }}>
        <CRow className="justify-content-center">
          <CCol md={6} lg={5}>
            <CCard
              className="p-4 border-0 shadow-lg"
              style={{ borderRadius: '16px', background: 'rgba(255, 255, 255, 0.95)' }}
            >
              <CCardBody>
                <div className="text-center mb-4">
                  <div
                    className="d-inline-flex align-items-center justify-content-center bg-primary text-white rounded-circle mb-3 shadow"
                    style={{ width: '56px', height: '56px' }}
                  >
                    <CIcon icon={cilBuilding} size="xl" />
                  </div>
                  <h2 className="h4 font-weight-bold text-dark mb-1">Set Account Password</h2>
                  <p className="text-muted small mb-0">
                    Create your password to activate organization account access.
                  </p>
                </div>

                {/* Organization Info Banner */}
                <div className="p-3 mb-4 rounded-3 border bg-light">
                  <div className="d-flex align-items-center mb-1">
                    <span className="badge bg-primary me-2">ORGANIZATION</span>
                    <strong className="text-dark">{orgParam}</strong>
                  </div>
                  <div className="text-muted small">
                    User Email: <strong>{emailParam}</strong>
                  </div>
                </div>

                {errorMsg && (
                  <CAlert color="danger" className="py-2 small">
                    {errorMsg}
                  </CAlert>
                )}

                <CForm onSubmit={handleSubmit}>
                  {/* Email Field (Read Only) */}
                  <div className="mb-3">
                    <label className="form-label small font-weight-semibold text-secondary">
                      Registered Email Address
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <CIcon icon={cilUser} />
                      </span>
                      <CFormInput
                        id="email"
                        name="email"
                        type="email"
                        value={emailParam}
                        autoComplete="username"
                        readOnly
                        disabled
                        className="bg-light border-start-0"
                      />
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="mb-3">
                    <label className="form-label small font-weight-semibold text-secondary">
                      New Password
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-white border-end-0">
                        <CIcon icon={cilLockLocked} />
                      </span>
                      <CFormInput
                        id="new-password"
                        name="new-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter new password (min. 6 chars)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        className="border-start-0 border-end-0"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary border-start-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="mb-4">
                    <label className="form-label small font-weight-semibold text-secondary">
                      Confirm Password
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-white border-end-0">
                        <CIcon icon={cilLockLocked} />
                      </span>
                      <CFormInput
                        id="confirm-password"
                        name="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Re-enter password to confirm"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        className="border-start-0 border-end-0"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary border-start-0"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <CButton
                    type="submit"
                    color="primary"
                    className="w-100 py-2 font-weight-bold shadow-sm"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving Password...' : '🔐 Set Password & Activate Account'}
                  </CButton>
                </CForm>

                <div className="text-center mt-3">
                  <a href="/login" className="text-decoration-none small text-muted">
                    Back to Login
                  </a>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default SetPasswordPage
