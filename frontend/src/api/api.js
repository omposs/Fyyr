import { request } from './client.js'

// One function per backend endpoint. Request and response shapes mirror app/schemas.py (the source of truth):
//   LoginIn {email, password}                      -> LoginOut {access_token, token_type, expires_at, member_id, name}
//   MemberOut {id, name, website}                  (GET /me exposes NO role or admin flag)
//   ProfileOut {member, stated[], inferred[]}      ProfileItemOut {id, category, value, kind, visibility, origin, source_url,
//                                                    source_date, evidence, confidence, approved, last_seen_at, stale}
//   ProfileItemCreate {category: product|technology|market|geography|priority, value, public}
//   ProfileItemPatch {value?, visibility?: public|private, approved?}
//   RecommendationOut {item_id, module, title, summary, url, source_name, published_at, starts_at, location, score, why_it_matters, basis_item_ids}
//   MatchOut {member, score, explanation, basis[]} ChatIn {message, session_id?}  ChatOut {session_id, reply, blocked, block_reason, cited_item_ids, at}
export const CATEGORIES = ['product', 'technology', 'market', 'geography', 'priority']
export const MODULES = ['events', 'funding', 'testbeds', 'news']

export const health = signal => request('/health', { auth: false, signal, timeout: 8000 })

// 401 here means bad credentials, not an expired session.
export const login = (email, password, signal) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false, signal })
export const logout = () => request('/auth/logout', { method: 'POST', expireOn401: false, timeout: 8000 })
// 401 = "Current password is incorrect"; the session itself stays valid (other sessions are signed out by the server).
export const changePassword = (current_password, new_password) => request('/auth/change-password', { method: 'POST', body: { current_password, new_password }, expireOn401: false })

export const me = (signal, timeout) => request('/me', { signal, timeout })
// THE one place that decides "is this account staff". GET /me does not say, so we ask the admin guard itself (read-only
// endpoint): 200 or 404 (scheduler disabled; the guard already passed) = admin; 403 = not an admin (insufficient permission, NOT a
// reason to sign out). 401 is thrown as 'auth' and ends the session in request(). Network and 5xx errors are thrown too, so
// callers can show a temporary-problem state with Retry instead of guessing. The backend still authorises every real request.
export async function isAdmin(signal, timeout) {
  try { await request('/admin/scheduler', { signal, timeout }); return true } catch (e) {
    if (e?.kind === 'notfound') return true
    if (e?.kind === 'forbidden') return false
    throw e
  }
}

export const profile = signal => request('/me/profile', { signal })
// Crawls the member's website (needs BSP_FETCH_ALLOWED_DOMAINS) and returns counts. Synchronous: the call returns when done.
export const runProfiling = () => request('/me/profile/run', { method: 'POST', timeout: 120000 })
export const addItem = (category, value, isPublic = true) => request('/me/profile/items', { method: 'POST', body: { category, value, public: isPublic } })
export const patchItem = (id, patch) => request(`/me/profile/items/${id}`, { method: 'PATCH', body: patch })
export const deleteItem = id => request(`/me/profile/items/${id}`, { method: 'DELETE' })
export const publicProfile = (id, signal) => request(`/members/${id}/profile`, { signal })

export const recommendations = ({ module, limit = 50 } = {}, signal) => request(`/me/recommendations?limit=${limit}${module ? `&module=${module}` : ''}`, { signal })
export const matches = (limit = 10, signal) => request(`/me/matches?limit=${limit}`, { signal })
export const chat = (message, session_id) => request('/me/chat', { method: 'POST', body: session_id ? { message, session_id } : { message }, timeout: 90000 })

// Anonymous public listing (app/api/public.py): no token is sent. The server returns only records approved for public display.
// PublicOpportunityOut {id, module, title, summary, url, source_name, published_at, starts_at, location, tags[], closed}
export const publicOpportunities = (params = {}, signal) => request('/public/opportunities?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')), { auth: false, signal, timeout: 10000 })
export const publicOpportunity = (id, signal) => request(`/public/opportunities/${encodeURIComponent(id)}`, { auth: false, signal, timeout: 10000, expireOn401: false })
