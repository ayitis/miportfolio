import { bounds, emptyDraft, fonts, validateDraft } from '../portfolio/design-document.js';
import { pages } from '../portfolio/pages.js';
import { applyElement, collectElements, syncCustomElements } from '../portfolio/render-design.js';
import { visibleUploads } from '../portfolio/gallery-document.js';
import { alignRect, shiftRect } from './alignment.js';
import { createGuideLayer } from './guide-layer.js';
import { actionHistory } from './action-history.js';
import { setupGallery } from './gallery.js';
import { openEditor } from './storage.js';

const find = (id) => document.getElementById(id);
const preview = find('preview');
const element = find('element');
const pagePicker = find('page');
const status = find('status');
const fields = [...document.querySelectorAll('[data-field]')];
const viewButtons = [...document.querySelectorAll('[data-view]')];
let editable = new Map();
let draft = emptyDraft();
let view = 'desktop';
let selected = '';
let drag = null;
let guideLayer;
let nudgeTimer;
const manualGuides = new Map();
let dirty = false;
let store;
let revision = null;
const actions = actionHistory();
let clipboard;
const groupTarget = 'gallery.container';

const workspace = find('workspace');
const access = find('access');
const accessStatus = find('access-status');
const login = find('login');
const history = find('history');
const older = find('older');
const restore = find('restore');
const snapText = find('snap-text');
const showDistances = find('show-distances');
const showRulers = find('show-rulers');

function updateActionButtons() {
  find('undo').disabled = !actions.canUndo;
  find('redo').disabled = !actions.canRedo;
  find('paste-element').disabled = !clipboard || pagePicker.disabled || (clipboard.type === 'photo' && draft.page !== 'nuptias');
  for (const id of ['copy-element', 'duplicate-element']) find(id).disabled = (!selected && !gallery.hasSelection) || selected === groupTarget;
}

function markDirty(group) {
  actions.record(draft, group);
  dirty = actions.dirty;
  updateActionButtons();
  status.textContent = dirty ? 'Cambios pendientes de guardar.' : 'Sin cambios pendientes.';
}

function refreshElements() {
  syncCustomElements(preview.contentDocument, editable, draft);
  const current = selected;
  element.options.length = 1;
  const labels = new Map(pages[draft.page].targets);
  for (const [id, originals] of editable) {
    if (draft.elements[id]?.hidden) continue;
    for (const { node } of originals) if (id !== groupTarget) node.dataset.editorText = id;
    const name = labels.get(id) ?? (draft.content[id]?.text?.slice(0, 65) || 'Texto nuevo');
    element.add(new Option(name, id));
  }
  select(editable.has(current) && !draft.elements[current]?.hidden ? current : '');
}

function restoreActions(back) {
  if (workspace.inert || pagePicker.disabled) return;
  finishDrag();
  const version = actions.step(back);
  if (!version) return;
  draft = version;
  refreshElements();
  applyView(view);
  gallery.reloadUploads();
  dirty = actions.dirty;
  updateActionButtons();
  status.textContent = back ? 'Acción deshecha.' : 'Acción rehecha.';
}

function apply(id) {
  applyElement(editable, id, draft, view);
}

function updateFields() {
  const overrides = draft[view][selected] ?? {};
  const original = editable.get(selected)?.[0];
  const group = selected === groupTarget;
  find('element-layers').hidden = !selected.startsWith('custom.');
  find('gallery-layout-help').hidden = !group;
  find('delete-element').hidden = group;
  find('reset').textContent = group ? 'Restablecer cinta' : 'Restaurar ajustes de este texto';
  find('reset-color').closest('.color-setting').hidden = group;
  for (const input of fields) {
    if (['text', 'size', 'font', 'align', 'spacing', 'height'].includes(input.dataset.field)) {
      input.parentElement.hidden = input.dataset.field === 'height' ? !group : group;
    }
  }
  find('properties').disabled = !original;
  for (const input of fields) {
    const key = input.dataset.field;
    if (key === 'text') {
      input.disabled = original?.allowText === false;
      input.value = input.disabled ? '' : (draft.content[selected]?.text ?? original?.text ?? '');
      input.placeholder = input.disabled ? 'Edita FORM, & y FEELING. por separado.' : 'Texto original';
    } else if (key === 'color') {
      const rgb = original && getComputedStyle(original.node).color.match(/\d+/g);
      input.value = rgb ? '#' + rgb.slice(0, 3).map(value => Number(value).toString(16).padStart(2, '0')).join('') : '#161616';
      find('reset-color').disabled = !overrides.color;
    } else {
      input.value = overrides[key] ?? '';
    }
  }
}

