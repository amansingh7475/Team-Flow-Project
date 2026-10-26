import { test, expect } from '@playwright/test'

const api = process.env.E2E_API_URL

test.describe('API-mode smoke coverage', () => {
  test.skip(!api, 'Set E2E_API_URL to a running API and disposable MongoDB-backed environment')

  test('registers, restores a session, creates a project, and rejects unauthenticated access', async ({ request }) => {
    const email = `e2e-${Date.now()}@teamflow.local`
    const agent = await request.newContext({ baseURL: api, extraHTTPHeaders: { 'content-type': 'application/json' } })
    const ready = await request.get(`${api}/health/ready`)
    expect(ready.status()).toBe(200)
    const register = await agent.post('/auth/register', { data: { name: 'E2E User', email, password: 'correct horse battery staple', workspaceName: 'E2E Workspace' } })
    expect(register.status()).toBe(201)
    const session = await agent.get('/auth/me')
    expect(session.status()).toBe(200)
    const workspace = (await session.json()).data.workspace.id
    const project = await agent.post('/projects', { headers: { 'x-workspace-id': workspace }, data: { name: 'E2E Project', code: 'E2E', description: 'API smoke test', dueDate: '2026-12-01' } })
    expect(project.status()).toBe(201)
    const projectId = (await project.json()).data.id
    const task = await agent.post('/tasks', { headers: { 'x-workspace-id': workspace }, data: { title: 'E2E task', projectId } })
    expect(task.status()).toBe(201)
    const taskId = (await task.json()).data.id
    expect((await agent.patch(`/tasks/${taskId}/status`, { headers: { 'x-workspace-id': workspace }, data: { status: 'progress' } })).status()).toBe(200)
    expect((await agent.post(`/tasks/${taskId}/comments`, { headers: { 'x-workspace-id': workspace }, data: { body: 'E2E comment' } })).status()).toBe(201)
    expect((await agent.get(`/tasks/${taskId}/comments`, { headers: { 'x-workspace-id': workspace } })).status()).toBe(200)
    expect((await agent.get('/activity', { headers: { 'x-workspace-id': workspace } })).status()).toBe(200)

    const other = await request.newContext({ baseURL: api, extraHTTPHeaders: { 'content-type': 'application/json' } })
    const otherEmail = `e2e-other-${Date.now()}@teamflow.local`
    expect((await other.post('/auth/register', { data: { name: 'E2E Other', email: otherEmail, password: 'correct horse battery staple', workspaceName: 'Other Workspace' } })).status()).toBe(201)
    expect((await other.get('/projects', { headers: { 'x-workspace-id': workspace } })).status()).toBe(403)
    const invitation = await agent.post('/workspace/invitations', { headers: { 'x-workspace-id': workspace }, data: { email: otherEmail, role: 'member' } })
    expect(invitation.status()).toBe(201)
    expect((await agent.get('/workspace', { headers: { 'x-workspace-id': workspace } })).status()).toBe(200)
    await other.dispose()
    await agent.dispose()
    const unauthenticated = await request.get(`${api}/projects`, { headers: { 'x-workspace-id': workspace } })
    expect(unauthenticated.status()).toBe(401)
  })
})
