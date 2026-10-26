import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { hashToken, COOKIE_NAME } from './auth.js'
import { Session, User, WorkspaceMembership } from './models.js'
import { env } from './config/env.js'

let io: Server | undefined
const readCookie = (header: string | undefined, name: string) => header?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1)

export function attachRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: env.SOCKET_CORS_ORIGIN || env.FRONTEND_ORIGIN, credentials: true } })
  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, COOKIE_NAME)
      const workspaceId = String(socket.handshake.auth?.workspaceId || socket.handshake.query.workspaceId || '')
      if (!token || !workspaceId) return next(new Error('Authentication required'))
      const session = await Session.findOne({ tokenHash: hashToken(token), revokedAt: null, expiresAt: { $gt: new Date() } })
      if (!session) return next(new Error('Session expired'))
      const user = await User.findById(session.userId)
      const membership = await WorkspaceMembership.findOne({ workspaceId, userId: session.userId })
      if (!user || !membership) return next(new Error('Workspace access denied'))
      socket.data.userId = String(user._id)
      socket.data.workspaceId = workspaceId
      socket.data.role = membership.role
      next()
    } catch { next(new Error('Unable to authenticate socket')) }
  })
  io.on('connection', socket => { socket.join(`workspace:${socket.data.workspaceId}`) })
  return io
}

export function broadcastWorkspace(workspaceId: unknown, event: string, payload: unknown) { io?.to(`workspace:${String(workspaceId)}`).emit(event, payload) }
export function realtimeServer() { return io }
export async function closeRealtime() { if (io) { await io.close(); io = undefined } }
