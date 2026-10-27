import crypto from 'node:crypto'
import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { Session, User, WorkspaceMembership } from './models.js'
import { env } from './config/env.js'
import { HttpError } from './middleware.js'

export const COOKIE_NAME='teamflow_session'
export const hashToken=(token:string)=>crypto.createHash('sha256').update(`${token}.${env.SESSION_SECRET}`).digest('hex')
export const hashPassword=(password:string)=>bcrypt.hash(password,12)
export const verifyPassword=(password:string,hash:string)=>bcrypt.compare(password,hash)
export const sessionCookieOptionsFor = (config: Pick<typeof env, 'SESSION_COOKIE_SECURE' | 'SESSION_COOKIE_SAME_SITE'>) => ({ httpOnly:true, secure:config.SESSION_COOKIE_SECURE, sameSite:config.SESSION_COOKIE_SAME_SITE, path:'/' as const })
export const sessionCookieOptions = () => sessionCookieOptionsFor(env)
export async function createSession(userId:any,req:Request,res:Response){const token=crypto.randomBytes(48).toString('base64url'),expiresAt=new Date(Date.now()+env.SESSION_TTL_DAYS*86400000);await Session.create({userId,tokenHash:hashToken(token),expiresAt,userAgent:req.get('user-agent'),ip:req.ip});res.cookie(COOKIE_NAME,token,{...sessionCookieOptions(),expires:expiresAt});return expiresAt}
export async function revokeSession(req:Request,res:Response){const token=req.cookies?.[COOKIE_NAME];if(token)await Session.updateOne({tokenHash:hashToken(token),revokedAt:null},{$set:{revokedAt:new Date()}});res.clearCookie(COOKIE_NAME,sessionCookieOptions())}
export async function authenticate(req:Request){const token=req.cookies?.[COOKIE_NAME];if(!token)return null;const session=await Session.findOne({tokenHash:hashToken(token),revokedAt:null,expiresAt:{$gt:new Date()}});if(!session)return null;const user=await User.findById(session.userId).select('+passwordHash');if(!user)return null;return {user,session}}
export async function requireAuth(req:Request,_res:Response,next:any){try{const auth=await authenticate(req);if(!auth)return next(new HttpError(401,'Authentication required'));req.auth=auth;next()}catch(e){next(e)}}
export async function requireRole(req:Request,roles:Array<'owner'|'admin'|'member'>){if(!req.auth)throw new HttpError(401,'Authentication required');const workspaceId=req.header('x-workspace-id');if(!workspaceId)throw new HttpError(400,'x-workspace-id header is required');const membership=await WorkspaceMembership.findOne({workspaceId,userId:req.auth.user._id});if(!membership||!roles.includes(membership.role as any))throw new HttpError(403,'Insufficient workspace permissions');return membership}
