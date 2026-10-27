import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { app } from './app.js'
import { connectDatabase, disconnectDatabase } from './db.js'
import { User, WorkspaceMembership } from './models.js'

let mongo: MongoMemoryServer | undefined
let databaseAvailable = false

beforeAll(async () => {
  try {
    const uri = process.env.TEST_MONGODB_URI
    mongo = uri ? undefined : await MongoMemoryServer.create()
    await connectDatabase(uri || mongo!.getUri())
    databaseAvailable = true
  } catch (error) {
    console.warn('RBAC integration tests skipped:', error instanceof Error ? error.message : error)
  }
})

afterAll(async () => {
  if (databaseAvailable) await disconnectDatabase()
  if (mongo) await mongo.stop()
})

describe('TeamFlow RBAC', () => {
  it('protects task and comment mutations by role, authentication, and workspace membership', async (ctx) => {
    if (!databaseAvailable) ctx.skip()
    const owner = request.agent(app)
    const admin = request.agent(app)
    const viewer = request.agent(app)
    const outsider = request.agent(app)
    const register = async (agent: ReturnType<typeof request.agent>, label: string) => {
      const response = await agent.post('/api/v1/auth/register').send({ name: label, email: `${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}@teamflow.local`, password: 'correct horse battery staple', workspaceName: `${label} workspace` })
      expect(response.status).toBe(201)
      return { workspace: response.body.data.workspace.id, userId: response.body.data.user.id, email: response.body.data.user.email }
    }

    const ownerAccount = await register(owner, 'RBAC Owner')
    const adminAccount = await register(admin, 'RBAC Admin')
    const viewerAccount = await register(viewer, 'RBAC Viewer')
    const outsiderAccount = await register(outsider, 'RBAC Outsider')
    const adminInvitation = await owner.post('/api/v1/workspace/invitations').set({ 'x-workspace-id': ownerAccount.workspace }).send({ email: adminAccount.email, role: 'admin' })
    const invitation = await owner.post('/api/v1/workspace/invitations').set({ 'x-workspace-id': ownerAccount.workspace }).send({ email: viewerAccount.email, role: 'viewer' })
    expect(adminInvitation.status).toBe(201)
    expect(invitation.status).toBe(201)
    expect((await admin.post(`/api/v1/invitations/${adminInvitation.body.data.token}/accept`)).status).toBe(200)
    expect((await viewer.post(`/api/v1/invitations/${invitation.body.data.token}/accept`)).status).toBe(200)

    // Exercise the existing member policy without adding another rate-limited account.
    await WorkspaceMembership.updateOne({ workspaceId: ownerAccount.workspace, userId: ownerAccount.userId }, { $set: { role: 'member' } })
    const workspaceHeaders = { 'x-workspace-id': ownerAccount.workspace }
    const project = await owner.post('/api/v1/projects').set(workspaceHeaders).send({ name: 'RBAC Project', code: 'RBC' })
    const task = await owner.post('/api/v1/tasks').set(workspaceHeaders).send({ title: 'RBAC Task', projectId: project.body.data.id })
    const taskId = task.body.data.id
    expect((await admin.patch(`/api/v1/tasks/${taskId}`).set(workspaceHeaders).send({ title: 'Admin update' })).status).toBe(200)

    const expectForbidden = async (response: Promise<any>) => expect((await response).status).toBe(403)
    await expectForbidden(viewer.post('/api/v1/tasks').set(workspaceHeaders).send({ title: 'Viewer task', projectId: project.body.data.id }))
    await expectForbidden(viewer.patch(`/api/v1/tasks/${taskId}`).set(workspaceHeaders).send({ title: 'Viewer update' }))
    await expectForbidden(viewer.patch(`/api/v1/tasks/${taskId}/status`).set(workspaceHeaders).send({ status: 'done' }))
    await expectForbidden(viewer.delete(`/api/v1/tasks/${taskId}`).set(workspaceHeaders))
    await expectForbidden(viewer.post(`/api/v1/tasks/${taskId}/comments`).set(workspaceHeaders).send({ body: 'Viewer comment' }))

    expect((await owner.patch(`/api/v1/tasks/${taskId}`).set(workspaceHeaders).send({ title: 'Member update' })).status).toBe(200)
    expect((await owner.patch(`/api/v1/tasks/${taskId}/status`).set(workspaceHeaders).send({ status: 'progress' })).status).toBe(200)
    expect((await owner.post(`/api/v1/tasks/${taskId}/comments`).set(workspaceHeaders).send({ body: 'Member comment' })).status).toBe(201)

    const unauthenticated = request(app)
    const expectUnauthorized = async (response: Promise<any>) => expect((await response).status).toBe(401)
    await expectUnauthorized(unauthenticated.patch(`/api/v1/tasks/${taskId}`).set(workspaceHeaders).send({ title: 'Unauthenticated update' }))
    await expectUnauthorized(unauthenticated.patch(`/api/v1/tasks/${taskId}/status`).set(workspaceHeaders).send({ status: 'review' }))
    await expectUnauthorized(unauthenticated.delete(`/api/v1/tasks/${taskId}`).set(workspaceHeaders))
    await expectUnauthorized(unauthenticated.post(`/api/v1/tasks/${taskId}/comments`).set(workspaceHeaders).send({ body: 'Unauthenticated comment' }))

    expect((await outsider.patch(`/api/v1/tasks/${taskId}`).set({ 'x-workspace-id': ownerAccount.workspace }).send({ title: 'Cross-workspace update' })).status).toBe(403)
    expect((await outsider.patch(`/api/v1/tasks/${taskId}`).set({ 'x-workspace-id': outsiderAccount.workspace }).send({ title: 'Wrong workspace update' })).status).toBe(404)
    expect((await owner.delete(`/api/v1/tasks/${taskId}`).set(workspaceHeaders)).status).toBe(200)
  })
})