function select(id, reveal = false) {
  if (id) gallery.select('');
  for (const { node } of editable.get(selected) ?? []) node.removeAttribute('data-editor-selected');
  selected = id;
  for (const { node } of editable.get(selected) ?? []) node.setAttribute('data-editor-selected', '');
  element.value = id;
  updateFields();
  updateActionButtons();

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

function finishDrag() {
  const previous = drag;
  drag = null;
  if (previous) {
    previous.node.ownerDocument.documentElement.classList.remove('editor-aligning');
    if (previous.node.hasPointerCapture(previous.pointer)) previous.node.releasePointerCapture(previous.pointer);
  }
  if (previous) actions.closeGroup();
  clearTimeout(nudgeTimer);
  guideLayer?.clear();
}

function syncRulers() {
  guideLayer?.setRulers(showRulers.checked, `${draft.page}:${view}`);
  find('clear-guides').hidden = !showRulers.checked;
  find('ruler-help').hidden = !showRulers.checked;
}

function clampOffset(axis, value) {
  const [min, max] = bounds[axis];
  const viewportWidth = preview.contentDocument?.documentElement.clientWidth ?? 0;
  const limit = selected === groupTarget && axis === 'x'
    ? Math.min(max, Math.max(0, Math.floor((viewportWidth - (draft[view][selected]?.width ?? viewportWidth)) / 2)))
    : max;
  return Math.max(Math.max(min, -limit), Math.min(limit, Math.round(value)));
}

function setPosition(axis, value) {
  const next = clampOffset(axis, value);
  updateSetting(view, axis, next || undefined);
  return next;
}

function captureElement() {
  if (!selected) {
    const photo = gallery.capturePhoto();
    if (!photo) return false;
    clipboard = photo;
    updateActionButtons();
    status.textContent = 'Fotografía copiada.';
    return true;
  }
  const item = editable.get(selected)?.[0];
  if (!item || selected === groupTarget) return false;
  const win = preview.contentWindow;
  const rect = item.node.getBoundingClientRect();
  const css = win.getComputedStyle(item.node);
  const color = css.color.match(/\d+/g)?.slice(0, 3)
    .map(channel => Number(channel).toString(16).padStart(2, '0')).join('');
  const base = {
    size: Math.min(400, Math.max(4, Math.round(parseFloat(css.fontSize)))),
    width: Math.min(4000, Math.max(30, Math.round(item.node.offsetWidth))),
    ...(color && { color: '#' + color }),
    ...(Object.hasOwn({left:1, center:1, right:1, justify:1}, css.textAlign) && { align: css.textAlign }),
  };
  const family = Object.entries(fonts).find(([, value]) => value.split(',')[0].replaceAll('"', '') === css.fontFamily.split(',')[0].replaceAll('"', ''));
  if (family) base.font = family[0];
  const custom = selected.startsWith('custom.');
  const current = draft[view][selected] ?? {};
  const origin = {
    x: custom ? (current.x ?? 0) : Math.round(rect.left + win.scrollX),
    y: custom ? (current.y ?? 0) : Math.round(rect.top + win.scrollY),
  };
  clipboard = { type: 'text', text: draft.content[selected]?.text ?? item.text, settings: {} };
  for (const layout of ['desktop', 'mobile']) {
    const existing = draft[layout][selected] ?? {};
    clipboard.settings[layout] = {
      ...base, ...existing,
      x: custom && layout !== view ? (existing.x ?? 0) : origin.x,
      y: custom && layout !== view ? (existing.y ?? 0) : origin.y,
    };
  }
  updateActionButtons();
  status.textContent = 'Texto copiado. Puedes pegarlo en Home o NUPTIAS.';
  return true;
}

function addText(copy = null) {
  if (workspace.inert || pagePicker.disabled) return;
  const id = 'custom.' + crypto.randomUUID();
  const win = preview.contentWindow;
  draft.elements[id] = { type: 'text' };
  draft.content[id] = { text: copy?.text ?? 'Nuevo texto' };
  for (const layout of ['desktop', 'mobile']) {
    const previous = copy?.settings[layout];
    const maxX = layout === 'mobile' ? 335 : Math.max(40, win.innerWidth - 55);
    const x = previous ? previous.x + 16 : (layout === 'mobile' ? 30 : 64);
    const y = previous ? previous.y + 16 : win.scrollY + Math.round(win.innerHeight * .35);
    draft[layout][id] = { size: 26, width: 245, layer: 10, ...previous,
      x: Math.max(0, Math.min(maxX, x)), y: Math.max(0, Math.min(4000, y)) };
  }
  refreshElements();
  apply(id);
  select(id, true);
  markDirty();
  if (!copy) {
    const input = document.querySelector('[data-field="text"]');
    input.focus();
    input.select();
  }
}

function pasteElement() {
  if (!clipboard || workspace.inert || pagePicker.disabled) return;
  if (clipboard.type === 'photo') gallery.pastePhoto(clipboard);
  else addText(clipboard);
}

function deleteSelection() {
  if (workspace.inert || pagePicker.disabled) return false;
  if (!selected) return gallery.removeSelected();
  if (selected === groupTarget) return false;
  if (selected.startsWith('custom.')) {
    for (const section of ['elements', 'desktop', 'mobile', 'content']) delete draft[section][selected];
  } else {
    draft.elements[selected] = { hidden: true };
    apply(selected);
  }
  refreshElements();
  markDirty();
  return true;
}

function shortcuts(event) {
  if (workspace.hidden || workspace.inert || drag || pagePicker.disabled || event.isComposing ||
      event.target.closest?.('input, textarea, select, button, [contenteditable], summary')) return;
  const key = event.key.toLowerCase();
  if (event.metaKey || event.ctrlKey) {
    if (key === 'z' && (event.shiftKey ? actions.canRedo : actions.canUndo)) restoreActions(!event.shiftKey);
    else if (key === 'c') { if (!captureElement()) return; }
    else if (key === 'v' && clipboard) pasteElement();
    else if (key === 'x' && captureElement()) deleteSelection();
    else return;
    event.preventDefault();
    return;
  }
  if (key === 'delete' || key === 'backspace') {
    if (deleteSelection()) event.preventDefault();
    return;
  }
  nudge(event);
}

function nudge(event) {
  if (!selected || drag || workspace.inert || event.altKey || event.ctrlKey || event.metaKey || event.isComposing ||
      event.target.closest?.('input, textarea, select, button, [contenteditable], summary')) return;
  const directions = { ArrowLeft: ['x', -1], ArrowRight: ['x', 1], ArrowUp: ['y', -1], ArrowDown: ['y', 1] };
  if (!Object.hasOwn(directions, event.key)) return;
  const candidates = editable.get(selected);
  if (!candidates?.length) return;
  event.preventDefault();
  const [axis, direction] = directions[event.key];
  const offset = draft[view][selected]?.[axis] ?? 0;
  if (setPosition(axis, offset + direction * (event.shiftKey ? 10 : 1)) === offset) return;
  apply(selected);
  updateFields();
  markDirty();

  const node = candidates.find(({ node }) => {
    const rect = node.getBoundingClientRect();
    const win = node.ownerDocument.defaultView;
    return rect.right > 0 && rect.left < win.innerWidth && rect.bottom > 0 && rect.top < win.innerHeight;
  })?.node;
  if (!node || !guideLayer) return;
  const rect = node.getBoundingClientRect();
  const targets = guideLayer.references(node, selected);
  const alignment = alignRect(rect, targets, guideLayer.fixedLines(), {}, { x: false, y: false });
  guideLayer.draw(rect, alignment.lines, targets);
  clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(() => guideLayer?.clear(), 650);
}

const columnOffset = find('column-offset');
const showColumn = find('show-column');

function syncColumn() {
  const home = draft.page === 'home';
  find('column-tools').hidden = !home;
  if (!home) return;
  const offset = draft[view]['gallery.column']?.x;
  columnOffset.value = offset ?? '';
  const frame = preview.contentDocument;
  const hero = frame?.querySelector('.hero');
  if (!hero) return;
  hero.dataset.columnOffset = offset ?? 0;
  frame.dispatchEvent(new CustomEvent('portfolio:column-preview', { detail: showColumn.checked }));
}

showColumn.addEventListener('change', syncColumn);
columnOffset.addEventListener('input', () => {
  if (draft.page !== 'home' || !columnOffset.validity.valid) return;
  if (columnOffset.value === '') delete draft[view]['gallery.column'];
  else draft[view]['gallery.column'] = { x: columnOffset.valueAsNumber };
  showColumn.checked = true;
  syncColumn();
  markDirty(columnOffset);
});
columnOffset.addEventListener('blur', () => {
  actions.closeGroup();
  if (!columnOffset.validity.valid) syncColumn();
});

function applyView(next) {
  finishDrag();
  view = next;
  preview.classList.toggle('mobile', next === 'mobile');
  for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  for (const id of editable.keys()) apply(id);
  updateFields();
  gallery.render();
  syncRulers();
  syncColumn();
}

function attach() {
  const page = preview.contentDocument;
  const style = page.createElement('style');
  style.textContent = `
    [data-editor-text] { pointer-events: auto; cursor: move; user-select: none; touch-action: none; }
    [data-editor-text]:hover { outline: 1px dashed #9661e8; }
    .editor-aligning .track, .editor-aligning .marquee-track { animation-play-state: paused !important; }
    [data-editor-selected] { outline: 2px solid #9661e8 !important; outline-offset: 2px; }
  `;
  page.head.append(style);
  guideLayer?.detach();
  guideLayer = createGuideLayer(page, {
    settings: { distance: () => showDistances.checked },
    manualGuides,
    isBusy: () => workspace.inert,
  });
  page.addEventListener('keydown', shortcuts);
  page.defaultView.addEventListener('resize', () => {
    if (preview.contentDocument === page && draft.page === 'nuptias') apply(groupTarget);
  });

  const { targets } = pages[draft.page];
  editable = collectElements(page, targets);
  refreshElements();
  const container = editable.get(groupTarget)?.[0]?.node;
  if (container) {
    const handle = page.createElement('button');
    handle.type = 'button';
    handle.textContent = 'Mover cinta';
    handle.dataset.editorGalleryHandle = '';
    Object.assign(handle.style, {
      position: 'absolute', right: '8px', top: '8px', zIndex: '5', cursor: 'move',
      background: '#fff', color: '#43275d', border: '1px solid #a88ec7', borderRadius: '5px',
      padding: '4px 7px', font: '12px system-ui', touchAction: 'none',
    });
    container.append(handle);
    handle.addEventListener('click', () => select(groupTarget));
  }

  page.addEventListener('click', (event) => {
    if (event.target.closest('a')) event.preventDefault();
  }, true);

  page.addEventListener('pointerdown', (event) => {
    if (workspace.inert) return;
    const handle = event.target.closest('[data-editor-gallery-handle]');
    const node = handle ? container : event.target.closest('[data-editor-text]');
    if (!node || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    finishDrag();
    select(handle ? groupTarget : node.dataset.editorText);
    page.defaultView.focus();
    page.documentElement.classList.add('editor-aligning');
    const offsets = draft[view][selected] ?? {};
    drag = {
      node,
      rect: node.getBoundingClientRect(),
      scrollX: page.defaultView.scrollX,
      scrollY: page.defaultView.scrollY,
      locks: {},
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
    if (drag?.pointer !== event.pointerId || workspace.inert) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    const win = page.defaultView;
    const scrollX = win.scrollX - drag.scrollX;
    const scrollY = win.scrollY - drag.scrollY;
    const requestedX = clampOffset('x', drag.x + dx + scrollX);
    const requestedY = clampOffset('y', drag.y + dy + scrollY);
    const raw = shiftRect(drag.rect, requestedX - drag.x - scrollX, requestedY - drag.y - scrollY);
    const targets = guideLayer.references(drag.node, selected);
    const fixed = guideLayer.fixedLines();
    const snapping = { x: snapText.checked && Math.abs(dx) >= 3, y: snapText.checked && Math.abs(dy) >= 3 };
    const alignment = alignRect(raw, targets, fixed, drag.locks, snapping);
    drag.locks = alignment.locks;
    const x = setPosition('x', requestedX + alignment.x);
    const y = setPosition('y', requestedY + alignment.y);
    apply(selected);
    const placed = shiftRect(drag.rect, x - drag.x - scrollX, y - drag.y - scrollY);
    const exact = alignRect(placed, targets, fixed, {}, { x: false, y: false });
    guideLayer.draw(placed, exact.lines, targets);
    updateFields();
    markDirty(drag);
  });

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    page.addEventListener(type, (event) => {
      if (drag?.pointer === event.pointerId) finishDrag();
    }, true);
  }
}

element.addEventListener('change', () => select(element.value, true));
document.addEventListener('keydown', shortcuts);
find('undo').addEventListener('click', () => restoreActions(true));
find('redo').addEventListener('click', () => restoreActions(false));
find('add-text').addEventListener('click', () => addText());
find('copy-element').addEventListener('click', captureElement);
find('paste-element').addEventListener('click', pasteElement);
find('duplicate-element').addEventListener('click', () => { if (captureElement()) pasteElement(); });
find('delete-element').addEventListener('click', deleteSelection);
for (const [button, layer] of [['layer-back', 1], ['layer-front', 50]]) {
  find(button).addEventListener('click', () => {
    updateSetting(view, 'layer', layer);
    apply(selected);
    markDirty();
    status.textContent = `Capa ${draft[view][selected].layer}.`;
  });
}
showRulers.addEventListener('change', syncRulers);
find('clear-guides').addEventListener('click', () => guideLayer?.clearRulers());
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
    if (key === 'color') updateFields();
    if (key === 'text' && selected.startsWith('custom.')) element.selectedOptions[0].textContent = input.value.slice(0, 65) || 'Texto nuevo';
    markDirty(input);
  });
  input.addEventListener('blur', () => {
    actions.closeGroup();
    if (!input.validity.valid) updateFields();
  });
}

