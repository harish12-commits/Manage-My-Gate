import axios from 'axios'

// Create a configured Axios instance
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5002',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request Interceptor: Attach JWT Token
axiosInstance.interceptors.request.use(
  (config) => {
    // Retrieve token from local storage
    const token = localStorage.getItem('token')

    // If token exists, inject it into the Authorization header
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Response Interceptor: Handle global 401 Unauthorized errors
axiosInstance.interceptors.response.use(
  (response) => {
    // Pass through successful responses
    return response
  },
  (error) => {
    // Catch 401 Unauthorized errors (e.g., token expired or invalid)
    if (error.response && error.response.status === 401) {
      // Hard clear the auth storage
      localStorage.removeItem('token')
      localStorage.removeItem('user')

      // Force a hard redirect to the login page
      // (Bypassing React Router here guarantees the memory state is wiped)
      window.location.href = '/login'
    }

    return Promise.reject(error)
  },
)

export default axiosInstance
