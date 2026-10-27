import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createServer, type Server as HttpServer } from 'node:http'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { io as socketClient, type Socket } from 'socket.io-client'
import { app } from './app.js'
import { connectDatabase, disconnectDatabase } from './db.js'
import { User, Workspace, WorkspaceMembership } from './models.js'
import { attachRealtime } from './realtime.js'

let mongo: MongoMemoryServer | undefined
let databaseAvailable = false
let workspaceId = ''
let userId = ''
let realtimeHttp: HttpServer | undefined
let realtimePort = 0
const headers = () => ({ 'x-workspace-id': workspaceId, 'x-user-id': userId })

beforeAll(async () => {
  try {
    const uri = process.env.TEST_MONGODB_URI
    mongo = uri ? undefined : await MongoMemoryServer.create()
    await connectDatabase(uri || mongo!.getUri())
    const user = await User.create({ name: 'Test User', email: `test-${Date.now()}@teamflow.local`, passwordHash: 'fixture' })
    const workspace = await Workspace.create({ name: 'Test workspace', slug: `test-${Date.now()}`, ownerId: user._id })
    await WorkspaceMembership.create({ workspaceId: workspace._id, userId: user._id, role: 'owner' })
    userId = String(user._id)
    workspaceId = String(workspace._id)
    databaseAvailable = true
    realtimeHttp = createServer(app)
    attachRealtime(realtimeHttp)
    await new Promise<void>(resolve => realtimeHttp!.listen(0, '127.0.0.1', () => { realtimePort = Number((realtimeHttp!.address() as any).port); resolve() }))
  } catch (error) {
    console.warn('Database integration tests skipped:', error instanceof Error ? error.message : error)
  }
})

afterAll(async () => { if (realtimeHttp) await new Promise<void>(resolve => realtimeHttp!.close(() => resolve())); if (databaseAvailable) await disconnectDatabase(); if (mongo) await mongo.stop() })

