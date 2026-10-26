import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { api } from './routes.js'
import { errorHandler, notFound } from './middleware.js'
export const app=express()
app.disable('x-powered-by'); app.use(helmet()); app.use(cors({origin:env.FRONTEND_ORIGIN,credentials:true})); app.use(cookieParser()); app.use(express.json({limit:'100kb'})); app.use(rateLimit({windowMs:60_000,limit:env.API_RATE_LIMIT,standardHeaders:'draft-7',legacyHeaders:false})); app.use('/api/v1',api); app.use(notFound); app.use(errorHandler)
