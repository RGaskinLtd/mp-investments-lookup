import { getMPsByParty } from '../utils/parliament';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const partyId = parseInt(String(query.partyId ?? '15'), 10);
  const partyName = String(query.partyName ?? 'Labour');
  const limit = Math.min(parseInt(String(query.limit ?? '10'), 10), 100);
  return getMPsByParty(partyId, partyName, limit);
});
