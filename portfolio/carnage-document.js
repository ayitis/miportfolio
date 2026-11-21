export const carnagePage = 'maison-carnage';
const photoId = id => typeof id === 'string' && /^\d{2,6}$/.test(id);
const record = value => value && typeof value === 'object' && !Array.isArray(value);
export const carnageBounds = {
  x: [-4000, 4000], y: [-4000, 4000],
  width: [16, 4000], height: [16, 4000],
  cropX: [0, 100], cropY: [0, 100], layer: [1, 50],
};
export const emptyCarnage = () => ({ desktop: {}, mobile: {} });

export function validateCarnage(value) {
  const result = emptyCarnage();
  const invalid = () => { throw new Error('La copia contiene ajustes de fotografías de Maison Carnage inválidos.'); };
  if (!record(value)) invalid();
  for (const view of Object.keys(result)) {
    const entry = value[view];
    if (entry === undefined) continue;
    if (!record(entry)) invalid();
    const clean = result[view];
    if (entry.cover !== undefined) {
      if (!photoId(entry.cover)) invalid();
      clean.cover = entry.cover;
    }
    if (entry.order !== undefined) {
      if (!Array.isArray(entry.order) || entry.order.length > 200 || !entry.order.every(photoId) ||
          new Set(entry.order).size !== entry.order.length) invalid();
      clean.order = [...entry.order];
    }
    if (entry.photos === undefined) continue;
    if (!record(entry.photos) || Object.keys(entry.photos).length > 200) invalid();
    clean.photos = {};
    for (const [id, settings] of Object.entries(entry.photos)) {
      if (!photoId(id) || !record(settings)) invalid();
      clean.photos[id] = {};
      for (const [key, value] of Object.entries(settings)) {
        const range = Object.hasOwn(carnageBounds, key) && carnageBounds[key];
        if ((range && Number.isInteger(value) && value >= range[0] && value <= range[1]) ||
            (key === 'visibility' && ['hidden', 'removed'].includes(value)) ||
            (key === 'lockRatio' && value === true)) {
          clean.photos[id][key] = value;
        } else invalid();
      }
    }
  }
  return result;
}

export function carnageOrder(ids, settings) {
  const known = new Set(ids);
  const saved = (settings.order ?? []).filter(id => known.has(id));
  const ordered = new Set(saved);
  return [...saved, ...ids.filter(id => !ordered.has(id))];
}
