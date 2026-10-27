import { describe, expect, it, vi } from 'vitest'
import { errorHandler, validate } from './middleware.js'
import { projectBody, taskBody } from './routes.js'

describe('request collection validation', () => {
  it('accepts valid project and task collections within the documented limits', () => {
    const project = projectBody.parse({
      name: 'A valid project',
      code: 'VALID',
      memberIds: Array.from({ length: 100 }, (_, index) => `member-${index}`),
    })
    const task = taskBody.parse({
      title: 'A valid task',
      projectId: 'project-id',
      labels: Array.from({ length: 20 }, (_, index) => `label-${index}`),
    })

    expect(project.memberIds).toHaveLength(100)
    expect(task.labels).toHaveLength(20)
  })

  it('rejects oversized member and label collections before application work', () => {
    expect(() => projectBody.parse({
      name: 'Too many members',
      code: 'MANY',
      memberIds: Array.from({ length: 101 }, (_, index) => `member-${index}`),
    })).toThrow()

    expect(() => taskBody.parse({
      title: 'Too many labels',
      projectId: 'project-id',
      labels: Array.from({ length: 21 }, (_, index) => `label-${index}`),
    })).toThrow()
  })

  it('rejects oversized individual collection entries', () => {
    expect(() => projectBody.parse({
      name: 'Long member id',
      code: 'LONG',
      memberIds: ['m'.repeat(129)],
    })).toThrow()

    expect(() => taskBody.parse({
      title: 'Long label',
      projectId: 'project-id',
      labels: ['l'.repeat(51)],
    })).toThrow()
  })

  it('preserves the existing validation error response shape', () => {
    const req = { body: { code: 'X' }, header: () => undefined } as any
    const next = vi.fn()
    validate({ body: projectBody })(req, {} as any, next)

    let status = 200
    let payload: any
    const res = {
      status(code: number) { status = code; return this },
      json(body: any) { payload = body; return this },
    } as any
    errorHandler(next.mock.calls[0][0], req, res, vi.fn())

    expect(status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error.message).toBe('Request validation failed')
    expect(payload.error.details.fieldErrors).toHaveProperty('name')
  })
})
