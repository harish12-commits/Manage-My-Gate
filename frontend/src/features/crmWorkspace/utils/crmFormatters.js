/**
 * Format currency amounts nicely.
 * @param {number} amount
 * @param {string} [currency='INR']
 */
export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === null || amount === undefined) return '₹0.00'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Format ISO date string into human-readable date.
 * @param {string|Date} dateString
 * @param {boolean} [includeTime=true]
 */
export const formatDate = (dateString, includeTime = true) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Invalid Date'

  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime && { hour: '2-digit', minute: '2-digit' }),
  }

  return new Intl.DateTimeFormat('en-US', options).format(date)
}

/**
 * Map status string to visual styling metadata (badge color, label).
 * @param {string} status
 */
export const formatStatusBadge = (status) => {
  switch (status?.toUpperCase()) {
    case 'NEW':
      return { label: 'New', color: 'primary', className: 'bg-primary-subtle text-primary' }
    case 'QUALIFIED':
      return { label: 'Qualified', color: 'info', className: 'bg-info-subtle text-info' }
    case 'DEMO_SCHEDULED':
      return {
        label: 'Demo Scheduled',
        color: 'warning',
        className: 'bg-warning-subtle text-warning',
      }
    case 'PROPOSAL_SENT':
      return {
        label: 'Proposal Sent',
        color: 'secondary',
        className: 'bg-secondary-subtle text-secondary',
      }
    case 'CLOSED_WON':
      return { label: 'Closed Won', color: 'success', className: 'bg-success-subtle text-success' }
    case 'CLOSED_LOST':
      return { label: 'Closed Lost', color: 'danger', className: 'bg-danger-subtle text-danger' }
    case 'PENDING':
      return { label: 'Pending', color: 'warning', className: 'bg-warning-subtle text-warning' }
    case 'IN_PROGRESS':
      return { label: 'In Progress', color: 'info', className: 'bg-info-subtle text-info' }
    case 'COMPLETED':
      return { label: 'Completed', color: 'success', className: 'bg-success-subtle text-success' }
    case 'SCHEDULED':
      return { label: 'Scheduled', color: 'primary', className: 'bg-primary-subtle text-primary' }
    case 'CANCELLED':
      return { label: 'Cancelled', color: 'danger', className: 'bg-danger-subtle text-danger' }
    default:
      return { label: status || 'Unknown', color: 'dark', className: 'bg-light text-dark' }
  }
}

/**
 * Get uppercase initials from full name.
 * @param {string} name
 */
export const getInitials = (name) => {
  if (!name) return 'U'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}
