import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { InvitationPage } from './App'

const renderInvitation = (token = 'invalid-token-for-test') => render(<MemoryRouter initialEntries={[`/invitations/${token}`]}><Routes><Route path="/invitations/:token" element={<InvitationPage />} /></Routes></MemoryRouter>)
afterEach(() => cleanup())

describe('InvitationPage', () => {
  it('shows the invitation actions initially', () => {
    renderInvitation()
    expect(screen.getByRole('button', { name: /accept invitation/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
  })

  it('shows a clear API-mode error instead of pretending mock acceptance succeeded', async () => {
    renderInvitation()
    fireEvent.click(screen.getByRole('button', { name: /accept invitation/i }))
    await waitFor(() => expect(screen.getByText(/require API mode/i)).toBeInTheDocument())
  })
})
