const AUTH_KEY = 'catwatch_auth_v1'
const USER_KEY = 'catwatch_user_v1'
export const AUTH_CHANGED_EVENT = 'catwatch-auth-changed'

// Manage the browser session after database login.
export const isAuthenticated = () => localStorage.getItem(AUTH_KEY) === '1'

const notifyAuthChanged = () => {
  // Notify the header to refresh Login/Logout state.
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

// Store only safe profile data from the auth API.
export const login = (profile = {}) => {
  localStorage.setItem(AUTH_KEY, '1')
  localStorage.setItem(USER_KEY, JSON.stringify(profile))
  notifyAuthChanged()
}

export const getCurrentUser = () => {
  try {
    // Read the current user's saved profile.
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export const logout = () => {
  // Clear the local session without deleting database rows.
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(USER_KEY)
  notifyAuthChanged()
}
