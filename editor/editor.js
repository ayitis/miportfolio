import { bounds, emptyDraft, validateDraft } from '../portfolio/design-document.js';
import { applyElement, collectElements, targets } from '../portfolio/home-design.js';
import { openEditor } from './storage.js';

const find = (id) => document.getElementById(id);
const preview = find('preview');
const element = find('element');
const status = find('status');
const fields = [...document.querySelectorAll('[data-field]')];
const viewButtons = [...document.querySelectorAll('[data-view]')];
let editable = new Map();
let draft = emptyDraft();
let view = 'desktop';
let selected = '';
let drag = null;
let dirty = false;
let store;
let revision = null;

const workspace = find('workspace');
const access = find('access');
const accessStatus = find('access-status');
const login = find('login');
const history = find('history');
const older = find('older');
const restore = find('restore');

function markDirty() {
  dirty = true;
  status.textContent = 'Cambios pendientes de guardar.';
}

function apply(id) {
  applyElement(editable, id, draft, view);
}

function updateFields() {
  const overrides = draft[view][selected] ?? {};
  const original = editable.get(selected)?.[0];
  find('properties').disabled = !original;
  for (const input of fields) {
    const key = input.dataset.field;
    if (key === 'text') {
      input.value = draft.content[selected]?.text ?? original?.text ?? '';
    } else {
      input.value = overrides[key] ?? '';
    }
  }
}

function select(id, reveal = false) {
  for (const { node } of editable.get(selected) ?? []) node.removeAttribute('data-editor-selected');
  selected = id;
  for (const { node } of editable.get(selected) ?? []) node.setAttribute('data-editor-selected', '');
  element.value = id;
  updateFields();

  const node = editable.get(id)?.[0]?.node;
  if (reveal && node) {
    // Scrolling a carousel item into view would shift the looping track.
    const anchor = node.closest('.marquee') ?? node;
    const { top, bottom } = anchor.getBoundingClientRect();
    const frame = preview.contentWindow;
    if (bottom <= 0 || top >= frame.innerHeight) frame.scrollBy(0, top - 24);
  }
}

function updateSetting(section, key, value) {
  const settings = draft[section][selected] ??= {};
  if (value === undefined) delete settings[key];
  else settings[key] = value;
  if (Object.keys(settings).length === 0) delete draft[section][selected];
}

function applyView(next) {
  drag = null;
  view = next;
  preview.classList.toggle('mobile', next === 'mobile');
  for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  for (const id of editable.keys()) apply(id);
  updateFields();
}

