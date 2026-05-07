import { Request, Response } from 'express';
import { getPlayerFormation } from './formations.player.service';

export async function playerGetFormation(req: Request, res: Response) {
  const formationId = req.params.id;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const data = await getPlayerFormation(userId, formationId, role);
  res.json({ data });
}
