import React, { useEffect } from 'react'
import { usePlatformCrm } from '../hooks/usePlatformCrm.js'

export const EnquiryManagementView = () => {
  const { enquiries, pagination, loading, error, fetchEnquiriesList } = usePlatformCrm()

  useEffect(() => {
    // Fetch initial list of enquiries
    fetchEnquiriesList({ page: 1, limit: 10 })
  }, [fetchEnquiriesList])

  return (
    <div className="enquiry-management-container p-6 bg-white shadow-md rounded-lg">
      <div className="header flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Enquiry Management</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-400 rounded">
          {error}
        </div>
      )}

      <div className="table-container overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Enquiry ID
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Community Name
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact Person
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Units
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Interested Features
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created Date
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading && (
              <tr>
                <td colSpan="10" className="py-4 text-center text-gray-500">
                  Loading enquiries...
                </td>
              </tr>
            )}
            {!loading && enquiries.length === 0 && (
              <tr>
                <td colSpan="10" className="py-4 text-center text-gray-500">
                  No enquiries found.
                </td>
              </tr>
            )}
            {!loading &&
              enquiries.map((enquiry) => (
                <tr key={enquiry._id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-blue-600 font-medium whitespace-nowrap">
                    {enquiry.enquiryId}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900">{enquiry.organizationName}</td>
                  <td className="py-3 px-4 text-sm text-gray-900">{enquiry.username}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{enquiry.email}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{enquiry.phone}</td>
                  <td className="py-3 px-4 text-sm text-gray-900">{enquiry.totalUnits}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    <span
                      className="truncate block max-w-xs"
                      title={enquiry.selectedFeatures?.join(', ')}
                    >
                      {enquiry.selectedFeatures?.length || 0} features
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${
                      enquiry.status === 'Won'
                        ? 'bg-green-100 text-green-800'
                        : enquiry.status === 'Lost'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}
                    >
                      {enquiry.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {new Date(enquiry.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium">
                    <button className="text-indigo-600 hover:text-indigo-900 mr-3">View</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Basic Pagination Controls */}
      <div className="pagination flex items-center justify-between mt-4 border-t pt-4">
        <div className="text-sm text-gray-500">
          Showing page {pagination.currentPage} of {pagination.totalPages || 1} (
          {pagination.totalRecords} total records)
        </div>
        <div className="flex space-x-2">
          <button
            disabled={pagination.currentPage <= 1 || loading}
            onClick={() =>
              fetchEnquiriesList({ page: pagination.currentPage - 1, limit: pagination.limit })
            }
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            disabled={pagination.currentPage >= pagination.totalPages || loading}
            onClick={() =>
              fetchEnquiriesList({ page: pagination.currentPage + 1, limit: pagination.limit })
            }
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

export default EnquiryManagementView
