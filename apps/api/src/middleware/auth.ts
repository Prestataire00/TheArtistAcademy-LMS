import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../shared/errors';
import { UserRole } from '@prisma/client';

export interface AuthPayload {
  userId: string;
  role: UserRole;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  // Authorization header > cookie : un header est explicitement envoyé pour
  // CETTE requête (ex : Bearer apprenant SSO), alors qu'un cookie peut être
  // un résidu de session précédente (ex : cookie admin du même navigateur).
  // Prendre le cookie en priorité provoque des "pas d'inscription active"
  // quand un admin tente d'ouvrir un lien apprenant SSO dans la même session.
  const headerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const token = headerToken || req.cookies?.token;

  if (!token) throw new UnauthorizedError('Token manquant');

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    throw new UnauthorizedError('Token invalide ou expiré');
  }
}
