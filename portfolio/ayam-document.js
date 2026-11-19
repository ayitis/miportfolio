export const ayamPage = 'ayam';
export const ayamFilm = 'film';
export const ayamGeometry = {
  x: [-4000, 4000], y: [-4000, 4000], width: [16, 4000], height: [16, 4000],
  cropX: [0, 100], cropY: [0, 100], zoom: [100, 300], layer: [1, 50],
};
export const emptyAyam = () => ({ assets: {}, desktop: {}, mobile: {} });
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const photoId = id => /^photo-(?:\d{2}|[a-f0-9-]{36})$/.test(id);

export function mediaPath(value, video = false) {
  if (typeof value !== 'string' || !value || value.length > 2000 || /[\\\x00-\x1f]/.test(value)) return false;
  if (!value.startsWith('https://') && !/^\/[^/]/.test(value)) return false;
  try {
    const url = new URL(value, 'https://portfolio.invalid');
    if (url.username || url.password) return false;
    return (video ? /\.(mp4|webm|mov|m4v)$/i : /\.(jpg|jpeg|png|webp|avif|gif)$/i).test(url.pathname);
  } catch { return false; }
}

export function validateAyam(value) {
  const draft = emptyAyam();
  const invalid = () => { throw new Error('La copia contiene ajustes de AYAM inválidos.'); };
  if (!record(value) || !record(value.assets) || Object.keys(value.assets).length > 150) invalid();
  for (const [id, path] of Object.entries(value.assets)) {
    if (!photoId(id) || !mediaPath(path)) invalid();
    draft.assets[id] = path;
  }
  for (const view of ['desktop', 'mobile']) {
    const layout = value[view];
    if (!record(layout)) invalid();
    if (layout.order !== undefined) {
      if (!Array.isArray(layout.order) || layout.order.length > 200 || !layout.order.every(photoId) ||
          new Set(layout.order).size !== layout.order.length) invalid();
      draft[view].order = [...layout.order];
    }
    const items = layout.media ?? {};
    if (!record(items) || Object.keys(items).length > 200) invalid();
    draft[view].media = {};
    for (const [id, settings] of Object.entries(items)) {
      if (!(id === ayamFilm || photoId(id)) || !record(settings)) invalid();
      const clean = {};
      for (const [key, setting] of Object.entries(settings)) {
        const range = Object.hasOwn(ayamGeometry, key) && ayamGeometry[key];
        const valid = (range && Number.isInteger(setting) && setting >= range[0] && setting <= range[1]) ||
          (key === 'source' && mediaPath(setting, id === ayamFilm)) ||
          (key === 'fit' && ['cover', 'contain'].includes(setting)) ||
          (key === 'locked' && setting === true) ||
          (id !== ayamFilm && key === 'visibility' && ['hidden', 'removed'].includes(setting)) ||
          (id === ayamFilm && key === 'poster' && mediaPath(setting)) ||
          (id === ayamFilm && ['start', 'end'].includes(key) && Number.isFinite(setting) && setting >= 0 && setting <= 86400);
        if (!valid) invalid();
        clean[key] = setting;
      }
      if (id === ayamFilm && clean.end !== undefined && clean.end <= (clean.start ?? 0)) invalid();
      if (Object.keys(clean).length) draft[view].media[id] = clean;
    }
  }
  return draft;
}

export function ayamOrder(ids, saved = []) {
  const known = new Set(ids);
  const ordered = saved.filter(id => known.delete(id));
  return [...ordered, ...known];
}
