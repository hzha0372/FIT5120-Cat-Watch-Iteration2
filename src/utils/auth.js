const AUTH_KEY = 'catwatch_auth'

// Normalize input for consistent comparison. | 功能：标准化输入内容，便于统一比较
const normalize = (value) => String(value || '').trim()

// Validate username/password against preset credentials. | 功能：校验用户名和密码是否匹配预设账号
export const credentialsMatch = (username, password) => {
  return normalize(username) === 'Daniel' && normalize(password) === 'Simba'
}

// Check whether current session is authenticated. | 功能：判断当前会话是否已登录
export const isAuthenticated = () => {
  return sessionStorage.getItem(AUTH_KEY) === '1'
}

// Persist login state into session storage. | 功能：写入登录态到浏览器会话存储
export const login = () => {
  sessionStorage.setItem(AUTH_KEY, '1')
}

// Clear login state from session storage. | 功能：清除浏览器会话中的登录态
export const logout = () => {
  sessionStorage.removeItem(AUTH_KEY)
}
