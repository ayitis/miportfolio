import { attachVillaHandles, resizeVillaSketch } from './villa-handles.js';
import { introAsset, introScenes, readVillaIntro } from '../portfolio/villa-tiger/intro-settings.js';
import { constrainVillaIdentity, villaAddedImage, villaIdentity, villaIdentityClearance, villaImagePath, villaPage, villaSketch } from '../portfolio/villa-design.js';
import { designScale } from '../portfolio/ayam-canvas.js';
import { frameUpdate } from './frame-update.js';
import { mobileMaxWidth } from '../portfolio/viewport.js';
import { renderPortfolio } from '../portfolio/render-portfolio.js';
import { ayamPage, ireFields, notEgoFields } from '../portfolio/ayam-document.js';
import { renderIreSettings, renderNotEgo, syncAyamNodes } from '../portfolio/ayam-layout.js';
import { setupAyam } from './ayam.js';
import { carnagePage } from '../portfolio/carnage-document.js';
import { setupCarnage } from './carnage.js';
import { applyNuptiasLayout, followsNuptiasHeading, hasNuptiasDesktopLimit, isNuptiasPosition, nuptiasEditorial, nuptiasPositionBounds, nuptiasRightLimit, nuptiasLayout } from '../portfolio/nuptias-layout.js';
import { applyHomeGalleryLayout, horizontalGallery, verticalGallery, verticalStage } from '../portfolio/home-gallery-layout.js';
import { bounds, emptyDraft, fonts, validateDraft } from '../portfolio/design-document.js';
import { pages } from '../portfolio/pages.js';
import { applyElement, applyElementText, collectElements, constrainNuptiasPositions, syncCustomElements } from '../portfolio/render-design.js';
import { visibleUploads } from '../portfolio/gallery-document.js';
import { alignRect, shiftRect } from './alignment.js';
import { createGuideLayer } from './guide-layer.js';
import { actionHistory } from './action-history.js';
import { setupGallery } from './gallery.js';
import { openEditor } from './storage.js';

const find = (id) => document.getElementById(id);
const preview = find('preview');
const viewportWidth = find('viewport-width');
const viewportHeight = find('viewport-height');
const viewportSize = find('viewport-size');
const canvasSizes = new Map();
const canvasKey = () => `${draft.page}:${view}`;

const element = find('element');
const pagePicker = find('page');
const status = find('status');
const villaImageSource = find('villa-image-source');
const villaImageAlt = find('villa-image-alt');
const villaNewSource = find('villa-new-source');
const villaInputs = [...document.querySelectorAll('[data-villa-field]')];
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
const homeGallery = id => id === horizontalGallery || id === verticalGallery;
const layoutElement = id => id === groupTarget || id === nuptiasEditorial || homeGallery(id);

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
  for (const id of ['copy-element', 'duplicate-element']) find(id).disabled = (!selected && !gallery.hasSelection) || layoutElement(selected) || Boolean(editable.get(selected)?.[0]?.villaKind);
}

function markDirty(group) {
  actions.record(draft, group);
  dirty = actions.dirty;
  updateActionButtons();
  const message = dirty ? 'Cambios pendientes de guardar.' : 'Sin cambios pendientes.';
  if (status.textContent !== message) status.textContent = message;
}

function refreshElements() {
  if (draft.page === ayamPage) syncAyamNodes(preview.contentDocument, draft, editable);
  syncCustomElements(preview.contentDocument, editable, draft);
  const current = selected;
  element.options.length = 1;
  const labels = new Map(pages[draft.page].targets);
  for (const [id, originals] of editable) {
    const hidden = draft.elements[id]?.hidden;
    if (hidden && draft.page !== ayamPage && draft.page !== villaPage) continue;
    for (const { node } of originals) if (!layoutElement(id) && originals[0].villaKind !== 'section') node.dataset.editorText = id;
    const caption = /^caption(?:-title|-description)?\./.test(id) ? 'Pie · ' + (draft.content[id]?.text ?? originals[0].text).slice(0, 60) : null;
    const name = labels.get(id) ?? (villaAddedImage(id) ? 'Imagen añadida · ' + (draft.content[id]?.alt || originals[0].imageSource.split('/').pop()) : null) ?? caption ?? (draft.content[id]?.text?.slice(0, 65) || 'Texto nuevo');
    element.add(new Option(name + (hidden ? ' · oculto' : ''), id));
  }
  select(editable.has(current) && ([ayamPage, villaPage].includes(draft.page) || !draft.elements[current]?.hidden) ? current : '');
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
  if (homeGallery(id)) { syncColumn(); return; }
  applyElement(editable, id, draft, view);
  constrainNuptiasPositions(preview.contentDocument, editable, draft, view);
  if (draft.page === villaPage) constrainVillaIdentity(preview.contentDocument, draft, view);
}

