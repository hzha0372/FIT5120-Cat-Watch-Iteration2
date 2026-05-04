const LOCAL_ACCOUNTS_KEY = 'catwatch_local_accounts_v1'

const cleanText = (value) => String(value || '').trim()
const cleanEmail = (value) => cleanText(value).toLowerCase()

const loadAccounts = () => {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

const saveAccounts = (accounts) => {
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts))
}

const normalizeUser = (account) => ({
  id: account.id,
  name: account.name,
  email: account.email,
  postcode: account.postcode,
  suburbName: '',
})

const registerLocal = (body) => {
  const name = cleanText(body.name)
  const email = cleanEmail(body.email)
  const password = cleanText(body.password)
  const postcode = cleanText(body.postcode)

  if (!name || !email || !password || !postcode) {
    throw new Error('Name, email, password, and postcode are required.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.')
  }
  if (!/^\d{4}$/.test(postcode)) {
    throw new Error('Please enter a valid 4-digit postcode.')
  }

  const accounts = loadAccounts()
  if (accounts.some((item) => item.email === email)) {
    throw new Error('This email is already registered. Please sign in.')
  }

  const account = {
    id: `local-${Date.now()}`,
    name,
    email,
    password,
    postcode,
  }
  accounts.push(account)
  saveAccounts(accounts)
  return { authenticated: true, user: normalizeUser(account) }
}

const loginLocal = (body) => {
  const email = cleanEmail(body.email || body.username)
  const password = cleanText(body.password)
  if (!email || !password) {
    throw new Error('Email and password are required.')
  }

  const account = loadAccounts().find(
    (item) => item.email === email && item.password === password,
  )
  if (!account) {
    throw new Error('Email or password is incorrect.')
  }

  return { authenticated: true, user: normalizeUser(account) }
}

// Use browser-local auth only as a fallback when backend auth is unavailable.
export const authFallback = (body = {}) => {
  const action = cleanText(body.action || 'login').toLowerCase()
  return action === 'register' ? registerLocal(body) : loginLocal(body)
}

