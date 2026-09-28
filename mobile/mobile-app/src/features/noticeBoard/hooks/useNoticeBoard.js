import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchNotices,
  loadCachedNotices,
  fetchNoticeById,
  createNotice,
  updateNotice,
  deleteNotice,
  togglePinNotice,
  markNoticeAsRead,
  bookmarkNotice,
  fetchNoticeStats,
  acknowledgeNoticeThunk,
  fetchNoticeAcknowledgements,
  fetchNoticeComments,
  addNoticeCommentThunk,
  deleteNoticeCommentThunk,
  fetchNoticeReactions,
  toggleNoticeReactionThunk,
  setSearch as setSearchAction,
  setFilters as setFiltersAction,
  setActiveKpiCard as setActiveKpiCardAction,
  setSort as setSortAction,
  resetFilters as resetFiltersAction,
  setCurrentPage as setCurrentPageAction,
  setLimit as setLimitAction,
  selectNotice as selectNoticeAction,
  clearNoticeErrors as clearNoticeErrorsAction,
  clearNoticeSuccess as clearNoticeSuccessAction,
  clearNotices as clearNoticesAction,
} from '../store/noticeBoardSlice';

/**
 * Notice Board Facade Controller Hook
 * Exposes Redux selectors and memoized dispatch functions to keep visual components thin.
 */
