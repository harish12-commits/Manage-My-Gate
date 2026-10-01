import { useDispatch, useSelector } from 'react-redux'
import { fetchMySubscriptionThunk, clearError } from '../store/platformSubscriptionSlice.js'
import { useCallback } from 'react'

export const usePlatformSubscription = () => {
  const dispatch = useDispatch()
  const { subscription, loading, error } = useSelector((state) => state.platformSubscription)

  const fetchMySubscription = useCallback(() => {
    dispatch(fetchMySubscriptionThunk())
  }, [dispatch])

  return {
    subscription,
    loading,
    error,
    fetchMySubscription,
    clearError: () => dispatch(clearError()),
  }
}
