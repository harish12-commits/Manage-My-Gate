import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from 'react'
import {
  getEnquiryDetail,
  getActivities,
  getStageHistory,
  getInsights,
  addActivity,
  updateEnquiryStage,
  convertToCustomer,
  clearActiveEnquiry,
  assignExecutive,
} from '../platformCrmSlice.js'

export const useEnquiryDetail = () => {
  const dispatch = useDispatch()
  const {
    activeEnquiry,
    activities,
    stageHistory,
    insights,
    loading,
    error,
    actionLoading,
    actionSuccess,
  } = useSelector((state) => state.platformCrm)

  const fetchFullEnquiryData = useCallback(
    (id) => {
      dispatch(getEnquiryDetail(id))
      dispatch(getActivities(id))
      dispatch(getStageHistory(id))
      dispatch(getInsights(id))
    },
    [dispatch],
  )

  const changeStage = useCallback(
    async (id, data) => {
      return await dispatch(updateEnquiryStage({ id, data }))
    },
    [dispatch],
  )

  const createNewActivity = useCallback(
    async (id, data) => {
      return await dispatch(addActivity({ id, data }))
    },
    [dispatch],
  )

  const convertToOrg = useCallback(
    async (id) => {
      return await dispatch(convertToCustomer(id))
    },
    [dispatch],
  )

  const assignSalesExecutive = useCallback(
    async (id, data) => {
      return await dispatch(assignExecutive({ id, data }))
    },
    [dispatch],
  )

  const resetEnquiry = useCallback(() => {
    dispatch(clearActiveEnquiry())
  }, [dispatch])

  return {
    activeEnquiry,
    activities,
    stageHistory,
    insights,
    loading,
    error,
    actionLoading,
    actionSuccess,
    fetchFullEnquiryData,
    changeStage,
    createNewActivity,
    convertToOrg,
    assignSalesExecutive,
    resetEnquiry,
  }
}
