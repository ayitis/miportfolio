// Shared document format for the editor, backups and published designs.
export const bounds = {
  x: [-4000, 4000],
  y: [-4000, 4000],
  size: [4, 400],
  width: [10, 4000],
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

export function emptyDraft() {
  return { version: 1, page: 'home', desktop: {}, mobile: {}, content: {} };
}

export function validateDraft(value) {
  if (!isRecord(value) || value.version !== 1 || value.page !== 'home') {
    throw new Error('La copia no corresponde al editor de portada.');
  }

  const draft = emptyDraft();
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
            || (field === 'align' && alignments.includes(setting));
        if (!valid) throw new Error('La copia contiene un valor inválido.');
        clean[field] = setting;
      }
      if (Object.keys(clean).length) draft[view][id] = clean;
    }
  }
  return draft;
}
