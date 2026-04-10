import { Request, Response } from 'express';
import * as service from './formateur.service';

export async function listSessions(_req: Request, res: Response) {
  const sessions = await service.listSessions();
  res.json({ data: sessions });
}

export async function listApprenants(req: Request, res: Response) {
  const data = await service.listApprenants(req.params.formationId);
  res.json({ data });
}

export async function getApprenantDetail(req: Request, res: Response) {
  const data = await service.getApprenantDetail(req.params.formationId, req.params.userId);
  res.json({ data });
}

export async function getSessionStats(req: Request, res: Response) {
  const data = await service.getSessionStats(req.params.formationId);
  res.json({ data });
}
