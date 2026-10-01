import { useSelector } from 'react-redux'

/**
 * Custom React hook to check if the current user possesses permission for a feature action.
 * Automatically grants permission for 'Super Admin' users.
 *
 * @param {string} feature - The resource feature (e.g. 'users', 'roles', 'samples')
 * @param {string} action - The action type (e.g. 'create', 'read', 'update', 'delete')
 * @returns {boolean} True if permitted, false otherwise
 */
export const usePermission = (feature, action) => {
  const { user } = useSelector((state) => state.auth)

  if (!user) return false

  // Bypass checks for Super Admin, Community Admin, and Admin roles
  const roleUpper = (user.role || '').toUpperCase()
  if (
    ['Super Admin', 'Platform Super Admin', 'Community Admin', 'Admin', 'SuperAdmin'].includes(
      user.role,
    ) ||
    roleUpper.includes('ADMIN') ||
    roleUpper.includes('SUPER') ||
    user.isPlatform
  ) {
    return true
  }

  const requiredPermission = `${feature}:${action}`
  return !!(user.permissions && user.permissions.includes(requiredPermission))
}

export default usePermission
