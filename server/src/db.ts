import mongoose from 'mongoose'
import { env } from './config/env.js'
export async function connectDatabase(uri = env.MONGODB_URI) { await mongoose.connect(uri) }
export async function disconnectDatabase() { await mongoose.disconnect() }
export function databaseReady() { return mongoose.connection.readyState === 1 }
