// Only public Supabase configuration is allowed to leave this endpoint.
module.exports = function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';

  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url) || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    return response.status(503).json({ error: 'Supabase todavía no está configurado.' });
  }
  return response.status(200).json({ url: url.replace(/\/$/, ''), key });
};