find('reset-color').addEventListener('click', () => {
  updateSetting(view, 'color', undefined);
  apply(selected);
  updateFields();
  markDirty();
});

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
    finishDrag();
    workspace.inert = true;
    try {
      await action();
    } catch (error) {
      status.textContent = error.code === '40001'
        ? 'Hay un borrador más reciente. Descarga una copia de tus cambios y recarga el editor.'
        : error.code === 'PGRST202' && draft.page === 'nuptias'
          ? 'Ejecuta primero la migración de NUPTIAS en el proyecto de Supabase de Preview.'
          : error.message;
    } finally {
      workspace.inert = false;
    }
  };
}

async function save(publish) {
  if (publish && !window.confirm(`¿Quieres mostrar los cambios de ${pages[draft.page].label} en el sitio conectado?`)) return;
  if (publish && draft.gallery) {
    const ids = visibleUploads(draft.gallery);
    const urls = await store.photoUrls(ids);
    if (urls.size !== ids.length) {
      throw new Error('Algunas fotos visibles no están disponibles en Storage. Ocúltalas o vuelve a subirlas antes de publicar.');
    }
  }
  revision = await store.save(draft, revision, publish);
  actions.save(draft);
  dirty = false;
  status.textContent = publish ? 'Cambios publicados.' : 'Borrador guardado de forma privada.';
  // A history read failure must not present a successful write as failed.
  await loadHistory().catch(() => {
    status.textContent += ' El historial no se pudo actualizar. Puedes volver a abrirlo.';
  });
}

