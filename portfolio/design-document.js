import { pages } from './pages.js';
import { emptyGallery, validateGallery } from './gallery-document.js';

// Shared document format for the editor, backups and published designs.
export const bounds = {
  x: [-4000, 4000],
  y: [-4000, 4000],
  size: [4, 400],
  width: [10, 4000],
  height: [60, 900],
  spacing: [-8, 40],
  layer: [1, 50],
};

export const fonts = {
  system: 'system-ui, sans-serif',
  helvetica: 'Helvetica, Arial, sans-serif',
  georgia: 'Georgia, serif',
  times: '"Times New Roman", serif',
  courier: '"Courier New", monospace',
};

const alignments = ['left', 'center', 'right', 'justify'];
const isRecord = (object) => object && typeof object === 'object' && !Array.isArray(object);

export function emptyDraft(page = 'home') {
  return {
    version: 1, page, desktop: {}, mobile: {}, content: {}, elements: {},
    ...(page === 'nuptias' && { gallery: emptyGallery() }),
  };
}

export function validateDraft(value, page = value?.page) {
  if (!isRecord(value) || value.version !== 1 || value.page !== page || !Object.hasOwn(pages, page)) {
    throw new Error('La copia no corresponde a esta página.');
  }

  const draft = emptyDraft(page);
  for (const view of ['desktop', 'mobile', 'content']) {
    if (!isRecord(value[view])) throw new Error('La copia está incompleta.');
    for (const [id, settings] of Object.entries(value[view])) {
      if (!/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(id) || !isRecord(settings)) {
        throw new Error('La copia contiene un ajuste inválido.');
      }
      const clean = {};
      for (const [field, setting] of Object.entries(settings)) {
        const range = Object.hasOwn(bounds, field) ? bounds[field] : null;
        const valid = view === 'content'
          ? field === 'text' && typeof setting === 'string' && setting.length <= 2000
          : (range && Number.isInteger(setting) && setting >= range[0] && setting <= range[1])
            || (field === 'font' && typeof setting === 'string' && Object.hasOwn(fonts, setting))
            || (field === 'align' && alignments.includes(setting))
            || (field === 'color' && typeof setting === 'string' && /^#[0-9a-f]{6}$/i.test(setting));
        if (!valid) throw new Error('La copia contiene un valor inválido.');
        clean[field] = setting;
      }
      if (Object.keys(clean).length) draft[view][id] = clean;
    }
  }
  if (page === 'nuptias' && value.gallery !== undefined) draft.gallery = validateGallery(value.gallery);
  if (value.elements !== undefined) {
    if (!isRecord(value.elements) || Object.keys(value.elements).length > 1000) {
      throw new Error('La copia contiene elementos inválidos.');
    }
    for (const [id, settings] of Object.entries(value.elements)) {
      if (!/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(id) || !isRecord(settings)) {
        throw new Error('La copia contiene un elemento inválido.');
      }
      if (id.startsWith('custom.') && settings.type === 'text') draft.elements[id] = { type: 'text' };
      else if (settings.hidden === true && !id.startsWith('custom.')) draft.elements[id] = { hidden: true };
      else throw new Error('La copia contiene un elemento inválido.');
    }
  }
  return draft;
}
