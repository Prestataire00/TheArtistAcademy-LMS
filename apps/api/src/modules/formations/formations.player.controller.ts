import { Request, Response } from 'express';
import { getPlayerFormation } from './formations.player.service';

export async function playerGetFormation(req: Request, res: Response) {
  const formationId = req.params.id;
  const userId = req.user!.userId;
  const data = await getPlayerFormation(userId, formationId);
  res.json({ data });
}
