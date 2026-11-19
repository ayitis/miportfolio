export const galleryBucket = 'portfolio-nuptias';
export const uploadTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
export const maxPhotoBytes = 10 * 1024 * 1024;
export const maxUploads = 100;
export const photoBounds = { width: [80, 900], height: [80, 600], x: [0, 100], y: [0, 100] };
const objectId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.(jpg|png|webp|avif)$/;
const repoId = /^repo:[^/\\\u0000-\u001f]{1,240}$/u;
const modes = ['hidden', 'removed'];
const record = value => value && typeof value === 'object' && !Array.isArray(value);

export function emptyGallery() {
  return { order: [], uploads: {}, photos: {} };
}

export function uploadPath(id) {
  return id.startsWith('upload:') && objectId.test(id.slice(7)) ? id.slice(7) : null;
}

export function visiblePhoto(gallery, id) {
  return !gallery.photos[id]?.state;
}

export function validateGallery(gallery) {
  const fail = () => { throw new Error('La copia contiene ajustes de fotografía inválidos.'); };
  if (!record(gallery) || !Array.isArray(gallery.order) ||
      !record(gallery.uploads) || !record(gallery.photos) ||
      gallery.order.length > 1000 || Object.keys(gallery.uploads).length > maxUploads ||
      Object.keys(gallery.photos).length > 1000) fail();

  const result = emptyGallery();
  for (const [id, value] of Object.entries(gallery.uploads)) {
    if (!uploadPath(id) || !record(value) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 180) fail();
    result.uploads[id] = { name: value.name };
  }
  const knownId = id => typeof id === 'string' && (repoId.test(id) || Object.hasOwn(result.uploads, id));
  if (!gallery.order.every(knownId)) fail();
  result.order = [...new Set(gallery.order)];

  for (const [id, value] of Object.entries(gallery.photos)) {
    if (!knownId(id) || !record(value)) fail();
    const settings = {};
    for (const [key, setting] of Object.entries(value)) {
      if (key === 'state' && modes.includes(setting)) settings.state = setting;
      else if ((key === 'desktop' || key === 'mobile') && record(setting)) {
        const view = {};
        for (const [field, number] of Object.entries(setting)) {
          const range = Object.hasOwn(photoBounds, field) ? photoBounds[field] : null;
          if (!range || !Number.isInteger(number) || number < range[0] || number > range[1]) fail();
          view[field] = number;
        }
        if (Object.keys(view).length) settings[key] = view;
      } else fail();
    }
    if (Object.keys(settings).length) result.photos[id] = settings;
  }
  return result;
}
