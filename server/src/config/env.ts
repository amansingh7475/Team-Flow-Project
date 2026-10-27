import 'dotenv/config'
import { z } from 'zod'

const DEVELOPMENT_SESSION_SECRET = 'development-only-change-me-development-only'

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/teamflow'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173').refine(value => !value.endsWith('/'), 'FRONTEND_ORIGIN must not end with a slash or contain a path'),
  SOCKET_CORS_ORIGIN: z.string().url().optional(),
  API_RATE_LIMIT: z.coerce.number().int().positive().default(120),
  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  INVITATION_DELIVERY_URL: z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().url().optional()
),
  SESSION_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  SESSION_COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
}).superRefine((value, ctx) => {
  const frontend = new URL(value.FRONTEND_ORIGIN)
  const socketOrigin = value.SOCKET_CORS_ORIGIN ? new URL(value.SOCKET_CORS_ORIGIN) : undefined
  const isProduction = value.NODE_ENV === 'production'
  const isLocalOrigin = frontend.hostname === 'localhost' || frontend.hostname === '127.0.0.1'

  if (frontend.pathname !== '/' || frontend.search || frontend.hash) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['FRONTEND_ORIGIN'], message: 'FRONTEND_ORIGIN must contain only a scheme, host, and optional port' })
  }
  if (socketOrigin && (socketOrigin.pathname !== '/' || socketOrigin.search || socketOrigin.hash)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SOCKET_CORS_ORIGIN'], message: 'SOCKET_CORS_ORIGIN must contain only a scheme, host, and optional port' })
  }
  if (isProduction) {
    if (!value.SESSION_SECRET || value.SESSION_SECRET === DEVELOPMENT_SESSION_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SESSION_SECRET'], message: 'SESSION_SECRET must be explicitly set in production' })
    }
    if (frontend.protocol !== 'https:' || isLocalOrigin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['FRONTEND_ORIGIN'], message: 'Production FRONTEND_ORIGIN must be an HTTPS origin' })
    }
    if (!socketOrigin || socketOrigin.protocol !== 'https:') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SOCKET_CORS_ORIGIN'], message: 'Production SOCKET_CORS_ORIGIN must be an explicit HTTPS origin' })
    }
    if (value.SESSION_COOKIE_SAME_SITE !== 'none') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SESSION_COOKIE_SAME_SITE'], message: 'Production cross-site sessions require SESSION_COOKIE_SAME_SITE=none' })
    }
    if (!value.SESSION_COOKIE_SECURE) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SESSION_COOKIE_SECURE'], message: 'Production sessions require SESSION_COOKIE_SECURE=true' })
    }
  }
})

export function parseEnv(input: NodeJS.ProcessEnv) {
  const parsed = schema.parse(input)
  return { ...parsed, SESSION_SECRET: parsed.SESSION_SECRET ?? DEVELOPMENT_SESSION_SECRET }
}

export const env = parseEnv(process.env)
