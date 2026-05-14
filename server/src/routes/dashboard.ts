import { Router } from 'express';
import { getMPsByParty, getInterestsForMP } from '../services/parliament';
import { searchCompany } from '../services/companiesHouse';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  try {
    const partyId = parseInt((req.query.partyId as string) || '15', 10);
    const partyName = (req.query.partyName as string) || 'Labour';
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 100);

    const mps = await getMPsByParty(partyId, partyName, limit);

    const mpData = await Promise.all(
      mps.map(async (mp) => {
        const interests = await getInterestsForMP(mp.parliamentId);

        const enrichedInterests = await Promise.all(
          interests.map(async (interest) => {
            if (!interest.companyName) return { ...interest, company: null };
            const company = await searchCompany(interest.companyName);
            return { ...interest, company };
          })
        );

        const totalAmount = enrichedInterests.reduce((sum, i) => sum + (i.amountGbp ?? 0), 0);

        return {
          ...mp,
          interests: enrichedInterests,
          totalAmount,
          interestCount: enrichedInterests.length,
        };
      })
    );

    mpData.sort((a, b) => b.totalAmount - a.totalAmount);

    res.json({
      party: partyName,
      mps: mpData,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate dashboard data' });
  }
});
