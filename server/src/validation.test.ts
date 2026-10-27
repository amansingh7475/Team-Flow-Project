import { describe, expect, it, vi } from 'vitest'
import { errorHandler, validate } from './middleware.js'
import { projectBody, projectPatch, taskBody, taskPatch } from './routes.js'

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

  it('keeps omitted PATCH fields absent while accepting explicit updates', () => {
    const project = projectPatch.parse({ name: 'Renamed project' })
    const task = taskPatch.parse({ title: 'Updated task' })
    expect(project).toEqual({ name: 'Renamed project' })
    expect(task).toEqual({ title: 'Updated task' })

    expect(taskPatch.parse({ status: 'done', priority: 'High', labels: ['release'], description: 'Updated description', order: 3 })).toEqual({
      status: 'done', priority: 'High', labels: ['release'], description: 'Updated description', order: 3,
    })
    expect(projectPatch.parse({ description: 'Updated description', state: 'At risk', memberIds: ['member-1'] })).toEqual({
      description: 'Updated description', state: 'At risk', memberIds: ['member-1'],
    })
  })

  it('requires task order to be a finite safe integer', () => {
    expect(taskPatch.parse({ order: 0 }).order).toBe(0)
    expect(() => taskPatch.parse({ order: 1.5 })).toThrow()
    expect(() => taskPatch.parse({ order: Number.POSITIVE_INFINITY })).toThrow()
  })

  it('rejects invalid explicit PATCH values and oversized collections', () => {
    expect(() => taskPatch.parse({ priority: 'Urgent' })).toThrow()
    expect(() => taskPatch.parse({ labels: Array.from({ length: 21 }, (_, index) => `label-${index}`) })).toThrow()
    expect(() => projectPatch.parse({ memberIds: Array.from({ length: 101 }, (_, index) => `member-${index}`) })).toThrow()
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
