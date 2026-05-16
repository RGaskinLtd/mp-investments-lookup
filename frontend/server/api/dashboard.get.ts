import { getMPsByParty, getInterestsForMP } from '../utils/parliament';
import { searchCompany } from '../utils/companiesHouse';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const partyId = parseInt(String(query.partyId ?? '15'), 10);
  const partyName = String(query.partyName ?? 'Labour');
  const limit = Math.min(parseInt(String(query.limit ?? '10'), 10), 100);

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

  return {
    party: partyName,
    mps: mpData,
    generatedAt: new Date().toISOString(),
  };
});
