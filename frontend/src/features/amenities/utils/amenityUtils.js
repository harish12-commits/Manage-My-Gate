/**
 * Formats a given number into local currency format (INR)
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  const num = amount || 0
  return `₹${num.toLocaleString('en-IN')}`
}

/**
 * Formats a time string (HH:mm) to AM/PM format
 * @param {string} timeString - The 24h time string
 * @returns {string} Formatted 12h time string
 */
export const formatTimeAMPM = (timeString) => {
  if (!timeString) return ''
  const [hours, minutes] = timeString.split(':')
  let h = parseInt(hours, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  h = h ? h : 12 // the hour '0' should be '12'
  return `${h}:${minutes} ${ampm}`
}

/**
 * Maps day index (0-6) to day name
 * @param {number} dayIndex - 0 for Sunday, 6 for Saturday
 * @returns {string} Day name (short)
 */
export const getDayName = (dayIndex) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[dayIndex] || ''
}

/**
 * Returns a fallback image URL for an amenity based on its name
 * @param {string} name - Amenity name
 * @returns {string} Image URL
 */
export const getAmenityImagePlaceholder = (name) => {
  if (!name)
    return 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1470&auto=format&fit=crop'

  const lowerName = name.toLowerCase()
  if (lowerName.includes('gym') || lowerName.includes('fitness') || lowerName.includes('workout')) {
    return 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop'
  }
  if (lowerName.includes('pool') || lowerName.includes('swim')) {
    return 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?q=80&w=1470&auto=format&fit=crop'
  }
  if (lowerName.includes('tennis')) {
    return 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=1470&auto=format&fit=crop'
  }
  if (lowerName.includes('badminton') || lowerName.includes('court')) {
    return 'https://images.unsplash.com/photo-1622279457486-69d73ce58b09?q=80&w=1470&auto=format&fit=crop'
  }
  if (lowerName.includes('club') || lowerName.includes('hall') || lowerName.includes('party')) {
    return 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1498&auto=format&fit=crop'
  }

  return 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1470&auto=format&fit=crop' // Default
}
