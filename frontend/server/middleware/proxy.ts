// When API_INTERNAL_URL is set (Docker Compose local dev), proxy all /api/* requests
// to the Express backend. Otherwise Nitro's own server/api/ routes handle them.
export default defineEventHandler(async (event) => {
  const apiBase = process.env.API_INTERNAL_URL;
  if (!apiBase || !event.path.startsWith('/api/')) return;
  return proxyRequest(event, `${apiBase}${event.path}`);
});
