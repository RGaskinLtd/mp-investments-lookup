import { getAllParties } from '../utils/parliament';

export default defineEventHandler(async () => {
  return getAllParties();
});