function updateFields() {
  const overrides = draft[view][selected] ?? {};
  const original = editable.get(selected)?.[0];
  const image = original?.imageSource;
  const villaSection = original?.villaKind === 'section';
  const villaSwatch = original?.villaKind === 'swatch';
  const villaDecoration = ['decoration', 'rule'].includes(original?.villaKind);
  const villaBlock = image || villaSection || villaSwatch || villaDecoration;
  find('villa-add-photo').hidden = draft.page !== villaPage;
  find('villa-image-tools').hidden = !image;
  find('villa-sketch-tools').hidden = selected !== villaSketch;
  find('villa-section-tools').hidden = !villaSection;
  find('villa-social-tools').hidden = selected !== 'villa-section.action';
  const post = original?.node.classList.contains('social-post');
  find('villa-post-tools').hidden = !post;
  find('villa-post-tools').querySelector('input').placeholder = post ? original.node.dataset.postIndex : '';
  find('villa-swatch-tools').hidden = !villaSwatch;
  find('villa-restore-photo').hidden = !image || !draft.elements[selected]?.hidden;
  find('villa-restore-decoration').hidden = !((villaSwatch || villaDecoration) && draft.elements[selected]?.hidden);
  villaImageAlt.value = image ? draft.content[selected]?.alt ?? original.imageAlt : '';
  for (const input of villaInputs) {
    const key = input.dataset.villaField;
    if (input.type === 'checkbox') input.checked = Boolean(overrides[key]);
    else input.value = overrides[key] ?? (key === 'fill' ? original?.swatch ?? '#000000'
      : key === 'shift' ? 0 : '');
    if (key === 'shift') find('villa-section-shift-value').textContent = `${input.value} px`;
  }
  villaImageSource.parentElement.hidden = !image;
  villaImageSource.value = image ? draft.content[selected]?.source ?? image : '';
  villaImageSource.setCustomValidity('');
  const group = layoutElement(selected);
  const groupSizing = selected === groupTarget;
  find('element-layers').hidden = !selected.startsWith('custom.');
  find('gallery-layout-help').hidden = !groupSizing;
  const hiddenAyamText = draft.page === ayamPage && draft.elements[selected]?.hidden;
  find('delete-element').hidden = group || villaSection || Boolean(hiddenAyamText) || Boolean((image || villaSwatch || villaDecoration) && draft.elements[selected]?.hidden);
  find('ayam-restore-text').hidden = !hiddenAyamText;
  find('ayam-hide-text').hidden = draft.page !== ayamPage || Boolean(hiddenAyamText) || !selected;
  const limited = draft.page === 'nuptias' && hasNuptiasDesktopLimit(selected, view);
  find('nuptias-align-right').hidden = draft.page !== 'nuptias' || !isNuptiasPosition(selected);
  find('nuptias-guide-help').hidden = !limited;
  find('reset').textContent = selected === nuptiasEditorial ? 'Restablecer posición del bloque' : group ? 'Restablecer cinta' : villaBlock ? 'Restablecer ajustes' : 'Restaurar ajustes de este texto';
  find('reset-color').closest('.color-setting').hidden = group || Boolean(villaBlock);
  for (const input of fields) {
    if (['text', 'size', 'font', 'align', 'spacing', 'height'].includes(input.dataset.field)) {
      input.parentElement.hidden = input.dataset.field === 'height' ? post || (!groupSizing && draft.page !== ayamPage && !image && !villaSection) : group || Boolean(villaBlock);
    }
  }
  fields.find(input => input.dataset.field === 'width').parentElement.hidden = homeGallery(selected) || selected === nuptiasEditorial || villaSection;
  for (const axis of ['x', 'y']) fields.find(input => input.dataset.field === axis).parentElement.hidden = villaSection;
  find('properties').querySelector('legend').textContent = selected === nuptiasEditorial ? 'Posición del bloque' : group ? 'Posición de la galería' : image ? 'Ajustes de la imagen' : villaSection ? 'Espaciado de la sección' : villaSwatch ? 'Muestra de color' : villaDecoration ? 'Recuadro o línea decorativa' : 'Ajustes del texto';
  const height = fields.find(input => input.dataset.field === 'height');
  height.min = (draft.page === ayamPage || image || villaSection) ? '16' : String(bounds.height[0]);
  height.max = (draft.page === ayamPage || image || villaSection) ? '4000' : String(bounds.height[1]);
  find('properties').disabled = !original;
  for (const input of fields) {
    const key = input.dataset.field;
    if (key === 'width' || key === 'height') {
      const rect = selected === villaSketch && original?.node.getBoundingClientRect();
      input.placeholder = rect && rect[key] ? String(Math.round(rect[key] / designScale(original.node.ownerDocument))) : 'Original';
    }
    if (key === 'text') {
      input.disabled = original?.allowText === false;
      input.value = input.disabled ? '' : (draft.content[selected]?.text ?? original?.text ?? '');
      input.placeholder = input.disabled ? 'Edita FORM, & y FEELING. por separado.' : 'Texto original';
    } else if (key === 'color') {
      const rgb = original && getComputedStyle(original.node).color.match(/\d+/g);
      input.value = rgb ? '#' + rgb.slice(0, 3).map(value => Number(value).toString(16).padStart(2, '0')).join('') : '#161616';
      find('reset-color').disabled = !overrides.color;
    } else {
      const actual = key === 'x' && (isDesktopHeadingFollower() || (draft.page === 'nuptias' && isNuptiasPosition(selected)))
        ? Math.round(Number(original?.node.dataset.nuptiasX)) : NaN;
      input.value = Number.isFinite(actual) && actual !== (overrides[key] ?? 0) ? actual : (overrides[key] ?? '');
    }
  }
}

function select(id, reveal = false) {
  textUpdates.flush();
  if (id) {
    gallery.select('');
    carnage.clear();
    ayam.clear();
  }
  for (const { node } of editable.get(selected) ?? []) node.removeAttribute('data-editor-selected');
  selected = id;
  if (id === verticalGallery && (Number(columnStage.value) < verticalStage || Number(columnStage.value) >= 76)) setColumnStage(verticalStage);
  else if (id === horizontalGallery && Number(columnStage.value) !== 0) setColumnStage(0);
  for (const { node } of editable.get(selected) ?? []) node.setAttribute('data-editor-selected', '');
  element.value = id;
  updateFields();
  updateActionButtons();

  const node = editable.get(id)?.[0]?.node;
  if (reveal && node) {
    // Scrolling a carousel item into view would shift the looping track.
    const archive = node.closest('.social-archive');
    if (archive) archive.open = true;
    if (node.classList.contains('social-post')) node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const anchor = node.closest('.marquee') ?? node;
    const { top, bottom } = anchor.getBoundingClientRect();
    const frame = preview.contentWindow;
    if (bottom <= 0 || top >= frame.innerHeight) frame.scrollBy(0, top - 24);
  }
}

function keepNuptiasLayout() {
  const layout = nuptiasLayout(draft, view);
  const settings = draft[view][nuptiasEditorial] ??= {};
  settings.layout ??= layout;
  applyNuptiasLayout(preview.contentDocument, draft, view);
}

