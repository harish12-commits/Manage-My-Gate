import { useDispatch, useSelector } from 'react-redux'
import { useCallback, useState } from 'react'
import { submitRegistrationEnquiry, resetRegistrationState } from '../registrationSlice.js'

export const useRegistration = () => {
  const dispatch = useDispatch()
  const { loading, success, error, enquiryId } = useSelector((state) => state.registration)

  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 3

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => (prev < totalSteps ? prev + 1 : prev))
  }, [])

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => (prev > 1 ? prev - 1 : prev))
  }, [])

  const submitRegistration = useCallback(
    async (data) => {
      await dispatch(submitRegistrationEnquiry(data))
    },
    [dispatch],
  )

  const reset = useCallback(() => {
    setCurrentStep(1)
    dispatch(resetRegistrationState())
  }, [dispatch])

  return {
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    submitRegistration,
    reset,
    loading,
    success,
    error,
    enquiryId,
  }
}