async function loadHistory(before) {
  const entries = await store.history(draft.page, before);
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
  draft = await store.restore(draft.page, history.value);
  refreshElements();
  applyView(view);
  gallery.reloadUploads();
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
  link.download = `miportfolio-${draft.page === 'home' ? 'portada' : draft.page}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

find('import').addEventListener('change', runAction(async () => {
  const input = find('import');
  const file = input.files[0];
  if (!file) return;
  try {
    if (file.size > 1_000_000) throw new Error('La copia supera el tamaño permitido.');
    const imported = validateDraft(JSON.parse(await file.text()), draft.page);
    if (dirty && !window.confirm('¿Quieres sustituir los cambios pendientes por esta copia?')) return;
    draft = imported;
    refreshElements();
    applyView(view);
    gallery.reloadUploads();
    markDirty();
    status.textContent = 'Copia importada. Pulsa Guardar borrador para conservarla.';
  } catch (error) {
    status.textContent = error instanceof SyntaxError ? 'El archivo no contiene una copia válida.' : error.message;
  } finally {
    input.value = '';
  }
}));

const pageControls = ['page', 'element', 'save', 'publish', 'export', 'import', 'add-text'];

function initializePreview() {
  const url = new URL(preview.contentDocument.URL);
  if (url.pathname !== pages[draft.page].path || !url.searchParams.has('editor-preview')) return;
  attach();
  if (draft.page === 'nuptias') gallery.attach(preview.contentDocument);
  applyView(view);
  status.textContent = `Editando ${pages[draft.page].label}.`;
  for (const id of pageControls) find(id).disabled = false;
  updateActionButtons();
}

async function showPage(page) {
  ({ draft, revision } = await store.load(page));
  actions.reset(draft);
  gallery.detach();
  finishDrag();
  guideLayer?.detach();
  guideLayer = undefined;
  pagePicker.value = page;
  showColumn.checked = false;
  find('column-tools').hidden = true;
  dirty = false;
  select('');
  editable.clear();
  element.options.length = 1;
  history.options.length = 1;
  history.closest('details').open = false;
  restore.disabled = true;
  older.hidden = true;
  for (const id of pageControls) find(id).disabled = true;
  status.textContent = `Cargando ${pages[page].label}…`;
  preview.src = `${pages[page].path}?editor-preview=1`;
}

preview.addEventListener('load', initializePreview);
pagePicker.addEventListener('change', runAction(async () => {
  const next = pagePicker.value;
  pagePicker.value = draft.page;
  if (dirty && !window.confirm('¿Cambiar de página sin guardar los cambios pendientes?')) return;
  await showPage(next);
}));

async function enterWorkspace() {
  await store.verifyOwner();
  await showPage('home');
  access.hidden = true;
  workspace.hidden = false;
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

const gallery = setupGallery({
  getDraft: () => draft,
  getView: () => view,
  getStore: () => store,
  runAction,
  markDirty,
  closeGroup: () => actions.closeGroup(),
  selectionChanged: updateActionButtons,
  deselectText: () => select(''),
  status,
  isBusy: () => workspace.inert,
});

initialize();
