export async function connect() {
  const config = await fetch('/api/portfolio-config', {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!config.ok) throw new Error('Supabase todavía no está configurado.');
  const { url, key } = await config.json();

  async function request(path, { token, body, file, signal } = {}) {
    const response = await fetch(url + path, {
      method: file === undefined && body === undefined ? 'GET' : 'POST',
      cache: 'no-store',
      headers: {
        apikey: key,
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(file !== undefined && { 'Content-Type': file.type, 'x-upsert': 'false' }),
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(file !== undefined ? { body: file } : (body !== undefined && { body: JSON.stringify(body) })),
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
  }
  request.storageUrl = url + '/storage/v1';
  return request;
}
