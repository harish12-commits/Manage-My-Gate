/**
 * Normalizes relative upload image URLs (e.g. /uploads/complaints/xyz.jpg)
 * into absolute URLs pointing to the backend API host.
 */
export function getImageUrl(uri) {
  if (!uri) return ''
  const trimmed = String(uri).trim()
  if (!trimmed) return ''

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed
  }

  const relativePath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const apiBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:5002'
  const host = apiBaseURL.replace(/\/api(\/v\d+)?\/?$/, '')
  return `${host}${relativePath}`
}

export default getImageUrl
