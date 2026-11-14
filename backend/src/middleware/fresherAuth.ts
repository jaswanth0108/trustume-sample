import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface FresherRequest extends Request {
  candidate?: { candidate_id: string; email: string; full_name: string };
}

export const fresherAuthMiddleware = (
  req: FresherRequest,
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
      candidate_id: string;
      email: string;
      full_name: string;
    };
    if (!payload.candidate_id) {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }
    req.candidate = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
