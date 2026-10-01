import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { 
  fetchComplaints, 
  fetchComplaintDetails,
  fetchDashboardAnalytics, 
  fetchCalendarEvents,
  createComplaint,
  updateComplaintStatus,
  assignComplaint,
  addComplaintComment,
  uploadComplaintAttachments,
  updateCurrentComplaint,
  clearErrors,
  acceptAssignment,
  rejectAssignment,
  startWork,
  pauseWork,
  resumeWork,
  markWorkCompleted,
  uploadWorkAttachments,
  addWorkNotes,
  confirmCompletion as confirmCompletionAction,
  addFeedback as addFeedbackAction
} from '../store/complaintSlice';
import { fetchComplaintSettings } from '../store/complaintSettingsSlice';

export const useComplaints = (filters = {}, options = {}) => {
  const dispatch = useDispatch();
  const { list, pagination, currentComplaint, isDetailsLoading, dashboardAnalytics, calendarEvents, status, error } = useSelector((state) => state.complaints);
  const settingsState = useSelector((state) => state.complaintSettings);

  const socketRef = useRef(null);

  useEffect(() => {
    if (options.disableAutoFetch) return;
    // Load data only when component mounts or filters change
    const debounce = setTimeout(() => {
      dispatch(fetchComplaints(filters));
    }, 300);
    return () => clearTimeout(debounce);
  }, [dispatch, JSON.stringify(filters), options.disableAutoFetch]);

  useEffect(() => {
    // Socket initialization for real-time updates
    const token = localStorage.getItem('token');
    socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:5006', {
      auth: { token }
    });

    const handleUpdate = (data) => {
      dispatch(fetchComplaints(filters));
      dispatch(fetchDashboardAnalytics());
      if (data && data._id) {
        dispatch(updateCurrentComplaint(data));
      }
    };

    const socket = socketRef.current;
    
    // Listen to enterprise events
    socket.on('complaint_created', handleUpdate);
    socket.on('complaint_updated', handleUpdate);
    socket.on('complaint_assigned', handleUpdate);
    socket.on('complaint_started', handleUpdate);
    socket.on('complaint_completed', handleUpdate);
    socket.on('complaint_closed', handleUpdate);
    socket.on('complaint_reopened', handleUpdate);
    socket.on('complaint_escalated', handleUpdate);

    return () => {
      socket.off('complaint_created', handleUpdate);
      socket.off('complaint_updated', handleUpdate);
      socket.off('complaint_assigned', handleUpdate);
      socket.off('complaint_started', handleUpdate);
      socket.off('complaint_completed', handleUpdate);
      socket.off('complaint_closed', handleUpdate);
      socket.off('complaint_reopened', handleUpdate);
      socket.off('complaint_escalated', handleUpdate);
      socket.disconnect();
    };
  }, [dispatch, JSON.stringify(filters)]);

  const loadDashboardAnalytics = async (filterParams) => {
    return await dispatch(fetchDashboardAnalytics(filterParams)).unwrap();
  };

  const loadComplaintDetails = async (id) => {
    return await dispatch(fetchComplaintDetails(id)).unwrap();
  };

  const loadCalendarEvents = async (params) => {
    return await dispatch(fetchCalendarEvents(params)).unwrap();
  };

  const createNewComplaint = async (data) => {
    return await dispatch(createComplaint(data)).unwrap();
  };

  const updateStatus = async (id, data) => {
    return await dispatch(updateComplaintStatus({ id, data })).unwrap();
  };

  const assignTechnician = async (id, data) => {
    return await dispatch(assignComplaint({ id, data })).unwrap();
  };

  const addComment = async (id, data) => {
    return await dispatch(addComplaintComment({ id, data })).unwrap();
  };

  const cancelComplaint = async (id, reason) => {
    return await dispatch(updateComplaintStatus({ id, data: { status: 'Cancelled', remarks: reason } })).unwrap();
  };

  const reopenComplaint = async (id, reason) => {
    return await dispatch(updateComplaintStatus({ id, data: { status: 'Reopened', remarks: reason } })).unwrap();
  };

  const confirmCompletion = async (id, payload) => {
    return await dispatch(confirmCompletionAction({ id, ...payload })).unwrap();
  };

  const addFeedback = async (id, data) => {
    return await dispatch(addFeedbackAction({ id, data })).unwrap();
  };

  const uploadFiles = async (formData) => {
    return await dispatch(uploadComplaintAttachments(formData)).unwrap();
  };

  const loadSettings = () => {
    if (settingsState.status === 'idle') {
      dispatch(fetchComplaintSettings());
    }
  };

  const resetErrors = () => {
    dispatch(clearErrors());
  };

  const handleAcceptAssignment = async (id) => dispatch(acceptAssignment(id)).unwrap();
  const handleRejectAssignment = async (id, reason) => dispatch(rejectAssignment({ id, reason })).unwrap();
  const handleStartWork = async (id) => dispatch(startWork(id)).unwrap();
  const handlePauseWork = async (id, reason) => dispatch(pauseWork({ id, reason })).unwrap();
  const handleResumeWork = async (id) => dispatch(resumeWork(id)).unwrap();
  const handleMarkWorkCompleted = async (id, data) => dispatch(markWorkCompleted({ id, data })).unwrap();
  
  const handleUploadWorkAttachments = async (id, attachments) => dispatch(uploadWorkAttachments({ id, attachments })).unwrap();
  const handleAddWorkNotes = async (id, notes) => dispatch(addWorkNotes({ id, notes })).unwrap();
  const handleConfirmCompletion = async (id, payload) => dispatch(confirmCompletionAction({ id, ...payload })).unwrap();

  const exportDataToExcel = () => {
    if (!list || list.length === 0) {
      return;
    }
    
    // Construct CSV header
    const headers = ['Complaint No', 'Resident', 'Category', 'Priority', 'Status', 'Assigned To', 'Created At'];
    
    // Construct CSV rows
    const rows = list.map(c => [
      c.complaintNumber || '',
      c.residentName || (c.residentId && c.residentId.username) || '',
      c.category || '',
      c.priority || '',
      c.status || '',
      c.assignedTechnicianName || c.vendor || 'Unassigned',
      new Date(c.createdAt).toLocaleString()
    ]);
    
    // Combine to CSV format
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Create Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'complaints_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    complaints: list,
    currentComplaint,
    isDetailsLoading,
    pagination,
    dashboardAnalytics,
    calendarEvents,
    isLoading: status === 'loading',
    isError: status === 'failed',
    error,
    assignLoading: status === 'loading',
    assignError: status === 'failed' ? error : null,
    assignSuccess: status === 'succeeded',
    loadComplaintDetails,
    loadDashboardAnalytics,
    loadCalendarEvents,
    createNewComplaint,
    updateStatus,
    assignTechnician,
    assignComplaint: assignTechnician,
    addComment,
    cancelComplaint,
    reopenComplaint,
    confirmCompletion: handleConfirmCompletion,
    uploadFiles,
    loadSettings,
    settings: settingsState.settings,
    isSettingsLoading: settingsState.status === 'loading',
    resetErrors,
    acceptAssignment: handleAcceptAssignment,
    rejectAssignment: handleRejectAssignment,
    startWork: handleStartWork,
    pauseWork: handlePauseWork,
    resumeWork: handleResumeWork,
    markWorkCompleted: handleMarkWorkCompleted,
    uploadWorkAttachments: handleUploadWorkAttachments,
    addWorkNotes: handleAddWorkNotes,
    addFeedback: async (id, payload) => dispatch(addFeedbackAction({ id, data: payload })).unwrap(),
    exportDataToExcel
  };
};

export default useComplaints;
