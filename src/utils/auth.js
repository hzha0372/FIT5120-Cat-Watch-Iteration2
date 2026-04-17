const AUTH_KEY = 'catwatch_auth'

// Normalize input for consistent comparison.
const normalize = (value) => String(value || '').trim()

// Validate username/password against preset credentials.
export const credentialsMatch = (username, password) => {
  return normalize(username) === 'Daniel' && normalize(password) === 'Simba'
}

// Check whether current session is authenticated.
export const isAuthenticated = () => {
  return sessionStorage.getItem(AUTH_KEY) === '1'
}

// Persist login state into session storage.
export const login = () => {
  sessionStorage.setItem(AUTH_KEY, '1')
}

// Clear login state from session storage.
export const logout = () => {
  sessionStorage.removeItem(AUTH_KEY)
}
