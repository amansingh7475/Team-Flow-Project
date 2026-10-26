declare global { namespace Express { interface Request { auth?: { user:any; session:any } } } }
export {}
