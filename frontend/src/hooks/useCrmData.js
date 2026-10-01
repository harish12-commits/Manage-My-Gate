import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../api/axiosInstance'

/**
 * Hook to fetch all CRM inquiries (Leads)
 */
export const useLeads = () => {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const response = await axiosInstance.get('/api/crm/inquiries')
      // Assume the backend returns data inside a standard JSON payload format
      return response.data
    },
    // Optional: Stale time configurations can be added here
  })
}

/**
 * Hook to generate a new Quote (Create Order)
 */
export const useGenerateQuote = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (quotePayload) => {
      const response = await axiosInstance.post('/api/platform-payments/create-order', quotePayload)
      return response.data
    },
    onSuccess: () => {
      // Instantly invalidate the 'leads' cache to trigger a background refetch.
      // This ensures the UI accurately reflects any status changes (e.g. NEW -> SENT).
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}
