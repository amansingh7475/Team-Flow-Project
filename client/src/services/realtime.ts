import { io, type Socket } from 'socket.io-client'
import { dataMode } from './apiClient'

const socketUrl = String(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/api\/v1\/?$/, '')
export function connectRealtime(handlers: { onDataChanged: () => void; onReconnect: () => void; onError: (message: string) => void }): Socket | null {
  if (dataMode !== 'api') return null
  const workspaceId = sessionStorage.getItem('teamflow_workspace_id') || ''
  const socket = io(socketUrl, { withCredentials: true, auth: { workspaceId }, autoConnect: true })
  const change = () => handlers.onDataChanged()
  socket.on('task:created', change).on('task:updated', change).on('task:status-changed', change).on('task:deleted', change).on('comment:created', change).on('notification:new', change)
  socket.on('connect', () => { if (socket.recovered) handlers.onReconnect() })
  socket.on('connect_error', error => handlers.onError(error.message || 'Realtime connection failed'))
  socket.io.on('reconnect', handlers.onReconnect)
  return socket
}
