import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/teamflow'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  SOCKET_CORS_ORIGIN: z.string().url().optional(),
  API_RATE_LIMIT: z.coerce.number().int().positive().default(120),
  SESSION_SECRET: z.string().min(32).default('development-only-change-me-development-only'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  INVITATION_DELIVERY_URL: z.string().url().optional(),
})
export const env = schema.parse(process.env)
