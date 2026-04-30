const AUTH_KEY = 'catwatch_auth_v1'
const VALID_USERNAME = 'TA19'
const VALID_PASSWORD = '1234'

export const isAuthenticated = () => localStorage.getItem(AUTH_KEY) === '1'

export const validateCredentials = (username, password) => {
  return username === VALID_USERNAME && password === VALID_PASSWORD
}

export const login = () => {
  localStorage.setItem(AUTH_KEY, '1')
}

export const logout = () => {
  localStorage.removeItem(AUTH_KEY)
}
