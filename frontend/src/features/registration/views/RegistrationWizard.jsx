import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useRegistration } from '../hooks/useRegistration.js'
import { step1Schema, step2Schema, step3Schema } from '../utils/schemas.js'

const AVAILABLE_FEATURES = [
  'Visitor Management',
  'Maintenance & Billing',
  'Complaints',
  'Notice Board',
  'Facility Booking',
  'Staff Management',
  'Vehicle Management',
  'Marketplace',
  'Polls & Voting',
  'Analytics Dashboard',
  'Security Guard Management',
  'Wallet & Payments',
]

export const RegistrationWizard = () => {
  const {
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    submitRegistration,
    loading,
    success,
    error,
    enquiryId,
    reset,
  } = useRegistration()

  // Pick schema based on step
  let currentSchema = step1Schema
  if (currentStep === 2) currentSchema = step2Schema
  if (currentStep === 3) currentSchema = step3Schema

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    getValues,
    control,
  } = useForm({
    resolver: yupResolver(currentSchema),
    mode: 'onChange',
    defaultValues: {
      username: '',
      email: '',
      phone: '',
      totalUnits: '',
      organizationName: '',
      selectedFeatures: [],
    },
  })

  const handleNext = async () => {
    const isStepValid = await trigger()
    if (isStepValid) {
      nextStep()
    }
  }

  const onSubmit = (data) => {
    if (currentStep === totalSteps) {
      submitRegistration(data)
    }
  }

  if (success) {
    return (
      <div className="registration-success-container text-center p-5">
        <h2 className="text-2xl font-bold text-green-600 mb-4">
          Registration Submitted Successfully!
        </h2>
        <p className="mb-2">
          Your enquiry ID is: <strong>{enquiryId}</strong>
        </p>
        <p className="mb-6">Our team will contact you shortly.</p>
        <button
          className="btn btn-primary px-4 py-2 bg-blue-600 text-white rounded"
          onClick={reset}
        >
          Submit Another Request
        </button>
      </div>
    )
  }

  return (
    <div className="registration-wizard-container max-w-2xl mx-auto p-6 bg-white shadow-md rounded-lg">
      <div className="wizard-header mb-8">
        <h1 className="text-3xl font-bold mb-2">Create Your Community</h1>
        <div className="progress-indicator flex items-center justify-between mt-4">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`step-item flex-1 text-center border-b-4 pb-2 ${currentStep >= step ? 'border-blue-600 text-blue-600 font-semibold' : 'border-gray-200 text-gray-400'}`}
            >
              Step {step}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="error-alert mb-4 p-3 bg-red-100 text-red-700 border border-red-400 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        {currentStep === 1 && (
          <div className="step-1-content space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                {...register('username')}
                className={`w-full p-2 border rounded ${errors.username ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.username && (
                <p className="text-red-500 text-sm mt-1">{errors.username.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email Address</label>
              <input
                type="email"
                {...register('email')}
                className={`w-full p-2 border rounded ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input
                type="text"
                {...register('phone')}
                className={`w-full p-2 border rounded ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Total Units (Villas / Apartments)
              </label>
              <input
                type="number"
                {...register('totalUnits')}
                className={`w-full p-2 border rounded ${errors.totalUnits ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.totalUnits && (
                <p className="text-red-500 text-sm mt-1">{errors.totalUnits.message}</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="step-2-content space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Organization / Community Name
              </label>
              <input
                type="text"
                {...register('organizationName')}
                className={`w-full p-2 border rounded ${errors.organizationName ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.organizationName && (
                <p className="text-red-500 text-sm mt-1">{errors.organizationName.message}</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="step-3-content space-y-4">
            <h3 className="text-lg font-medium mb-2">Select Required Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AVAILABLE_FEATURES.map((feature) => (
                <label key={feature} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    value={feature}
                    {...register('selectedFeatures')}
                    className="form-checkbox h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm">{feature}</span>
                </label>
              ))}
            </div>
            {errors.selectedFeatures && (
              <p className="text-red-500 text-sm mt-1">{errors.selectedFeatures.message}</p>
            )}
          </div>
        )}

        <div className="wizard-footer mt-8 flex justify-between">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={prevStep}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              Previous
            </button>
          )}

          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={handleNext}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Next Step
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="ml-auto px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Enquiry'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default RegistrationWizard
