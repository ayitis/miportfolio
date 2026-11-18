export async function connect() {
  const config = await fetch('/api/portfolio-config', {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!config.ok) throw new Error('Supabase todavía no está configurado.');
  const { url, key } = await config.json();

  return async function request(path, { token, body, signal } = {}) {
    const response = await fetch(url + path, {
      method: body === undefined ? 'GET' : 'POST',
      cache: 'no-store',
      headers: {
        apikey: key,
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: signal ?? AbortSignal.timeout(10000),
    });
    const result = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      const error = new Error('La solicitud a Supabase no se pudo completar.');
      error.status = response.status;
      error.code = result?.code;
      throw error;
    }
    return result;
  };
}
