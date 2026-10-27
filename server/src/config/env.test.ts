import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.js'
import { sessionCookieOptionsFor } from '../auth.js'

const production = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb+srv://staging.example/teamflow',
  FRONTEND_ORIGIN: 'https://teamflow-staging.example.com',
  SOCKET_CORS_ORIGIN: 'https://teamflow-staging.example.com',
  SESSION_SECRET: 'a'.repeat(64),
  SESSION_COOKIE_SAME_SITE: 'none',
  SESSION_COOKIE_SECURE: 'true',
}

describe('production authentication configuration', () => {
  it('fails safely when production SESSION_SECRET is missing', () => {
    const { SESSION_SECRET: _secret, ...missingSecret } = production
    expect(() => parseEnv(missingSecret)).toThrow(/SESSION_SECRET/)
  })

  it('requires explicit HTTPS origins and cross-site cookie settings', () => {
    expect(() => parseEnv({ ...production, SESSION_COOKIE_SAME_SITE: 'lax' })).toThrow(/SESSION_COOKIE_SAME_SITE/)
    expect(() => parseEnv({ ...production, SESSION_COOKIE_SECURE: 'false' })).toThrow(/SESSION_COOKIE_SECURE/)
    expect(() => parseEnv({ ...production, FRONTEND_ORIGIN: 'http://localhost:5173', SOCKET_CORS_ORIGIN: 'http://localhost:5173' })).toThrow(/HTTPS/)
  })

  it('keeps local HTTP authentication compatible', () => {
    const local = parseEnv({ NODE_ENV: 'development', FRONTEND_ORIGIN: 'http://localhost:5173', SOCKET_CORS_ORIGIN: 'http://localhost:5173' })
    expect(local.SESSION_COOKIE_SAME_SITE).toBe('lax')
    expect(local.SESSION_COOKIE_SECURE).toBe(false)
  })

  it('uses secure cross-site attributes for production cookies', () => {
    const options = sessionCookieOptionsFor({ SESSION_COOKIE_SAME_SITE: 'none', SESSION_COOKIE_SECURE: true })
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'none', secure: true, path: '/' })
  })

  it('rejects wildcard or path-bearing credentialed origins', () => {
    expect(() => parseEnv({ ...production, FRONTEND_ORIGIN: 'https://example.com/app' })).toThrow(/FRONTEND_ORIGIN/)
    expect(() => parseEnv({ ...production, SOCKET_CORS_ORIGIN: 'https://example.com/app' })).toThrow(/SOCKET_CORS_ORIGIN/)
  })
})
