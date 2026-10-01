import React, { useState } from 'react'
import { toast } from 'react-hot-toast'
import apiClient from '../../../../services/apiClient.js'

const TenantOnboardingWizard = () => {
  const [step, setStep] = useState(1)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [file, setFile] = useState(null)

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true)
      // Example call to GET /api/tenant/migration-templates
      const response = await apiClient.get('/api/tenant/migration-templates', {
        responseType: 'blob',
      })

      // Handle file download utilizing blob response
      const url = window.URL.createObjectURL(new Blob([response]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'Data_Migration_Template.csv')
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)

      toast.success('Templates downloaded successfully')
    } catch (error) {
      toast.error('Failed to download templates')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleFileUpload = async (e) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please select a file to upload')
      return
    }

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('migrationFile', file)

      // Example call to POST /api/tenant/upload-migration utilizing FormData
      await apiClient.post('/api/tenant/upload-migration', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      toast.success('Data migrated successfully!')
      setStep(4)
    } catch (error) {
      toast.error(error.message || 'Failed to upload migration data')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8 md:p-12 bg-white shadow-2xl rounded-2xl mt-12 border border-gray-100">
      {/* Header and Stepper */}
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
          Tenant Onboarding Wizard
        </h2>
        <p className="text-gray-500 text-lg font-medium">Step {step} of 4</p>

        <div className="w-full bg-gray-200 h-3 mt-6 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Step 1: Welcome */}
      {step === 1 && (
        <div className="animate-fade-in text-center px-4">
          <div className="mb-8 inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-50 text-blue-600 shadow-sm border border-blue-100">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <h3 className="text-3xl font-bold mb-5 text-gray-800">Welcome to Nahom!</h3>
          <p className="text-gray-600 mb-10 text-xl leading-relaxed max-w-2xl mx-auto">
            Your workspace has been provisioned with your requested modules, including Visitor
            Management and Billing. Let's get your community set up.
          </p>
          <button
            onClick={() => setStep(2)}
            className="px-10 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-1 transition-all"
          >
            Start Data Migration
          </button>
        </div>
      )}

      {/* Step 2: Download Templates */}
      {step === 2 && (
        <div className="animate-fade-in px-4">
          <h3 className="text-2xl font-bold mb-4 text-gray-800">Step 2: Download Data Templates</h3>
          <p className="text-gray-600 mb-8 text-lg">
            To migrate your existing community data (residents, units, vehicles), please download
            our standardized CSV templates.
          </p>

          <div className="p-10 border-2 border-dashed border-gray-300 rounded-xl text-center bg-gray-50 mb-8 hover:bg-gray-100 transition-colors">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            <button
              onClick={handleDownloadTemplate}
              disabled={isDownloading}
              className="px-8 py-4 bg-white border border-gray-300 shadow-md rounded-lg font-bold text-gray-700 hover:bg-gray-50 hover:shadow-lg transition-all text-lg"
            >
              {isDownloading ? 'Generating Secure Templates...' : 'Download CSV Templates'}
            </button>
          </div>

          <div className="flex justify-between mt-10">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 text-gray-600 font-semibold hover:text-gray-900 border border-transparent hover:border-gray-300 rounded-lg transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
            >
              Next Step →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Upload Data */}
      {step === 3 && (
        <div className="animate-fade-in px-4">
          <h3 className="text-2xl font-bold mb-4 text-gray-800">Step 3: Upload Migration Data</h3>
          <p className="text-gray-600 mb-8 text-lg">
            Once you have populated the CSV templates with your community data, upload them here to
            securely import them into your workspace.
          </p>

          <form onSubmit={handleFileUpload} className="mb-6">
            <div className="p-10 border-2 border-dashed border-blue-400 rounded-xl text-center bg-blue-50 mb-8 transition-colors hover:bg-blue-100">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={(e) => setFile(e.target.files[0])}
                accept=".csv,.xlsx"
              />
              <svg
                className="mx-auto h-16 w-16 text-blue-500 mb-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                ></path>
              </svg>
              <label
                htmlFor="file-upload"
                className="cursor-pointer text-blue-700 font-bold text-xl hover:text-blue-900 block"
              >
                {file ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="w-6 h-6 mr-2 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                    {file.name}
                  </span>
                ) : (
                  'Click to select file or drag and drop'
                )}
              </label>
              {!file && <p className="text-sm text-blue-500 mt-2">CSV or Excel files only</p>}
            </div>

            <div className="flex justify-between mt-10">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 text-gray-600 font-semibold hover:text-gray-900 border border-transparent hover:border-gray-300 rounded-lg transition-colors"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={isUploading || !file}
                className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:hover:shadow-none transition-all flex items-center text-lg"
              >
                {isUploading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Importing Data...
                  </>
                ) : (
                  'Upload & Import'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 4: Completion */}
      {step === 4 && (
        <div className="animate-fade-in text-center px-4 py-8">
          <div className="mb-8 inline-flex items-center justify-center w-28 h-28 rounded-full bg-green-50 text-green-500 shadow-sm border border-green-100">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>
          <h3 className="text-4xl font-extrabold mb-5 text-gray-800">Onboarding Complete!</h3>
          <p className="text-gray-600 mb-10 text-xl max-w-2xl mx-auto leading-relaxed">
            Your data has been successfully imported. Your workspace is fully configured and ready
            for action.
          </p>
          <a
            href="/dashboard"
            className="px-12 py-4 bg-blue-600 text-white rounded-xl font-bold text-xl hover:bg-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all inline-block"
          >
            Go to Dashboard
          </a>
        </div>
      )}
    </div>
  )
}

export default TenantOnboardingWizard
