import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from 'react'
import {
  getEnquiries,
  getEnquiryDetail,
  updateStatus,
  assignExecutive,
  convertToCustomer,
  clearActiveEnquiry,
  clearActionState,
} from '../platformCrmSlice.js'

export const usePlatformCrm = () => {
  const dispatch = useDispatch()
  const { enquiries, pagination, activeEnquiry, loading, error, actionLoading, actionSuccess } =
    useSelector((state) => state.platformCrm)

  const fetchEnquiriesList = useCallback(
    (params = {}) => {
      dispatch(getEnquiries(params))
    },
    [dispatch],
  )

  const fetchEnquiryDetails = useCallback(
    (id) => {
      dispatch(getEnquiryDetail(id))
    },
    [dispatch],
  )

  const changeEnquiryStatus = useCallback(
    async (id, data) => {
      return await dispatch(updateStatus({ id, data }))
    },
    [dispatch],
  )

  const assignSalesExecutive = useCallback(
    async (id, data) => {
      return await dispatch(assignExecutive({ id, data }))
    },
    [dispatch],
  )

  const convertEnquiryToCustomer = useCallback(
    async (id) => {
      return await dispatch(convertToCustomer(id))
    },
    [dispatch],
  )

  const resetActiveEnquiry = useCallback(() => {
    dispatch(clearActiveEnquiry())
  }, [dispatch])

  const resetActionState = useCallback(() => {
    dispatch(clearActionState())
  }, [dispatch])

  return {
    enquiries,
    pagination,
    activeEnquiry,
    loading,
    error,
    actionLoading,
    actionSuccess,
    fetchEnquiriesList,
    fetchEnquiryDetails,
    changeEnquiryStatus,
    assignSalesExecutive,
    convertEnquiryToCustomer,
    resetActiveEnquiry,
    resetActionState,
  }
}