function updateSetting(section, key, value) {
  if (section === view && draft.page === 'nuptias' && ['x', 'y', 'width'].includes(key) &&
      (selected.startsWith('editorial.') || selected.startsWith('concept.'))) keepNuptiasLayout();
  const settings = draft[section][selected] ??= {};
  if (value === undefined) delete settings[key];
  else settings[key] = value;
  if (Object.keys(settings).length === 0) delete draft[section][selected];
}

function finishDrag() {
  textUpdates.flush();
  pointerUpdates.flush();
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
  let [min, max] = bounds[axis];
  if (selected === verticalGallery) {
    const hero = preview.contentDocument.querySelector('.hero');
    const suffix = axis.toUpperCase();
    min = Number(hero.dataset['columnMin' + suffix] ?? min);
    max = Number(hero.dataset['columnMax' + suffix] ?? max);
    return Math.max(min, Math.min(max, Math.round(value)));
  }
  if (draft.page === 'nuptias' && (isNuptiasPosition(selected) || hasNuptiasDesktopLimit(selected, view))) {
    const node = editable.get(selected)?.[0]?.node;
    if (node) {
      [min, max] = nuptiasPositionBounds(node, axis, view);
      return Math.max(min, Math.min(max, Math.round(value)));
    }
  }
  const viewportWidth = preview.contentDocument?.documentElement.clientWidth ?? 0;
  const limit = selected === groupTarget && axis === 'x'
    ? Math.min(max, Math.max(0, Math.floor((viewportWidth - (draft[view][selected]?.width ?? viewportWidth)) / 2)))
    : max;
  return Math.max(Math.max(min, -limit), Math.min(limit, Math.round(value)));
}

function isDesktopHeadingFollower() {
  return draft.page === 'nuptias' && view === 'desktop' && followsNuptiasHeading(selected);
}

function currentPosition(axis) {
  const live = axis === 'x' && isDesktopHeadingFollower()
    ? Number(editable.get(selected)?.[0].node.dataset.nuptiasX) : NaN;
  return Number.isFinite(live) ? live : (draft[view][selected]?.[axis] ?? 0);
}

