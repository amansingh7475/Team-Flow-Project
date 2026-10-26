import { describe, expect, it } from 'vitest'
import { mapProject, mapTask } from './apiClient'

describe('API data mapping', () => {
  it('maps Mongo project fields to the existing project view model', () => {
    const project = mapProject({ _id: '507f1f77bcf86cd799439011', name: 'API project', code: 'API', dueDate: '2026-12-01T00:00:00.000Z', memberIds: ['u1'] })
    expect(project.id).toBe('507f1f77bcf86cd799439011')
    expect(project.due).toContain('Dec')
    expect(project.members).toEqual(['u1'])
  })

  it('maps Mongo task IDs and status fields without coercing IDs', () => {
    const task = mapTask({ _id: '507f1f77bcf86cd799439012', title: 'Ship API', projectId: 'p1', status: 'progress', priority: 'High' })
    expect(task.id).toBe('507f1f77bcf86cd799439012')
    expect(task.status).toBe('progress')
    expect(task.priority).toBe('High')
  })
})
