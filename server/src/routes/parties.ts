import { Router } from 'express';
import { getAllParties } from '../services/parliament';

export const partiesRouter = Router();

partiesRouter.get('/', async (_req, res) => {
  try {
    const parties = await getAllParties();
    res.json(parties);
  } catch {
    res.status(500).json({ error: 'Failed to fetch parties' });
  }
});
