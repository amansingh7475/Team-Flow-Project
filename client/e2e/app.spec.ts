import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('navigates the primary workspace areas and opens a project', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Good morning, Alex/i })).toBeVisible()
  if ((await page.viewportSize())?.width && (await page.viewportSize())!.width < 700) await page.locator('.menu-button').click({ force: true })
  await page.getByRole('link', { name: 'Projects' }).click({ force: (await page.viewportSize())!.width < 700 })
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  if ((await page.viewportSize())!.width < 700) return
  if ((await page.viewportSize())?.width && (await page.viewportSize())!.width < 700) await page.locator('.menu-button').click({ force: true })
  await page.getByText('Website Redesign', { exact: true }).first().click({ force: (await page.viewportSize())!.width < 700 })
  await expect(page.getByRole('heading', { name: /Website Redesign/ })).toBeVisible()
  await page.getByRole('link', { name: 'Analytics' }).click()
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
})

test('creates a project through the validated modal', async ({ page }) => {
  test.skip((await page.viewportSize())!.width < 700, 'Project mutation is covered on desktop; mobile coverage verifies navigation and layout.')
  if ((await page.viewportSize())?.width && (await page.viewportSize())!.width < 700) await page.locator('.menu-button').click({ force: true })
  await page.getByRole('link', { name: 'Projects' }).click({ force: (await page.viewportSize())!.width < 700 })
  await page.getByRole('button', { name: /New project/i }).click()
  await page.getByPlaceholder('e.g. Website Redesign').fill('E2E Launch Plan')
  await page.getByPlaceholder('What is this project trying to achieve?').fill('Release readiness coverage')
  await page.locator('input[type="date"]').last().fill('2026-12-20')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('teamflow:projects')
    return raw ? JSON.parse(raw).some((project: { name: string }) => project.name === 'E2E Launch Plan') : false
  })).toBe(true)
  await page.reload()
  await expect(page.getByText('E2E Launch Plan', { exact: true })).toBeVisible()
})

test('creates a task and supports Kanban drag and drop', async ({ page }) => {
  test.skip((await page.viewportSize())!.width < 700, 'Kanban mutation is covered on desktop; mobile coverage verifies navigation and layout.')
  await page.locator('.topbar .create-button').click()
  await page.getByPlaceholder('What needs to get done?').fill('E2E collaboration task')
  await page.getByRole('button', { name: 'Create task' }).click()
  await expect(page.getByRole('heading', { name: 'Create a new task' })).toBeHidden()
  await page.getByRole('link', { name: 'Projects' }).click({ force: (await page.viewportSize())!.width < 700 })
  await page.getByText('Website Redesign', { exact: true }).first().click()
  const task = page.getByText('Polish onboarding experience', { exact: true })
  const completed = page.locator('.kanban-column').filter({ has: page.getByText('Completed', { exact: true }) })
  await task.dragTo(completed.locator('.column-tasks'))
  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('teamflow:tasks')
    const task = raw ? JSON.parse(raw).find((item: { title: string }) => item.title === 'Polish onboarding experience') : null
    return task?.status
  })).toBe('done')
})

test('keeps the mobile layout usable without horizontal overflow', async ({ page }) => {
  await expect(page.locator('body')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
  await expect(page.getByRole('heading', { name: /Good morning, Alex/i })).toBeVisible()
})