describe('TeamFlow API', () => {
  it('reports health without database scope', async () => {
    const response = await request(app).get('/api/v1/health')
    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('ok')
  })

  it('does not grant credentialed CORS access to an untrusted origin', async () => {
    const trusted = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173')
    const untrusted = await request(app).get('/api/v1/health').set('Origin', 'https://untrusted.example')
    expect(trusted.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(trusted.headers['access-control-allow-credentials']).toBe('true')
    expect(untrusted.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('reports database readiness and blocks direct membership creation', async (ctx) => {
    if (!databaseAvailable) ctx.skip()
    expect((await request(app).get('/api/v1/health/ready')).status).toBe(200)
    const agent = request.agent(app)
    const registered = await agent.post('/api/v1/auth/register').send({ name: 'Membership Guard', email: `membership-${Date.now()}@teamflow.local`, password: 'correct horse battery staple', workspaceName: 'Membership Workspace' })
    const workspace = registered.body.data.workspace.id
    const response = await agent.post('/api/v1/workspace/members').set({ 'x-workspace-id': workspace }).send({ userId, role: 'member' })
    expect(response.status).toBe(410)
  })

  it('registers, authenticates, rejects invalid credentials, and logs out', async (ctx) => {
    if (!databaseAvailable) ctx.skip()
    const email = `auth-${Date.now()}@teamflow.local`
    const agent = request.agent(app)
    const registered = await agent.post('/api/v1/auth/register').send({ name: 'Auth User', email, password: 'correct horse battery staple', workspaceName: 'Auth Workspace' })
    expect(registered.status).toBe(201)
    const workspace = registered.body.data.workspace.id
    expect((await agent.get('/api/v1/auth/me').set('x-workspace-id', workspace)).status).toBe(200)
    expect((await request(app).post('/api/v1/auth/login').send({ email, password: 'wrong password' })).status).toBe(401)
    const logout = await agent.post('/api/v1/auth/logout')
    expect(logout.status).toBe(200)
    expect(String(logout.headers['set-cookie'] || '')).toContain('teamflow_session=;')
    expect(String(logout.headers['set-cookie'] || '')).toContain('SameSite=Lax')
    expect((await agent.get('/api/v1/auth/me').set('x-workspace-id', workspace)).status).toBe(401)
  })

  it('creates, lists, updates and deletes a project', async (ctx) => {
    if (!databaseAvailable) ctx.skip()
    const agent = request.agent(app)
    const registered = await agent.post('/api/v1/auth/register').send({ name: 'Project User', email: `project-${Date.now()}@teamflow.local`, password: 'correct horse battery staple', workspaceName: 'Project Workspace' })
    const projectHeaders = { 'x-workspace-id': registered.body.data.workspace.id }
    const created = await agent.post('/api/v1/projects').set(projectHeaders).send({ name: 'API Project', code: 'API', description: 'Created in a test', dueDate: '2026-12-01' })
    expect(created.status).toBe(201)
    const id = created.body.data.id
    expect((await agent.get('/api/v1/projects').set(projectHeaders)).body.data.total).toBe(1)
    expect((await agent.patch(`/api/v1/projects/${id}`).set(projectHeaders).send({ state: 'At risk' })).body.data.state).toBe('At risk')
    expect((await agent.delete(`/api/v1/projects/${id}`).set(projectHeaders)).status).toBe(200)
  })

  it('keeps invitations pending until acceptance and scopes comments/activity', async (ctx) => {
    if (!databaseAvailable) ctx.skip()
    const owner = request.agent(app)
    const invitee = request.agent(app)
    const ownerResponse = await owner.post('/api/v1/auth/register').send({ name: 'Owner', email: `owner-${Date.now()}@teamflow.local`, password: 'correct horse battery staple', workspaceName: 'Secure Workspace' })
    const workspace = ownerResponse.body.data.workspace.id
    const inviteeEmail = `invitee-${Date.now()}@teamflow.local`
    await invitee.post('/api/v1/auth/register').send({ name: 'Invitee', email: inviteeEmail, password: 'correct horse battery staple', workspaceName: 'Other Workspace' })
    const invitation = await owner.post('/api/v1/workspace/invitations').set({ 'x-workspace-id': workspace }).send({ email: inviteeEmail, role: 'member' })
    expect(invitation.status).toBe(201)
    expect(invitation.body.data.token).toBeTruthy()
    expect((await owner.get('/api/v1/workspace').set({ 'x-workspace-id': workspace })).body.data.members.some((member: any) => member.userId?.email === inviteeEmail)).toBe(false)
    const accepted = await invitee.post(`/api/v1/invitations/${invitation.body.data.token}/accept`)
    expect(accepted.status).toBe(200)
    const project = await owner.post('/api/v1/projects').set({ 'x-workspace-id': workspace }).send({ name: 'Comments', code: 'COM', description: 'Activity test' })
    const task = await owner.post('/api/v1/tasks').set({ 'x-workspace-id': workspace }).send({ title: 'Review comment', projectId: project.body.data.id })
    expect((await owner.post(`/api/v1/tasks/${task.body.data.id}/comments`).set({ 'x-workspace-id': workspace }).send({ body: 'Server-backed comment' })).status).toBe(201)
    expect((await owner.get(`/api/v1/tasks/${task.body.data.id}/comments`).set({ 'x-workspace-id': workspace })).body.data[0].body).toBe('Server-backed comment')
    expect((await owner.get('/api/v1/activity').set({ 'x-workspace-id': workspace }).query({ entityType: 'task', entityId: task.body.data.id })).body.data.some((event: any) => event.action === 'commented')).toBe(true)
  })

  it('authenticates sockets, isolates workspaces, and broadcasts task events', async (ctx) => {
    if (!databaseAvailable) ctx.skip()
    const owner = request.agent(app)
    const registered = await owner.post('/api/v1/auth/register').send({ name: 'Socket Owner', email: `socket-${Date.now()}@teamflow.local`, password: 'correct horse battery staple', workspaceName: 'Socket Workspace' })
    const socketWorkspace = registered.body.data.workspace.id
    const cookie = (registered.headers['set-cookie'] as unknown as string[])[0].split(';')[0]
    const socket = socketClient(`http://127.0.0.1:${realtimePort}`, { transports: ['websocket'], extraHeaders: { Cookie: cookie }, auth: { workspaceId: socketWorkspace } })
    const event = new Promise<any>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Timed out waiting for task event')), 4000); socket.once('task:created', value => { clearTimeout(timeout); resolve(value) }) })
    await new Promise<void>((resolve, reject) => { socket.once('connect', () => resolve()); socket.once('connect_error', reject) })
    const project = await owner.post('/api/v1/projects').set({ 'x-workspace-id': socketWorkspace }).send({ name: 'Socket Project', code: 'SOC' })
    const task = await owner.post('/api/v1/tasks').set({ 'x-workspace-id': socketWorkspace }).send({ title: 'Realtime task', projectId: project.body.data.id })
    expect((await event).id).toBe(task.body.data.id)
    socket.close()
    const denied = socketClient(`http://127.0.0.1:${realtimePort}`, { transports: ['websocket'], extraHeaders: { Cookie: cookie }, auth: { workspaceId: '507f1f77bcf86cd799439011' } })
    await new Promise<void>(resolve => { denied.once('connect_error', () => { denied.close(); resolve() }) })
  })
})
