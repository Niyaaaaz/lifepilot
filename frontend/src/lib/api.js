const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    credentials: options.credentials || 'include',
  })

  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const error = new Error(
      typeof body === 'object' && body?.error?.message
        ? body.error.message
        : `API request failed with status ${response.status}.`,
    )
    error.status = response.status
    error.code = typeof body === 'object' ? body?.error?.code : undefined
    error.details = typeof body === 'object' ? body?.error?.details : undefined
    throw error
  }

  return body
}

export function getApiHealth() {
  return apiRequest('/health', { credentials: 'omit' })
}
