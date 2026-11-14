import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  recruiter?: { recruiter_id: string; email: string; role: string };
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      recruiter_id: string;
      email: string;
      role?: string;
    };
    req.recruiter = {
      recruiter_id: payload.recruiter_id,
      email: payload.email,
      role: payload.role || 'recruiter',
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
