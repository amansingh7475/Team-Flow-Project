import type { Project, Task, Status } from './mockData'

export type DataMode = 'mock' | 'api'
const baseUrl = String(import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '')
const configuredMode = String(import.meta.env.VITE_DATA_MODE || 'mock')
const deploymentEnv = String(import.meta.env.VITE_DEPLOY_ENV || 'local')
if ((deploymentEnv === 'staging' || deploymentEnv === 'production') && (configuredMode !== 'api' || !import.meta.env.VITE_API_BASE_URL)) {
  throw new Error('Hosted TeamFlow builds require VITE_DATA_MODE=api and VITE_API_BASE_URL')
}
export const dataMode: DataMode = configuredMode === 'api' ? 'api' : 'mock'
export type ApiPage<T> = { items: T[]; page: number; limit: number; total: number; totalPages: number }
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); this.name = 'ApiError' } }
const headers = () => ({ 'Content-Type': 'application/json', 'x-workspace-id': String(import.meta.env.VITE_WORKSPACE_ID || sessionStorage.getItem('teamflow_workspace_id') || '') })

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, credentials: 'include', headers: { ...headers(), ...(init.headers || {}) } })
  const text = await response.text()
  let payload: any = null
  try { payload = text ? JSON.parse(text) : null } catch { payload = null }
  if (!response.ok) { if (response.status === 401) window.dispatchEvent(new CustomEvent('teamflow:session-expired')); throw new ApiError(response.status, payload?.error?.message || 'API request failed') }
  return payload?.data as T
}
const dateValue = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : ''
const displayDate = (value: unknown) => { if (!value) return ''; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) }
const toIsoDate = (value: string | undefined) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
const initials = (name: string) => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '—'
const tone = (name: string) => ({ 'Alex Morgan': 'violet', 'Jordan Reed': 'orange', 'Sofia Kim': 'mint', 'Maya Lee': 'blue', 'Leo Park': 'pink' }[name] || 'violet')
function mapProject(raw: any): Project { return { id: String(raw.id ?? raw._id), name: raw.name || 'Untitled project', code: raw.code || String(raw.name || 'NEW').slice(0, 3).toUpperCase(), color: raw.color || '#7664ef', description: raw.description || '', startDate: dateValue(raw.startDate), due: displayDate(raw.dueDate ?? raw.due), members: (raw.members || raw.memberIds || []).map((member: any) => String(member.id ?? member._id ?? member)), state: raw.state || 'On track' } }
function mapTask(raw: any): Task { const person = raw.assignee?.name || raw.assignee?.email || raw.assigneeName || ''; return { id: String(raw.id ?? raw._id), title: raw.title || '', description: raw.description || '', projectId: String(raw.projectId), status: raw.status || 'todo', priority: raw.priority || 'Medium', due: displayDate(raw.dueDate ?? raw.due), assignee: person, initials: initials(person), tone: tone(person), labels: raw.labels || [], comments: raw.comments || [] } }
const projectBody = (body: Partial<Project>) => ({ ...body, dueDate: toIsoDate(body.due), startDate: toIsoDate(body.startDate), memberIds: (body.members || []).filter(member => /^[a-f\d]{24}$/i.test(member)), due: undefined, members: undefined })
const taskBody = (body: Partial<Task>) => ({ ...body, dueDate: toIsoDate(body.due), assignee: undefined, initials: undefined, tone: undefined, comments: undefined, due: undefined })

export const apiClient = {
  mode: dataMode, baseUrl,
  auth: { register: (body: { name: string; email: string; password: string; workspaceName?: string }) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }), login: (body: { email: string; password: string }) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }), logout: () => request('/auth/logout', { method: 'POST' }), me: () => request<any>('/auth/me'), changePassword: (body: { currentPassword: string; newPassword: string }) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }), requestReset: (email: string) => request('/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) }), resetPassword: (body: { token: string; password: string }) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }) },
  search: async (query: string, limit = 8) => request<any>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  projects: { list: async (params: { page?: number; limit?: number; search?: string; state?: string; sort?: string } = {}) => { const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)])); const result = await request<ApiPage<any>>(`/projects${query.toString() ? `?${query}` : ''}`); return { ...result, items: result.items.map(mapProject) } }, create: async (body: Partial<Project>) => mapProject(await request<any>('/projects', { method: 'POST', body: JSON.stringify(projectBody(body)) })), update: async (id: string, body: Partial<Project>) => mapProject(await request<any>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(projectBody(body)) })), remove: (id: string) => request(`/projects/${id}`, { method: 'DELETE' }) },
  tasks: { list: async (params: { projectId?: string; status?: Status; page?: number; limit?: number } = {}) => { const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])); const result = await request<ApiPage<any>>(`/tasks${query.toString() ? `?${query}` : ''}`); return { ...result, items: result.items.map(mapTask) } }, create: async (body: Partial<Task>) => mapTask(await request<any>('/tasks', { method: 'POST', body: JSON.stringify(taskBody(body)) })), update: async (id: string | number, body: Partial<Task>) => mapTask(await request<any>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(taskBody(body)) })), status: async (id: string | number, status: Status) => mapTask(await request<any>(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })), remove: (id: string | number) => request(`/tasks/${id}`, { method: 'DELETE' }) },
  comments: { list: (taskId: string | number) => request<any[]>(`/tasks/${taskId}/comments`), create: (taskId: string | number, body: { body: string }) => request<any>(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify(body) }) },
  activity: { list: (params: { entityType?: string; entityId?: string } = {}) => { const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value).map(([key, value]) => [key, String(value)])); return request<any[]>(`/activity${query.toString() ? `?${query}` : ''}`) } },
  notifications: { list: () => request<any[]>('/notifications'), read: (id: string) => request(`/notifications/${id}/read`, { method: 'PATCH' }) },
  workspaces: { list: () => request<any[]>('/workspaces') },
  workspace: { get: () => request<any>('/workspace'), invitations: () => request<any[]>('/workspace/invitations'), invite: (email: string, role = 'member') => request<any>('/workspace/invitations', { method: 'POST', body: JSON.stringify({ email, role }) }), updateMember: (membershipId: string, role: string) => request(`/workspace/members/${membershipId}`, { method: 'PATCH', body: JSON.stringify({ role: role.toLowerCase() }) }), removeMember: (membershipId: string) => request(`/workspace/members/${membershipId}`, { method: 'DELETE' }) },
  invitations: { accept: (token: string) => request<any>(`/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' }), decline: (token: string) => request<any>(`/invitations/${encodeURIComponent(token)}/decline`, { method: 'POST' }) },
  dashboard: { get: (range?: string) => request<any>(`/dashboard${range ? `?range=${encodeURIComponent(range)}` : ''}`) },
  analytics: { get: (range?: string) => request<any>(`/analytics${range ? `?range=${encodeURIComponent(range)}` : ''}`) },
}
export { mapProject, mapTask }