export function useNoticeBoard() {
  const dispatch = useDispatch();

  // State selectors
  const notices = useSelector((state) => state.noticeBoard.notices);
  const selectedNotice = useSelector((state) => state.noticeBoard.selectedNotice);
  const loading = useSelector((state) => state.noticeBoard.loading);
  const error = useSelector((state) => state.noticeBoard.error);
  const success = useSelector((state) => state.noticeBoard.success);
  const pagination = useSelector((state) => state.noticeBoard.pagination);
  const search = useSelector((state) => state.noticeBoard.search);
  const filters = useSelector((state) => state.noticeBoard.filters);
  const activeKpiCard = useSelector((state) => state.noticeBoard.activeKpiCard);
  const sort = useSelector((state) => state.noticeBoard.sort);
  const dashboardStats = useSelector((state) => state.noticeBoard.dashboardStats);
  const dashboardLoading = useSelector((state) => state.noticeBoard.dashboardLoading);
  const dashboardError = useSelector((state) => state.noticeBoard.dashboardError);
  const acknowledging = useSelector((state) => state.noticeBoard.acknowledging);
  const acknowledgeError = useSelector((state) => state.noticeBoard.acknowledgeError);
  const acknowledgements = useSelector((state) => state.noticeBoard.acknowledgements);
  const acknowledgementsLoading = useSelector((state) => state.noticeBoard.acknowledgementsLoading);
  const comments = useSelector((state) => state.noticeBoard.comments);
  const commentsLoading = useSelector((state) => state.noticeBoard.commentsLoading);
  const commentsError = useSelector((state) => state.noticeBoard.commentsError);
  const addingComment = useSelector((state) => state.noticeBoard.addingComment);
  const reactions = useSelector((state) => state.noticeBoard.reactions);
  const reactionsLoading = useSelector((state) => state.noticeBoard.reactionsLoading);

  // User authorization selectors
  const user = useSelector((state) => state.auth?.user || null);

  const isAdmin = !!(
    user &&
    [
      'Admin',
      'Community Admin',
      'Super Admin',
      'Platform Super Admin',
      'SuperAdmin',
    ].includes(user.role)
  );

  const checkPermission = useCallback(
    (permissionName) => {
      if (!user) return false;
      if (isAdmin) return true;
      if (!Array.isArray(user.permissions)) return false;
      const dotForm = permissionName.replace(':', '.');
      const colonForm = permissionName.replace('.', ':');
      return (
        user.permissions.includes(permissionName) ||
        user.permissions.includes(dotForm) ||
        user.permissions.includes(colonForm)
      );
    },
    [user, isAdmin]
  );

  const canCreate = checkPermission('notices:create') || checkPermission('notices:manage_notices');
  const canUpdate = checkPermission('notices:update') || checkPermission('notices:manage_notices');
  const canDelete = checkPermission('notices:delete') || checkPermission('notices:manage_notices');
  const canPin = checkPermission('notices:pin') || checkPermission('notices:manage_notices');
  const canManage = checkPermission('notices:manage_notices') || isAdmin;

  // Thunk Dispatchers
  const loadNotices = useCallback((params = {}) => {
    dispatch(loadCachedNotices());
    return dispatch(fetchNotices(params));
  }, [dispatch]);

  const loadNoticeById = useCallback((id) => {
    dispatch(fetchNoticeById(id));
  }, [dispatch]);

  const submitNotice = useCallback((formData) => {
    return dispatch(createNotice(formData));
  }, [dispatch]);

  const modifyNotice = useCallback((id, formData) => {
    return dispatch(updateNotice({ id, formData }));
  }, [dispatch]);

  const removeNotice = useCallback((id) => {
    return dispatch(deleteNotice(id));
  }, [dispatch]);

  const changePinStatus = useCallback((id, isPinned) => {
    dispatch(togglePinNotice({ id, isPinned }));
  }, [dispatch]);

  const readNotice = useCallback((id) => {
    dispatch(markNoticeAsRead(id));
  }, [dispatch]);

  const toggleBookmark = useCallback((id, isBookmarked) => {
    dispatch(bookmarkNotice({ id, isBookmarked }));
  }, [dispatch]);

  const loadNoticeStats = useCallback(() => {
    dispatch(fetchNoticeStats());
  }, [dispatch]);

  const acknowledgeNotice = useCallback((id, payload = {}) => {
    return dispatch(acknowledgeNoticeThunk({ id, payload }));
  }, [dispatch]);

  const loadNoticeAcknowledgements = useCallback((id, params = {}) => {
    return dispatch(fetchNoticeAcknowledgements({ id, params }));
  }, [dispatch]);

  const loadComments = useCallback((id) => {
    return dispatch(fetchNoticeComments(id));
  }, [dispatch]);

  const postComment = useCallback((id, content, parentCommentId = null) => {
    return dispatch(addNoticeCommentThunk({ id, content, parentCommentId }));
  }, [dispatch]);

  const removeComment = useCallback((id, commentId) => {
    return dispatch(deleteNoticeCommentThunk({ id, commentId }));
  }, [dispatch]);

  const loadReactions = useCallback((id) => {
    return dispatch(fetchNoticeReactions(id));
  }, [dispatch]);

  const toggleReaction = useCallback((id, reactionType = 'LIKE') => {
    return dispatch(toggleNoticeReactionThunk({ id, reactionType }));
  }, [dispatch]);

  // Synchronous Reducer Dispatchers
  const setSearch = useCallback((query) => {
    dispatch(setSearchAction(query));
  }, [dispatch]);

  const setFilters = useCallback((filtersObj) => {
    dispatch(setFiltersAction(filtersObj));
  }, [dispatch]);
  
  const setActiveKpiCard = useCallback((kpi) => {
    dispatch(setActiveKpiCardAction(kpi));
  }, [dispatch]);

  const setSort = useCallback((sortObj) => {
    dispatch(setSortAction(sortObj));
  }, [dispatch]);

  const resetFilters = useCallback(() => {
    dispatch(resetFiltersAction());
  }, [dispatch]);

  const setCurrentPage = useCallback((page) => {
    dispatch(setCurrentPageAction(page));
  }, [dispatch]);

  const setLimit = useCallback((limit) => {
    dispatch(setLimitAction(limit));
  }, [dispatch]);

  const selectNotice = useCallback((notice) => {
    dispatch(selectNoticeAction(notice));
  }, [dispatch]);

  const clearNoticeErrors = useCallback(() => {
    dispatch(clearNoticeErrorsAction());
  }, [dispatch]);

  const clearNoticeSuccess = useCallback(() => {
    dispatch(clearNoticeSuccessAction());
  }, [dispatch]);

  const clearNotices = useCallback(() => {
    dispatch(clearNoticesAction());
  }, [dispatch]);

  return {
    // Selectors
    notices,
    selectedNotice,
    loading,
    error,
    success,
    pagination,
    search,
    filters,
    activeKpiCard,
    sort,
    dashboardStats,
    dashboardLoading,
    dashboardError,
    acknowledging,
    acknowledgeError,
    acknowledgements,
    acknowledgementsLoading,
    comments,
    commentsLoading,
    commentsError,
    addingComment,
    reactions,
    reactionsLoading,
    canCreate,
    canUpdate,
    canDelete,
    canPin,
    canManage,
    isAdmin,
    user,

    // Thunk Dispatchers
    loadNotices,
    loadNoticeById,
    submitNotice,
    modifyNotice,
    removeNotice,
    changePinStatus,
    readNotice,
    toggleBookmark,
    loadNoticeStats,
    acknowledgeNotice,
    loadNoticeAcknowledgements,
    loadComments,
    postComment,
    removeComment,
    loadReactions,
    toggleReaction,

    // Synchronous Reducers
    setSearch,
    setFilters,
    setActiveKpiCard,
    setSort,
    resetFilters,
    setCurrentPage,
    setLimit,
    selectNotice,
    clearNoticeErrors,
    clearNoticeSuccess,
    clearNotices,
  };
}
