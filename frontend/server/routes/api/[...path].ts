export default defineEventHandler((event) => {
  const path = getRouterParam(event, 'path') ?? '';
  const qs = getRequestURL(event).search; // preserves ?partyId=...&limit=... etc.
  const apiBase = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
  return proxyRequest(event, `${apiBase}/api/${path}${qs}`);
});
