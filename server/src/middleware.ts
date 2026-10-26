import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import mongoose from 'mongoose'
import { authenticate } from './auth.js'
import { WorkspaceMembership } from './models.js'

export class HttpError extends Error { constructor(public status:number, message:string, public details?:unknown){super(message)} }
export const requireScope: RequestHandler = async (req,_res,next) => { try { const auth=await authenticate(req); if(!auth)return next(new HttpError(401,'Authentication required')); req.auth=auth; if(req.path.startsWith('/invitations/'))return next(); const workspaceId=req.header('x-workspace-id'); if(!workspaceId)return next(new HttpError(400,'x-workspace-id header is required')); const membership=await WorkspaceMembership.findOne({workspaceId,userId:auth.user._id}); if(!membership)return next(new HttpError(403,'You are not a member of this workspace')); (req as any).workspaceRole=membership.role; next() } catch(error){next(error)} }
export const authorize=(...roles:string[]):RequestHandler=>(req,_res,next)=>roles.includes((req as any).workspaceRole)?next():next(new HttpError(403,'Insufficient workspace permissions'))
export const validate = (schema:{body?:any;query?:any;params?:any}):RequestHandler => (req,_res,next)=>{try{if(schema.body)req.body=schema.body.parse(req.body);if(schema.query)req.query=schema.query.parse(req.query);if(schema.params)req.params=schema.params.parse(req.params);next()}catch(error){next(error)}}
export const notFound:RequestHandler = (req,_res,next)=>next(new HttpError(404,`Route not found: ${req.method} ${req.path}`))
export const errorHandler:ErrorRequestHandler=(error,req,res,_next)=>{const status=error instanceof HttpError?error.status:error instanceof ZodError?400:error instanceof mongoose.Error.ValidationError?400:500;const message=error instanceof ZodError?'Request validation failed':error instanceof Error?error.message:'Internal server error';res.status(status).json({success:false,error:{message,details:error instanceof ZodError?error.flatten():undefined},requestId:req.header('x-request-id')||undefined})}
