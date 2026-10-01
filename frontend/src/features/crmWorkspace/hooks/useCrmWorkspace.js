import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchInquiries,
  fetchInquiryById,
  createInquiry,
  updateInquiry,
  transitionInquiryStatus,
  fetchInquiryTimeline,
  fetchInquirySummary,
  assignInquiry,
  checkAvailability,
  fetchTasks,
  createTask,
  updateTask,
  fetchMeetings,
  scheduleMeeting,
  fetchThread,
  sendThreadMessage,
  setActiveTab,
  setActiveInquiry,
  clearCrmError,
} from '../store/crmSlice.js'

/**
 * Custom Hook: useCrmWorkspace
 *
 * Controller bridge for the Unified Customer/Deal Workspace UI components.
 * Encapsulates all Redux Toolkit dispatchers and selectors (Thin View Pattern).
 */
export const useCrmWorkspace = () => {
  const dispatch = useDispatch()

  // 1. Selector mappings
  const {
    activeInquiry,
    inquiries,
    tasks,
    meetings,
    timeline,
    summary,
    activeThread,
    pagination,
    taskPagination,
    activeTab,
    loading,
    statusTransitionLoading,
    taskLoading,
    error,
  } = useSelector((state) => state.crmWorkspace || state.crm || {})

  // 2. Interaction Logic Dispatchers
  const handleTabChange = useCallback(
    (tabName) => {
      dispatch(setActiveTab(tabName))
    },
    [dispatch],
  )

  const selectActiveInquiry = useCallback(
    (inquiry) => {
      dispatch(setActiveInquiry(inquiry))
    },
    [dispatch],
  )

  const handleStatusTransition = useCallback(
    (id, nextStatus, metadata = {}) => {
      return dispatch(transitionInquiryStatus({ id, nextStatus, metadata }))
    },
    [dispatch],
  )

  const fetchTimelineData = useCallback(
    (id) => {
      return dispatch(fetchInquiryTimeline(id))
    },
    [dispatch],
  )

  const fetchSummaryData = useCallback(
    (id) => {
      return dispatch(fetchInquirySummary(id))
    },
    [dispatch],
  )

  const fetchInquiriesList = useCallback(
    (params = {}) => {
      return dispatch(fetchInquiries(params))
    },
    [dispatch],
  )

  const fetchInquiryDetails = useCallback(
    (id) => {
      return dispatch(fetchInquiryById(id))
    },
    [dispatch],
  )

  const createInquiryItem = useCallback(
    (payload) => {
      return dispatch(createInquiry(payload))
    },
    [dispatch],
  )

  const updateInquiryItem = useCallback(
    (id, data) => {
      return dispatch(updateInquiry({ id, data }))
    },
    [dispatch],
  )

  const fetchTasksList = useCallback(
    (params = {}) => {
      return dispatch(fetchTasks(params))
    },
    [dispatch],
  )

  const createTaskItem = useCallback(
    (payload) => {
      return dispatch(createTask(payload))
    },
    [dispatch],
  )

  const updateTaskItem = useCallback(
    (id, data) => {
      return dispatch(updateTask({ id, data }))
    },
    [dispatch],
  )

  const fetchMeetingsList = useCallback(
    (params = {}) => {
      return dispatch(fetchMeetings(params))
    },
    [dispatch],
  )

  const scheduleMeetingItem = useCallback(
    (payload) => {
      return dispatch(scheduleMeeting(payload))
    },
    [dispatch],
  )

  const fetchThreadData = useCallback(
    (inquiryId) => {
      return dispatch(fetchThread(inquiryId))
    },
    [dispatch],
  )

  const sendChatMessage = useCallback(
    (inquiryId, messageData) => {
      return dispatch(sendThreadMessage({ inquiryId, messageData }))
    },
    [dispatch],
  )

  const fetchAssignedToMeInquiries = useCallback(
    (userId, params = {}) => {
      return dispatch(fetchInquiries({ ...params, assignedAgentId: userId }))
    },
    [dispatch],
  )

  const fetchUnassignedInquiries = useCallback(
    (params = {}) => {
      return dispatch(fetchInquiries({ ...params, assignedAgentId: 'null' }))
    },
    [dispatch],
  )

  const assignInquiryToUser = useCallback(
    (inquiryId, userId) => {
      return dispatch(assignInquiry({ inquiryId, userId }))
    },
    [dispatch],
  )

  const verifyUserAvailability = useCallback(
    (userIds, startTime, endTime, excludeMeetingId = null) => {
      return dispatch(checkAvailability({ userIds, startTime, endTime, excludeMeetingId }))
    },
    [dispatch],
  )

  const resetError = useCallback(() => {
    dispatch(clearCrmError())
  }, [dispatch])

  return {
    // State
    activeInquiry,
    inquiries,
    tasks,
    meetings,
    timeline,
    summary,
    activeThread,
    pagination,
    taskPagination,
    activeTab,
    loading,
    statusTransitionLoading,
    taskLoading,
    error,

    // Methods
    handleTabChange,
    selectActiveInquiry,
    handleStatusTransition,
    fetchTimelineData,
    fetchSummaryData,
    fetchInquiriesList,
    fetchAssignedToMeInquiries,
    fetchUnassignedInquiries,
    assignInquiryToUser,
    fetchInquiryDetails,
    createInquiryItem,
    updateInquiryItem,
    fetchTasksList,
    createTaskItem,
    updateTaskItem,
    fetchMeetingsList,
    scheduleMeetingItem,
    verifyUserAvailability,
    fetchThreadData,
    sendChatMessage,
    resetError,
  }
}

export default useCrmWorkspace
