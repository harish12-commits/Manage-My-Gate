import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate checking for an active session on mount
    const checkSession = setTimeout(() => {
      setIsLoading(false)
    }, 500)
    return () => clearTimeout(checkSession)
  }, [])

  const login = async (credentials) => {
    setIsLoading(true)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (credentials.email && credentials.password) {
          const mockUser = {
            id: 1,
            email: credentials.email,
            name: 'Super Admin',
            role: 'SUPER_ADMIN',
          }
          setUser(mockUser)
          setIsAuthenticated(true)
          setIsLoading(false)
          resolve(mockUser)
        } else {
          setIsLoading(false)
          reject(new Error('Invalid credentials'))
        }
      }, 1000)
    })
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
