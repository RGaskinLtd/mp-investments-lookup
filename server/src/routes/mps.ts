import { Router } from 'express';
import { getMPsByParty, getInterestsForMP } from '../services/parliament';

export const mpsRouter = Router();

mpsRouter.get('/', async (req, res) => {
  try {
    const partyId = parseInt((req.query.partyId as string) || '15', 10);
    const partyName = (req.query.partyName as string) || 'Labour';
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 100);
    const mps = await getMPsByParty(partyId, partyName, limit);
    res.json(mps);
  } catch {
    res.status(500).json({ error: 'Failed to fetch MPs' });
  }
});

mpsRouter.get('/:id/interests', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid MP id' });
      return;
    }
    const interests = await getInterestsForMP(id);
    res.json(interests);
  } catch {
    res.status(500).json({ error: 'Failed to fetch interests' });
  }
});