function attach() {
  const page = preview.contentDocument;
  const style = page.createElement('style');
  style.textContent = `
    [data-editor-text] { pointer-events: auto; cursor: move; user-select: none; touch-action: none; }
    [data-editor-text]:hover { outline: 1px dashed #9661e8; }
    [data-editor-selected] { outline: 2px solid #9661e8 !important; outline-offset: 2px; }
  `;
  page.head.append(style);

  editable = collectElements(page);
  for (const [id, label] of targets) {
    const originals = editable.get(id);
    if (!originals) continue;
    for (const { node } of originals) node.dataset.editorText = id;
    element.add(new Option(label, id));
  }

  page.addEventListener('click', (event) => {
    if (event.target.closest('a')) event.preventDefault();
  }, true);

  page.addEventListener('pointerdown', (event) => {
    const node = event.target.closest('[data-editor-text]');
    if (!node || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    select(node.dataset.editorText);
    const offsets = draft[view][selected] ?? {};
    drag = {
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: offsets.x ?? 0,
      y: offsets.y ?? 0,
      moved: false,
    };
    node.setPointerCapture(event.pointerId);
  }, true);

  page.addEventListener('pointermove', (event) => {
    if (drag?.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    for (const [key, delta] of [['x', dx], ['y', dy]]) {
      const [min, max] = bounds[key];
      updateSetting(view, key, Math.max(min, Math.min(max, Math.round(drag[key] + delta))));
    }
    apply(selected);
    updateFields();
    markDirty();
  });

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    page.addEventListener(type, (event) => {
      if (drag?.pointer === event.pointerId) drag = null;
    }, true);
  }
}

element.addEventListener('change', () => select(element.value, true));
for (const button of viewButtons) button.addEventListener('click', () => applyView(button.dataset.view));
for (const input of fields) {
  input.addEventListener('input', () => {
    if (!selected || !input.validity.valid) return;
    const key = input.dataset.field;
    if (key === 'text') {
      const original = editable.get(selected)[0].text;
      updateSetting('content', key, input.value === original ? undefined : input.value);
    }
    else if (input.type === 'number') updateSetting(view, key, input.value === '' ? undefined : input.valueAsNumber);
    else updateSetting(view, key, input.value || undefined);
    apply(selected);
    markDirty();
  });
  input.addEventListener('blur', () => {
    if (!input.validity.valid) updateFields();
  });
}

find('reset').addEventListener('click', () => {
  delete draft[view][selected];
  delete draft.content[selected];
  apply(selected);
  updateFields();
  markDirty();
});

function runAction(action) {
  return async () => {
    if (workspace.inert) return;
    workspace.inert = true;
    try {
      await action();
    } catch (error) {
      status.textContent = error.code === '40001'
        ? 'Hay un borrador más reciente. Descarga una copia de tus cambios y recarga el editor.'
        : error.message;
    } finally {
      workspace.inert = false;
    }
  };
}

async function save(publish) {
  if (publish && !window.confirm('¿Quieres mostrar estos cambios a los visitantes del sitio conectado?')) return;
  revision = await store.save(draft, revision, publish);
  dirty = false;
  status.textContent = publish ? 'Cambios publicados.' : 'Borrador guardado de forma privada.';
  // A history read failure must not present a successful write as failed.
  await loadHistory().catch(() => {
    status.textContent += ' El historial no se pudo actualizar. Puedes volver a abrirlo.';
  });
}

async function loadHistory(before) {
  const entries = await store.history(before);
  const selectedRevision = history.value;
  if (before === undefined) history.options.length = 1;
  for (const entry of entries) {
    const date = new Date(entry.created_at).toLocaleString('es-ES');
    history.add(new Option(`${entry.published ? 'Publicación' : 'Borrador'} · ${date} · #${entry.revision}`, entry.revision));
  }
  history.value = selectedRevision;
  if (history.selectedIndex === -1) history.value = '';
  restore.disabled = !history.value;
  older.hidden = entries.length < 20;
}

find('save').addEventListener('click', runAction(() => save(false)));
find('publish').addEventListener('click', runAction(() => save(true)));
history.closest('details').addEventListener('toggle', () => {
  if (history.closest('details').open) runAction(() => loadHistory())();
});
history.addEventListener('change', () => { restore.disabled = !history.value; });
older.addEventListener('click', runAction(() => loadHistory(history.options[history.options.length - 1].value)));
restore.addEventListener('click', runAction(async () => {
  if (!history.value || (dirty && !window.confirm('¿Quieres sustituir los cambios pendientes por esta versión?'))) return;
  draft = await store.restore(history.value);
  applyView(view);
  markDirty();
  status.textContent = 'Versión cargada. Puedes guardarla como borrador o publicarla.';
}));

find('logout').addEventListener('click', runAction(async () => {
  if (dirty && !window.confirm('¿Cerrar sesión sin guardar los cambios pendientes?')) return;
  await store.signOut().catch(() => {});
  location.reload();
}));

find('export').addEventListener('click', () => {
  const file = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'miportfolio-portada.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

find('import').addEventListener('change', async (event) => {
  const input = event.currentTarget;
  const file = input.files[0];
  if (!file) return;
  try {
    if (file.size > 1_000_000) throw new Error('La copia supera el tamaño permitido.');
    const imported = validateDraft(JSON.parse(await file.text()));
    if (dirty && !window.confirm('¿Quieres sustituir los cambios pendientes por esta copia?')) return;
    draft = imported;
    applyView(view);
    markDirty();
    status.textContent = 'Copia importada. Pulsa Guardar borrador para conservarla.';
  } catch (error) {
    status.textContent = error instanceof SyntaxError ? 'El archivo no contiene una copia válida.' : error.message;
  } finally {
    input.value = '';
  }
});

function initializePreview() {
  if (preview.contentDocument.URL === 'about:blank') return;
  preview.removeEventListener('load', initializePreview);
  attach();
  applyView(view);
  status.textContent = 'Los cambios se muestran a los visitantes al pulsar Publicar cambios.';
  for (const id of ['element', 'save', 'publish', 'export', 'import']) find(id).disabled = false;
}

async function enterWorkspace() {
  ({ draft, revision } = await store.load());
  access.hidden = true;
  workspace.hidden = false;
  preview.addEventListener('load', initializePreview);
  preview.src = '/index.html?editor-preview=1';
}

login.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = login.querySelector('button');
  if (button.disabled) return;
  button.disabled = true;
  accessStatus.textContent = 'Comprobando el acceso…';
  const credentials = new FormData(login);
  try {
    await store.signIn(credentials.get('email'), credentials.get('password'));
    await enterWorkspace();
  } catch (error) {
    accessStatus.textContent = error.message;
  } finally {
    login.elements.password.value = '';
    button.disabled = false;
  }
});

async function initialize() {
  try {
    store = await openEditor();
    if (store.signedIn) await enterWorkspace();
    else accessStatus.textContent = 'Inicia sesión con la cuenta autorizada.';
  } catch (error) {
    accessStatus.textContent = error.message;
  } finally {
    if (store && workspace.hidden) login.hidden = false;
  }
}

initialize();
