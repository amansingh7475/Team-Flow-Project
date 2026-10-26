import type { Request } from 'express'
import mongoose from 'mongoose'
import { HttpError } from './middleware.js'
export const objectId=(value:string)=>{if(!mongoose.isValidObjectId(value))throw new HttpError(400,'Invalid id');return new mongoose.Types.ObjectId(value)}
export const scope=(req:Request)=>({workspaceId:objectId(String(req.header('x-workspace-id'))),userId:req.auth?.user?._id||objectId(String(req.header('x-user-id')))})
export const page=(req:Request)=>{const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||20));return {page,limit,skip:(page-1)*limit}}
export const ok=(res:any,data:any,status=200)=>res.status(status).json({success:true,data})
export const listResponse=(items:any,total:number,p:number,l:number)=>({items,page:p,limit:l,total,totalPages:Math.ceil(total/l)})