function setPosition(axis, value) {
  const next = clampOffset(axis, value);
  if (isDesktopHeadingFollower() && axis === 'x') {
    updateSetting(view, 'independentX', true);
  }
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
  if (!item || item.villaKind || layoutElement(selected)) return false;
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
  const scale = designScale(item.node.ownerDocument);
  const origin = {
    x: custom ? (current.x ?? 0) : Math.round((rect.left + win.scrollX) / scale),
    y: custom ? (current.y ?? 0) : Math.round((rect.top + win.scrollY) / scale),
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
  status.textContent = 'Texto copiado. Puedes pegarlo en una página del editor.';
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
    const y = previous ? previous.y + 16 : Math.round((win.scrollY + win.innerHeight * .35) / designScale(win.document));
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
  if (layoutElement(selected) || editable.get(selected)?.[0]?.villaKind === 'section') return false;
  if (selected.startsWith('custom.') || (draft.page === villaPage && villaAddedImage(selected))) {
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

function showNuptiasLimit(node = editable.get(selected)?.[0]?.node) {
  const guide = node && draft.page === 'nuptias' && isNuptiasPosition(selected) && view === 'desktop'
    ? nuptiasRightLimit(node.ownerDocument, view) : null;
  const edge = node?.getBoundingClientRect().right;
  guideLayer?.drawRightLimit(guide !== null && Math.abs(edge - guide) < 1.01 ? guide : null);
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
  const offset = clampOffset(axis, currentPosition(axis));
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
  const alignment = alignRect(rect, targets, guideLayer.fixedLines(selected), {}, { x: false, y: false });
  guideLayer.draw(rect, alignment.lines, targets);
  showNuptiasLimit(node);
  clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(() => guideLayer?.clear(), 650);
}

const columnStage = find('column-stage');
const mobileScrollText = find('mobile-scroll-text');
const mobileScrollX = find('mobile-scroll-x');
const mobileScrollY = find('mobile-scroll-y');
let mobileScrollDrag = null;

function syncMobileScrollFields() {
  const enabled = draft.page === 'home' && view === 'mobile';
  find('mobile-scroll-reset').disabled = !enabled;
  mobileScrollX.disabled = !enabled;
  mobileScrollY.disabled = !enabled;
  const settings = draft.mobile[mobileScrollText.value] ?? {};
  mobileScrollX.value = settings.x ?? 0;
  mobileScrollY.value = settings.y ?? 0;
}

function updateMobileScrollPosition(id, x, y, group) {
  const cleanX = Math.round(Math.max(bounds.x[0], Math.min(bounds.x[1], x)));
  const cleanY = Math.round(Math.max(bounds.y[0], Math.min(bounds.y[1], y)));
  if (cleanX || cleanY) draft.mobile[id] = {
    ...(cleanX ? { x: cleanX } : {}),
    ...(cleanY ? { y: cleanY } : {}),
  };
  else delete draft.mobile[id];
  syncMobileScrollFields();
  syncColumn();
  markDirty(group);
}

const columnButtons = [...document.querySelectorAll('[data-column-stage]')];

function syncColumn() {
  const home = draft.page === 'home';
  find('column-tools').hidden = !home;
  if (!home) return;
  syncMobileScrollFields();
  const frame = preview.contentDocument;
  if (!frame?.querySelector('.hero')) return;
  const progress = Number(columnStage.value);
  applyHomeGalleryLayout(frame, draft[view]);
  find('column-progress').textContent = `${progress} %`;
  for (const button of columnButtons) {
    const target = button.dataset.columnStage === 'vertical' ? verticalStage : Number(button.dataset.columnStage);
    button.setAttribute('aria-pressed', String(target === progress));
  }
  const railHandle = frame.querySelector('[data-editor-gallery-handle="gallery.rail"]');
  if (railHandle) railHandle.hidden = progress !== 0;
  frame.dispatchEvent(new CustomEvent('portfolio:column-preview', { detail: progress / 100 }));
}

function setColumnStage(progress) {
  columnStage.value = String(progress);
  syncColumn();
}

function changeColumnStage(progress) {
  if ((selected === horizontalGallery && progress !== 0) ||
      (selected === verticalGallery && (progress < verticalStage || progress >= 76))) select('');
  finishDrag();
  setColumnStage(progress);
}

for (const button of columnButtons) button.addEventListener('click', () => {
  const choice = button.dataset.columnStage;
  changeColumnStage(choice === 'vertical' ? verticalStage : Number(choice));
});
columnStage.addEventListener('input', () => changeColumnStage(Number(columnStage.value)));

find('mobile-scroll-mode').addEventListener('click', () => {
  if (draft.page !== 'home') return;
  applyView('mobile');
  find('column-tools').open = true;
  changeColumnStage(24);
  preview.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
mobileScrollText.addEventListener('change', syncMobileScrollFields);
for (const [input, axis] of [[mobileScrollX, 'x'], [mobileScrollY, 'y']]) {
  input.addEventListener('input', () => {
    if (workspace.inert || view !== 'mobile' || draft.page !== 'home' || !input.validity.valid) return;
    const settings = draft.mobile[mobileScrollText.value] ?? {};
    updateMobileScrollPosition(mobileScrollText.value,
      axis === 'x' ? Number(input.value || 0) : settings.x ?? 0,
      axis === 'y' ? Number(input.value || 0) : settings.y ?? 0, input);
  });
  input.addEventListener('blur', () => actions.closeGroup());
}
find('mobile-scroll-reset').addEventListener('click', () => {
  if (view !== 'mobile' || draft.page !== 'home') return;
  updateMobileScrollPosition(mobileScrollText.value, 0, 0);
});


function showCanvasSize() {
  const { clientWidth, clientHeight } = preview;
  const dimensions = `${clientWidth} × ${clientHeight} px`;
  if (viewportSize.value !== dimensions) viewportSize.value = dimensions;
}

function sizeCanvas() {
  const { width, height } = canvasSizes.get(canvasKey()) ?? {};
  const mobile = view === 'mobile';
  const limit = mobileMaxWidth(draft.page);
  find('ayam-canvas-help').hidden = draft.page !== ayamPage || mobile;
  viewportWidth.min = mobile ? 240 : limit + 1;
  viewportWidth.max = mobile ? limit : 3840;
  viewportWidth.value = width ?? '';
  viewportHeight.value = height ?? '';
  preview.classList.toggle('mobile', mobile);
  preview.toggleAttribute('data-exact-width', width !== undefined);
  preview.style.width = width === undefined ? '' : `${width}px`;
  preview.style.minWidth = mobile ? '' : `${limit + 1}px`;
  preview.style.height = height === undefined ? '' : `${height}px`;
  preview.style.minHeight = height === undefined ? '' : '0';
  showCanvasSize();
  if (draft.page === ayamPage) preview.contentDocument?.dispatchEvent(new Event('portfolio:ayam-canvas-sync'));
  if (draft.page === villaPage) preview.contentDocument?.dispatchEvent(new Event('portfolio:villa-canvas-sync'));
}

for (const [field, name] of [[viewportWidth, 'width'], [viewportHeight, 'height']]) {
  field.addEventListener('change', () => {
    if (!field.validity.valid) {
      sizeCanvas();
      return;
    }
    const size = canvasSizes.get(canvasKey()) ?? {};
    if (field.value === '') delete size[name];
    else size[name] = field.valueAsNumber;
    canvasSizes.set(canvasKey(), size);
    applyView(view);
  });
}
new ResizeObserver(showCanvasSize).observe(preview);

const ireTools = find('ire-tools');
const irePreview = find('ire-preview');
const ireInputs = [...ireTools.querySelectorAll('[data-ire-field]')];

function updateIreTools() {
  const enabled = draft.page === ayamPage;
  ireTools.hidden = !enabled;
  if (!enabled) return;
  const saved = draft.ayam[view].ire ?? {};
  for (const input of ireInputs) {
    const key = input.dataset.ireField;
    const field = ireFields[key];
    input.value = saved[key] ?? (Array.isArray(field) ? field[2] : field);
  }
  renderIreSettings(preview.contentDocument, draft, view);
}

for (const input of ireInputs) {
  const key = input.dataset.ireField;
  const field = ireFields[key];
  if (Array.isArray(field)) [input.min, input.max] = field;
  input.addEventListener('change', () => {
    if (draft.page !== ayamPage || !input.validity.valid || workspace.inert) return;
    const value = Array.isArray(field) ? input.valueAsNumber : input.value;
    if (Number.isNaN(value)) { updateIreTools(); return; }
    (draft.ayam[view].ire ??= {})[key] = value;
    updateIreTools();
    markDirty();
  });
}
find('ire-show').addEventListener('click', () => {
  preview.contentDocument.getElementById('ire-magazine')?.scrollIntoView({ block: 'start', behavior: 'instant' });
});
irePreview.addEventListener('change', () => {
  preview.contentDocument.dispatchEvent(new CustomEvent('portfolio:ire-preview', { detail: irePreview.checked }));
});
find('ire-reset').addEventListener('click', () => {
  if (draft.page !== ayamPage || workspace.inert) return;
  delete draft.ayam[view].ire;
  updateIreTools();
  markDirty();
});

for (const button of ireTools.querySelectorAll('[data-ire-text]')) {
  button.addEventListener('click', () => select(button.dataset.ireText, true));
}

const notEgoTools = find('not-ego-tools');
const notEgoInputs = [...notEgoTools.querySelectorAll('[data-not-ego-field]')];

function updateNotEgoTools() {
  notEgoTools.hidden = draft.page !== ayamPage;
  if (notEgoTools.hidden) return;
  const saved = draft.ayam[view].notEgo ?? {};
  for (const input of notEgoInputs) {
    const key = input.dataset.notEgoField;
    const field = notEgoFields[key];
    input.value = saved[key] ?? (Array.isArray(field) ? '' : field);
  }
  renderNotEgo(preview.contentDocument, draft, view);
}

for (const input of notEgoInputs) {
  const key = input.dataset.notEgoField;
  const field = notEgoFields[key];
  if (Array.isArray(field)) [input.min, input.max] = field;
  input.addEventListener('change', () => {
    if (draft.page !== ayamPage || workspace.inert) return;
    if (!input.validity.valid) { updateNotEgoTools(); return; }
    const settings = draft.ayam[view].notEgo ??= {};
    if (input.value === '') delete settings[key];
    else settings[key] = Array.isArray(field) ? input.valueAsNumber : input.value;
    if (!Object.keys(settings).length) delete draft.ayam[view].notEgo;
    updateNotEgoTools();
    markDirty();
  });
}

find('not-ego-show').addEventListener('click', () => {
  preview.contentDocument.getElementById('project')?.scrollIntoView({ block: 'start', behavior: 'instant' });
});
find('not-ego-reset').addEventListener('click', () => {
  if (draft.page !== ayamPage || workspace.inert) return;
  delete draft.ayam[view].notEgo;
  updateNotEgoTools();
  markDirty();
});

const villaIntroTools = find('villa-intro-tools');
const villaIntroSources = [...villaIntroTools.querySelectorAll('[data-villa-intro-source]')];
const villaIntroLogo = find('villa-intro-logo');
const villaIntroDuration = find('villa-intro-duration');
const villaIntroOrder = find('villa-intro-order');
const villaSceneNames = { garden: 'Jardín floral', olive: 'Verde oliva', pool: 'Terracota y piscina' };

for (const first of introScenes) {
  const rest = introScenes.filter(scene => scene !== first);
  for (const order of [[first, ...rest], [first, ...[...rest].reverse()]]) {
    villaIntroOrder.add(new Option(order.map(scene => villaSceneNames[scene]).join(' → '), order.join(',')));
  }
}

function updateVillaIntroTools() {
  villaIntroTools.hidden = draft.page !== villaPage;
  if (villaIntroTools.hidden) return;
  const settings = readVillaIntro(draft, view);
  for (const input of villaIntroSources) {
    const scene = input.dataset.villaIntroSource;
    input.value = draft.villaIntro?.sources?.[scene] ?? '';
    input.placeholder = introAsset(scene);
    input.setCustomValidity('');
  }
  villaIntroLogo.value = settings.logoSize;
  villaIntroDuration.value = settings.transition;
  villaIntroOrder.value = settings.scenes.map(({ scene }) => scene).join(',');
}

function applyVillaIntroChange() {
  preview.contentDocument?.dispatchEvent(new CustomEvent('portfolio:villa-intro', { detail: readVillaIntro(draft, view) }));
  markDirty();
}

for (const input of villaIntroSources) {
  input.addEventListener('input', () => input.setCustomValidity(''));
  input.addEventListener('change', () => {
    if (draft.page !== villaPage || workspace.inert) return;
    const value = input.value.trim();
    if (value && !villaImagePath(value)) {
      input.setCustomValidity('Usa una ruta del portfolio o una URL HTTPS de imagen.');
      input.reportValidity();
      return;
    }
    const intro = draft.villaIntro ??= {};
    const sources = intro.sources ??= {};
    const scene = input.dataset.villaIntroSource;
    if (value) sources[scene] = value;
    else delete sources[scene];
    applyVillaIntroChange();
  });
}

for (const [input, key] of [[villaIntroLogo, 'logoSize'], [villaIntroDuration, 'transition'], [villaIntroOrder, 'order']]) {
  input.addEventListener('change', () => {
    if (draft.page !== villaPage || workspace.inert || !input.validity.valid) return;
    const intro = draft.villaIntro ??= {};
    const settings = intro[view] ??= {};
    if (input.value) settings[key] = key === 'order' ? input.value.split(',') : input.valueAsNumber;
    else delete settings[key];
    updateVillaIntroTools();
    applyVillaIntroChange();
  });
}

function applyView(next) {
  finishDrag();
  view = next;
  sizeCanvas();
  for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  find('nuptias-position-tools').hidden = draft.page !== 'nuptias' || view !== 'desktop';
  renderPortfolio(preview.contentDocument, editable, draft, view, {
    renderGallery: () => {
      gallery.render();
      carnage.render();
      ayam.render();
    },
    renderHome: syncColumn,
  });
  updateNotEgoTools();
  updateIreTools();
  updateVillaIntroTools();
  updateFields();
  syncRulers();
}

const pointerUpdates = frameUpdate((page, event) => {
  if (drag?.pointer !== event.pointerId || workspace.inert) return;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) < 3) return;
  drag.moved = true;
  const win = page.defaultView;
  const scrollX = win.scrollX - drag.scrollX;
  const scrollY = win.scrollY - drag.scrollY;
  const scale = designScale(page);
  if (drag.villaHandle) {
    if (drag.villaHandle === 'section') {
      const shift = drag.shift + (dy + scrollY) / scale;
      updateSetting(view, 'shift', Math.round(Math.max(drag.minShift, Math.min(700, shift))));
    } else {
      const size = resizeVillaSketch(drag, (dx + scrollX) / scale, (dy + scrollY) / scale);
      updateSetting(view, 'width', size.width);
      updateSetting(view, 'height', size.height);
      for (const key of ['stretchX', 'stretchY', 'zoom']) updateSetting(view, key, undefined);
      setPosition('x', drag.x + size.x);
      setPosition('y', drag.y + size.y);
    }
    apply(selected);
    updateFields();
    markDirty(drag);
    return;
  }
  const requestedX = clampOffset('x', drag.x + (dx + scrollX) / scale);
  const requestedY = clampOffset('y', drag.y + (dy + scrollY) / scale);
  const raw = shiftRect(drag.rect, (requestedX - drag.x) * scale - scrollX, (requestedY - drag.y) * scale - scrollY);
  const targets = guideLayer.references(drag.node, selected);
  const fixed = guideLayer.fixedLines(selected);
  const snapping = { x: snapText.checked && Math.abs(dx) >= 3, y: snapText.checked && Math.abs(dy) >= 3 };
  const alignment = alignRect(raw, targets, fixed, drag.locks, snapping);
  drag.locks = alignment.locks;
  const followTitle = isDesktopHeadingFollower() && !draft.desktop[selected]?.independentX;
  const x = followTitle && !dx && !scrollX ? drag.x : setPosition('x', requestedX + alignment.x / scale);
  const y = setPosition('y', requestedY + alignment.y / scale);
  apply(selected);
  const placed = shiftRect(drag.rect, (x - drag.x) * scale - scrollX, (y - drag.y) * scale - scrollY);
  const exact = alignRect(placed, targets, fixed, {}, { x: false, y: false });
  guideLayer.draw(placed, exact.lines, targets);
  showNuptiasLimit(drag.node);
  updateFields();
  markDirty(drag);
});

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
    if (preview.contentDocument !== page || pagePicker.disabled) return;
    if (draft.page === 'nuptias') {
      apply(groupTarget);
      apply(nuptiasEditorial);
    }
    if (draft.page === ayamPage) ayam.render(false);
  });

  const hero = page.querySelector('.hero');
  if (draft.page === 'home' && hero) {
    const region = page.createElement('div');
    region.dataset.columnRegion = '';
    region.hidden = true;
    Object.assign(region.style, { position: 'absolute', pointerEvents: 'none', zIndex: 21 });
    hero.append(region);
  }

  const { targets } = pages[draft.page];
  editable = collectElements(page, targets);
  refreshElements();
  if (draft.page === villaPage) attachVillaHandles(page);
  for (const [id, label] of [[groupTarget, 'Mover cinta'], [nuptiasEditorial, 'Mover bloque editorial'], [horizontalGallery, 'Mover carrusel'], [verticalGallery, 'Mover cinta vertical']]) {
    const group = editable.get(id)?.[0]?.node;
    if (!group) continue;
    const handle = page.createElement('button');
    handle.type = 'button';
    handle.textContent = label;
    handle.dataset.editorGalleryHandle = id;
    Object.assign(handle.style, {
      position: 'absolute', right: '8px', top: 'var(--editor-handle-top, 8px)', zIndex: '5', cursor: 'move',
      background: '#fff', color: '#43275d', border: '1px solid #a88ec7', borderRadius: '5px',
      padding: '4px 7px', font: '12px system-ui', touchAction: 'none', pointerEvents: 'auto',
    });
    if (id === nuptiasEditorial) handle.style.top = '-29px';
    if (id === horizontalGallery) group.style.position = 'relative';
    group.append(handle);
    handle.addEventListener('click', () => select(id));
  }

  page.addEventListener('click', (event) => {
    if (event.target.closest('a')) event.preventDefault();
  }, true);

  // Drag the two heading labels independently during a mobile scroll preview.
  page.addEventListener('pointerdown', event => {
    if (workspace.inert || draft.page !== 'home' || view !== 'mobile' ||
        Number(columnStage.value) <= 0 || Number(columnStage.value) >= 76 ||
        event.button !== 0 || !event.isPrimary) return;
    const header = event.target.closest('.gallery-header');
    const node = header && event.target.closest('span');
    const index = node ? [...header.children].indexOf(node) : -1;
    if (index < 0 || index > 1) return;
    const id = index === 0 ? 'gallery.scroll-title' : 'gallery.scroll-instructions';
    mobileScrollText.value = id;
    const settings = draft.mobile[id] ?? {};
    mobileScrollDrag = {
      id, node, pointer: event.pointerId, x: settings.x ?? 0, y: settings.y ?? 0,
      startX: event.clientX, startY: event.clientY,
    };
    syncMobileScrollFields();
    event.preventDefault();
    event.stopImmediatePropagation();
    node.setPointerCapture(event.pointerId);
  }, true);
  page.addEventListener('pointermove', event => {
    if (!mobileScrollDrag || mobileScrollDrag.pointer !== event.pointerId) return;
    const move = mobileScrollDrag;
    const scale = designScale(page);
    updateMobileScrollPosition(move.id,
      move.x + (event.clientX - move.startX) / scale,
      move.y + (event.clientY - move.startY) / scale, move);
    event.preventDefault();
  }, true);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    page.addEventListener(type, event => {
      if (mobileScrollDrag?.pointer !== event.pointerId) return;
      mobileScrollDrag = null;
      actions.closeGroup();
    }, true);
  }

  page.addEventListener('pointerdown', (event) => {
    if (workspace.inert) return;
    const villaHandle = event.target.closest('[data-villa-handle]')?.dataset.villaHandle;
    const handle = event.target.closest('[data-editor-gallery-handle]');
    const heading = event.target.closest('.concept h2[data-editor-text="concept.title"]');
    const partSelected = ['concept.form', 'concept.ampersand', 'concept.feeling'].includes(selected);
    const text = heading && !partSelected ? heading : event.target.closest('[data-editor-text]');
    const photo = event.target.closest('.hero .project .thumb');
    const stage = Number(columnStage.value);
    const villaTarget = villaHandle === 'section' ? villaIdentity : villaHandle ? villaSketch : null;
    const galleryId = villaTarget ?? handle?.dataset.editorGalleryHandle ?? (!text && photo && draft.page === 'home'
      ? stage === 0 ? horizontalGallery : stage >= verticalStage && stage < 76 ? verticalGallery : null
      : null);
    const node = galleryId ? editable.get(galleryId)?.[0]?.node : text;
    if (!node || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    finishDrag();
    select(galleryId ?? node.dataset.editorText);
    page.defaultView.focus();
    page.documentElement.classList.add('editor-aligning');
    const offsets = draft[view][selected] ?? {};
    const rect = node.getBoundingClientRect();
    const scale = designScale(page);
    drag = {
      node,
      rect,
      edge: villaHandle,
      villaHandle,
      width: rect.width / scale,
      height: rect.height / scale,
      locked: offsets.locked === true,
      scrollX: page.defaultView.scrollX,
      scrollY: page.defaultView.scrollY,
      locks: {},
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: clampOffset('x', currentPosition('x')),
      y: clampOffset('y', offsets.y ?? 0),
      moved: false,
    };
    if (villaHandle === 'section') {
      drag.minShift = Math.max(-700, Math.min(700, -villaIdentityClearance(page) - (offsets.marginBefore ?? 0)));
      drag.shift = Math.max(drag.minShift, offsets.shift ?? 0);
    }
    node.setPointerCapture(event.pointerId);
  }, true);

  page.addEventListener('pointermove', event => {
    if (drag?.pointer === event.pointerId) pointerUpdates.schedule(page, event);
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
function syncNuptiasField(key) {
  if (draft.page !== 'nuptias' || !isNuptiasPosition(selected)) return;
  const applied = Number(editable.get(selected)?.[0]?.node.dataset.nuptiasX);
  const requested = draft[view][selected]?.x ?? 0;
  const followTitle = isDesktopHeadingFollower() && !draft.desktop[selected]?.independentX;
  if (!followTitle && ['x', 'size', 'width', 'font', 'spacing', 'text'].includes(key) &&
      Number.isFinite(applied) && applied !== requested) {
    updateSetting(view, 'x', applied || undefined);
  }
  showNuptiasLimit();
}

const textUpdates = frameUpdate(input => {
  constrainNuptiasPositions(preview.contentDocument, editable, draft, view);
  syncNuptiasField('text');
  markDirty(input);
});

function editText(input) {
  const original = editable.get(selected)[0].text;
  const text = input.value === original ? undefined : input.value;
  if (text === draft.content[selected]?.text) return;
  updateSetting('content', 'text', text);
  applyElementText(editable, selected, draft);
  if (selected.startsWith('custom.')) element.selectedOptions[0].textContent = input.value.slice(0, 65) || 'Texto nuevo';
  textUpdates.schedule(input);
}

for (const input of fields) {
  input.addEventListener('input', () => {
    if (!selected || !input.validity.valid) return;
    const key = input.dataset.field;
    if (key === 'text') { editText(input); return; }
    textUpdates.flush();
    if ((homeGallery(selected) || (draft.page === 'nuptias' && isNuptiasPosition(selected)) || isDesktopHeadingFollower()) && (key === 'x' || key === 'y')) {
      if (input.value === '') {
        updateSetting(view, key, undefined);
        if (isDesktopHeadingFollower() && key === 'x') {
          updateSetting(view, 'independentX', undefined);
        }
      } else setPosition(key, input.valueAsNumber);
    }
    else if (input.type === 'number') {
      if (selected === villaSketch && ['width', 'height'].includes(key) && input.value !== '') {
        const node = editable.get(selected)[0].node;
        const rect = node.getBoundingClientRect();
        const scale = designScale(node.ownerDocument);
        const size = resizeVillaSketch({
          edge: key === 'width' ? 'e' : 's', width: rect.width / scale, height: rect.height / scale,
          locked: draft[view][selected]?.locked === true,
        }, key === 'width' ? input.valueAsNumber - rect.width / scale : 0,
        key === 'height' ? input.valueAsNumber - rect.height / scale : 0);
        updateSetting(view, key, size[key]);
        if (draft[view][selected].locked) {
          const other = key === 'width' ? 'height' : 'width';
          updateSetting(view, other, size[other]);
          fields.find(field => field.dataset.field === other).value = size[other];
        }
      } else {
        updateSetting(view, key, input.value === '' ? undefined : input.valueAsNumber);
      }
    } else updateSetting(view, key, input.value || undefined);
    apply(selected);
    syncNuptiasField(key);
    if (key === 'color') updateFields();
    markDirty(input);
  });
  input.addEventListener('blur', () => {
    textUpdates.flush();
    actions.closeGroup();
    if (!input.validity.valid || homeGallery(selected) || (draft.page === 'nuptias' && isNuptiasPosition(selected))) updateFields();
  });
}

villaImageSource.addEventListener('input', () => villaImageSource.setCustomValidity(''));
villaImageSource.addEventListener('change', () => {
  const original = editable.get(selected)?.[0]?.imageSource;
  if (!original || workspace.inert) return;
  const source = villaImageSource.value.trim();
  if (source && !villaImagePath(source)) {
    villaImageSource.setCustomValidity('Usa una ruta del portfolio o una URL HTTPS de imagen.');
    villaImageSource.reportValidity();
    return;
  }
  updateSetting('content', 'source', source && source !== original ? source : undefined);
  apply(selected);
  updateFields();
  markDirty();
});

villaImageAlt.addEventListener('change', () => {
  const original = editable.get(selected)?.[0];
  if (!original?.imageSource || workspace.inert) return;
  updateSetting('content', 'alt', villaImageAlt.value === original.imageAlt ? undefined : villaImageAlt.value);
  apply(selected);
  markDirty();
});

for (const input of villaInputs) {
  input.addEventListener('input', () => {
    if (!selected || workspace.inert || !input.validity.valid) return;
    const value = input.type === 'checkbox' ? input.checked || undefined
      : input.value === '' ? undefined
      : input.type === 'number' ? input.valueAsNumber : input.value;
    updateSetting(view, input.dataset.villaField, value);
    if (input.dataset.villaField === 'shift') find('villa-section-shift-value').textContent = `${value ?? 0} px`;
    apply(selected);
    markDirty(input);
  });
  input.addEventListener('blur', () => actions.closeGroup());
}

find('villa-reset-sketch-dimensions').addEventListener('click', () => {
  if (selected !== villaSketch || workspace.inert) return;
  for (const key of ['width', 'height', 'stretchX', 'stretchY', 'zoom']) updateSetting(view, key, undefined);
  apply(selected);
  updateFields();
  markDirty();
});

find('villa-add-photo').addEventListener('click', () => {
  find('villa-add-tools').hidden = !find('villa-add-tools').hidden;
  if (!find('villa-add-tools').hidden) villaNewSource.focus();
});
villaNewSource.addEventListener('input', () => villaNewSource.setCustomValidity(''));
find('villa-insert-photo').addEventListener('click', () => {
  if (draft.page !== villaPage || workspace.inert) return;
  const source = villaNewSource.value.trim();
  if (!villaImagePath(source)) {
    villaNewSource.setCustomValidity('Usa una ruta del portfolio o una URL HTTPS de imagen.');
    villaNewSource.reportValidity();
    return;
  }
  const id = `villa-image.added-${crypto.randomUUID()}`;
  draft.elements[id] = { type: 'image', source };
  villaNewSource.value = '';
  find('villa-add-tools').hidden = true;
  refreshElements();
  apply(id);
  select(id, true);
  markDirty();
});
find('villa-restore-decoration').addEventListener('click', () => {
  if (draft.page !== villaPage || !['swatch', 'decoration', 'rule'].includes(editable.get(selected)?.[0]?.villaKind)
      || !draft.elements[selected]?.hidden) return;
  delete draft.elements[selected];
  apply(selected);
  refreshElements();
  markDirty();
});
find('villa-restore-photo').addEventListener('click', () => {
  if (!editable.get(selected)?.[0]?.imageSource || !draft.elements[selected]?.hidden) return;
  delete draft.elements[selected];
  apply(selected);
  refreshElements();
  markDirty();
});

find('reset-color').addEventListener('click', () => {
  updateSetting(view, 'color', undefined);
  apply(selected);
  updateFields();
  markDirty();
});

for (const [id, layout] of [['nuptias-split', 'split'], ['nuptias-center', 'center']]) {
  find(id).addEventListener('click', () => {
    (draft[view][nuptiasEditorial] ??= {}).layout = layout;
    applyView(view);
    select(nuptiasEditorial, true);
    markDirty();
  });
}
find('nuptias-align-right').addEventListener('click', () => {
  const node = editable.get(selected)?.[0]?.node;
  if (!node || !isNuptiasPosition(selected)) return;
  keepNuptiasLayout();
  const [, edge] = nuptiasPositionBounds(node, 'x', view);
  setPosition('x', edge);
  apply(selected);
  showNuptiasLimit();
  updateFields();
  markDirty();
});

find('ayam-hide-text').addEventListener('click', () => {
  if (draft.page !== ayamPage || !selected) return;
  draft.elements[selected] = { ...draft.elements[selected], hidden: true };
  apply(selected);
  refreshElements();
  markDirty();
});
find('ayam-restore-text').addEventListener('click', () => {
  if (draft.page !== ayamPage || !draft.elements[selected]?.hidden) return;
  if (draft.elements[selected].type === 'text') delete draft.elements[selected].hidden;
  else delete draft.elements[selected];
  apply(selected);
  refreshElements();
  markDirty();
});
find('reset').addEventListener('click', () => {
  if (selected === nuptiasEditorial) {
    const layout = nuptiasLayout(draft, view);
    draft[view][selected] = { layout };
  } else delete draft[view][selected];
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
          : draft.page === villaPage && ['PGRST202', '22023', '23514'].includes(error.code)
            ? 'Ejecuta la migración de Villa Tiger en Supabase de Preview.'
          : draft.page === ayamPage && ['PGRST202', '22023', '23514'].includes(error.code)
            ? 'Si aún no lo has hecho, ejecuta la migración de AYAM en Supabase de Preview.'
            : draft.page === carnagePage && ['PGRST202', '22023', '23514'].includes(error.code)
            ? 'Si aún no lo has hecho, ejecuta la migración de Maison Carnage en Supabase de Preview.'
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
  if (publish) {
    status.textContent = 'Verificando la publicación…';
    try {
      await store.verifyPublication(draft.page, revision, draft);
    } catch {
      throw new Error(`El borrador #${revision} se guardó. No se pudo verificar que esa revisión esté disponible en la web pública. Puedes volver a pulsar Publicar cambios.`);
    }
  }
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

const pageControls = ['page', 'element', 'save', 'publish', 'export', 'import', 'add-text', 'viewport-width', 'viewport-height'];

function initializePreview() {
  const url = new URL(preview.contentDocument.URL);
  if (url.pathname !== pages[draft.page].path || !url.searchParams.has('editor-preview')) return;
  attach();
  if (draft.page === 'nuptias') gallery.attach(preview.contentDocument);
  if (draft.page === carnagePage) carnage.attach(preview.contentDocument);
  if (draft.page === ayamPage) ayam.attach(preview.contentDocument);
  applyView(view);
  if (new URLSearchParams(location.search).has('mobile-scroll') && draft.page === 'home') {
    changeColumnStage(24);
    find('column-tools').open = true;
  }
  status.textContent = `Editando ${pages[draft.page].label}.`;
  for (const id of pageControls) find(id).disabled = false;
  updateActionButtons();
}

async function showPage(page) {
  ({ draft, revision } = await store.load(page));
  actions.reset(draft);
  gallery.detach();
  carnage.detach();
  ayam.detach();
  finishDrag();
  guideLayer?.detach();
  guideLayer = undefined;
  pagePicker.value = page;
  find('villa-add-tools').hidden = true;
  villaIntroTools.hidden = true;
  villaNewSource.value = '';
  villaNewSource.setCustomValidity('');
  columnStage.value = '0';
  mobileScrollDrag = null;
  find('column-tools').hidden = true;
  ireTools.hidden = true;
  notEgoTools.hidden = true;
  irePreview.checked = false;
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
  const query = new URLSearchParams(location.search);
  const requestedPage = query.get('page');
  if (query.has('mobile-scroll')) {
    view = 'mobile';
    find('column-tools').open = true;
  }
  await showPage(Object.hasOwn(pages, requestedPage) ? requestedPage : 'home');
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

const carnage = setupCarnage({
  getDraft: () => draft,
  getView: () => view,
  markDirty,
  closeGroup: () => actions.closeGroup(),
  deselectText: () => select(''),
  isBusy: () => workspace.inert,
});

const ayam = setupAyam({
  getDraft: () => draft,
  getView: () => view,
  markDirty,
  closeGroup: () => actions.closeGroup(),
  deselectText: () => select(''),
  syncGallery: () => { refreshElements(); applyView(view); },
  isBusy: () => workspace.inert,
});

initialize();
