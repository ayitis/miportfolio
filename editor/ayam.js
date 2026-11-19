import { designScale } from '../portfolio/ayam-canvas.js';
import { frameUpdate } from './frame-update.js';
import { ayamFilm, ayamGeometry, ayamOrder, mediaPath } from '../portfolio/ayam-document.js';
import { renderAyam } from '../portfolio/ayam-layout.js';

export function setupAyam({ getDraft, getView, markDirty, closeGroup, deselectText, syncGallery, isBusy }) {
  const find = id => document.getElementById(`ayam-${id}`);
  const panel = find('tools');
  const picker = find('media');
  const inputs = [...panel.querySelectorAll('[data-ayam-field]')];
  let page;
  let selected = '';
  let drag;

  const design = () => getDraft().ayam;
  const layout = () => design()[getView()];
  const item = () => layout().media?.[selected] ?? {};
  const nodes = () => [...page.querySelectorAll('[data-ayam-media]')];
  const assetOrder = () => ayamOrder([...page.querySelectorAll('[data-ayam-media]:not(#fashion-film)')]
    .map(node => node.dataset.ayamMedia), layout().order);
  const target = () => selected && page.querySelector(`[data-ayam-media="${selected}"]`);
  const message = text => { find('media-status').textContent = text; };

  function geometry(node) {
    const surface = node.querySelector('video, img');
    const scale = designScale(node.ownerDocument);
    return {
      x: Number(node.dataset.ayamX) || 0, y: Number(node.dataset.ayamY) || 0,
      width: Math.round(surface.getBoundingClientRect().width / scale),
      height: Math.round(surface.getBoundingClientRect().height / scale),
    };
  }

  function updateFields() {
    const node = target();
    find('properties').disabled = !node;
    if (!node) return;
    const current = item();
    const film = selected === ayamFilm;
    const hidden = Boolean(current.visibility);
    const dimensions = geometry(node);
    find('timing').hidden = !film;
    find('photo-actions').hidden = film;
    find('source').setAttribute('list', film ? 'ayam-videos' : 'ayam-images');
    find('restore').hidden = !hidden;
    find('hide').disabled = hidden;
    find('remove').disabled = current.visibility === 'removed';
    const order = assetOrder();
    find('earlier').disabled = order.indexOf(selected) <= 0;
    find('later').disabled = order.indexOf(selected) === order.length - 1;
    for (const input of inputs) {
      const key = input.dataset.ayamField;
      if (input.type === 'checkbox') input.checked = Boolean(current[key]);
      else input.value = (!hidden && dimensions[key] !== undefined ? dimensions[key] : current[key]) ?? '';
      input.disabled = hidden;
    }
  }

  function render(updatePicker = true) {
    if (!page) return;
    renderAyam(page, getDraft(), getView());
    if (updatePicker) {
      picker.options.length = 1;
      for (const node of nodes()) {
        const id = node.dataset.ayamMedia;
        const visibility = layout().media?.[id]?.visibility;
        const image = node.querySelector('img');
        const label = id === ayamFilm ? 'Fashion film' : image.getAttribute('src').split(/[?#]/)[0].split('/').at(-1);
        picker.add(new Option(label + (visibility ? ' · fuera de la galería' : ''), id));
      }
      if (![...picker.options].some(option => option.value === selected)) selected = '';
      picker.value = selected;
    }
    for (const node of nodes()) {
      node.toggleAttribute('data-ayam-selected', node.dataset.ayamMedia === selected);
      if (node.querySelector('[data-ayam-handle]')) continue;
      const mediaFrame = node.querySelector('.story-image') ?? node;
      for (const corner of ['nw', 'ne', 'sw', 'se']) {
        const handle = page.createElement('span');
        handle.dataset.ayamHandle = corner;
        handle.setAttribute('aria-hidden', 'true');
        mediaFrame.append(handle);
      }
    }
    updateFields();
  }

  function select(id, reveal = false) {
    if (!page) return;
    selected = id;
    if (id) {
      deselectText();
      panel.open = true;
    }
    message('');
    render();
    if (reveal && target() && !target().hidden) target().scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  function change(patch, group) {
    if (!selected || isBusy()) return;
    const settings = { ...item() };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete settings[key];
      else settings[key] = value;
    }
    if (settings.end !== undefined && settings.end <= (settings.start ?? 0)) {
      updateFields();
      message('El final debe quedar después del inicio.');
      return;
    }
    const media = layout().media ??= {};
    if (Object.keys(settings).length) media[selected] = settings;
    else delete media[selected];
    message('');
    render(!group);
    markDirty(group);
  }

  function bound(key, value) {
    const [min, max] = ayamGeometry[key];
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  function size(width, height, ratio, axis) {
    if (ratio) {
      if (axis === 'height') width = height * ratio;
      const limit = Math.min(4000, target().parentElement.clientWidth, 4000 * ratio);
      width = Math.min(limit, Math.max(16, 16 * ratio, width));
      height = width / ratio;
    }
    return { width: bound('width', width), height: bound('height', height) };
  }

  for (const input of inputs) input.addEventListener('change', () => {
    if (!target() || !input.validity.valid) return;
    const key = input.dataset.ayamField;
    const value = input.type === 'checkbox' ? input.checked || undefined
      : input.value === '' ? undefined : input.type === 'number' ? input.valueAsNumber : input.value.trim();
    if (value !== undefined && ['poster', 'source'].includes(key) && !mediaPath(value, key === 'source' && selected === ayamFilm)) {
      message('Usa una ruta del repositorio que empiece por / o una URL HTTPS directa a un archivo compatible.');
      return;
    }
    if (item().locked && value !== undefined && ['width', 'height'].includes(key)) {
      const { width, height } = geometry(target());
      change(size(key === 'width' ? value : width, key === 'height' ? value : height, width / height, key));
    } else change({ [key]: value });
  });

  function reorder(delta) {
    const order = assetOrder();
    const from = order.indexOf(selected);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    layout().order = order;
    render();
    markDirty();
  }

  picker.addEventListener('change', () => select(picker.value, true));
  find('earlier').onclick = () => reorder(-1);
  find('later').onclick = () => reorder(1);
  find('hide').onclick = () => change({ visibility: 'hidden' });
  find('remove').onclick = () => change({ visibility: 'removed' });
  find('restore').onclick = () => change({ visibility: undefined });
  find('reset-size').onclick = () => change({ width: undefined, height: undefined });
  function showPoster(show) {
    page.querySelector('#fashion-film').toggleAttribute('data-ayam-preview-poster', show);
    find('preview-poster').setAttribute('aria-pressed', String(show));
    find('preview-poster').textContent = show ? 'Volver al vídeo' : 'Ver portada';
  }
  find('restart').onclick = () => {
    showPoster(false);
    page.dispatchEvent(new CustomEvent('portfolio:ayam-restart'));
  };
  find('preview-poster').onclick = () => showPoster(!page.querySelector('#fashion-film').hasAttribute('data-ayam-preview-poster'));
  find('add').onclick = () => {
    if (isBusy()) return;
    const input = find('new-photo');
    const path = input.value.trim();
    if (!mediaPath(path)) {
      message('Indica una ruta de imagen del repositorio o una URL HTTPS directa.');
      return;
    }
    if (Object.keys(design().assets).length >= 150) {
      message('Se ha alcanzado el límite de fotografías añadidas.');
      return;
    }
    const id = `photo-${crypto.randomUUID()}`;
    design().assets[id] = path;
    input.value = '';
    syncGallery();
    select(id, true);
    markDirty();
  };

  function start(event) {
    if (isBusy() || event.button !== 0 || !event.isPrimary || event.target.closest('[data-editor-text]')) return;
    const node = event.target.closest('[data-ayam-media]');
    if (!node) return;
    const handle = event.target.dataset.ayamHandle;
    select(node.dataset.ayamMedia);
    event.preventDefault();
    page.defaultView.focus();
    drag = {
      id: event.pointerId, node, handle, clientX: event.clientX, clientY: event.clientY,
      scroll: page.defaultView.scrollY, ...geometry(node),
    };
    node.setPointerCapture(event.pointerId);
  }

  function move(event) {
    if (drag?.id !== event.pointerId || isBusy()) return;
    const { handle, x, y, width, height } = drag;
    const scale = designScale(page);
    const dx = (event.clientX - drag.clientX) / scale;
    const dy = (event.clientY - drag.clientY + page.defaultView.scrollY - drag.scroll) / scale;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
    drag.moved = true;
    if (!handle) {
      change({ x: bound('x', x + dx), y: bound('y', y + dy) }, drag);
      return;
    }
    const west = handle.includes('w');
    const north = handle.includes('n');
    const next = size(width + dx * (west ? -1 : 1), height + dy * (north ? -1 : 1),
      item().locked ? width / height : 0, Math.abs(dx / width) >= Math.abs(dy / height) ? 'width' : 'height');
    change({ ...next, x: bound('x', x + (west ? width - next.width : 0)), y: bound('y', y + (north ? height - next.height : 0)) }, drag);
  }

  const pointerUpdates = frameUpdate(move);

  function finish(event) {
    if (drag?.id !== event.pointerId) return;
    pointerUpdates.flush();
    drag = undefined;
    closeGroup();
  }

  return {
    render,
    clear() { if (page && selected) select(''); },
    attach(framePage) {
      page = framePage;
      showPoster(false);
      panel.hidden = false;
      const style = page.createElement('style');
      style.textContent = `
        [data-ayam-media] { cursor: move; }
        [data-ayam-media] .story-image { position: relative; }
        #fashion-film[data-ayam-preview-poster] video { opacity: 0; }
        [data-ayam-media] img, [data-ayam-media] video { user-select: none; -webkit-user-drag: none; }
        [data-ayam-selected] { touch-action: none; }
        #fashion-film[data-ayam-selected], [data-ayam-selected] .story-image {
          outline: 2px solid #9661e8; outline-offset: -2px;
        }
        [data-ayam-handle] { display: none; position: absolute; z-index: 8; width: 14px; height: 14px; border: 2px solid #7133c4; background: #fff; }
        [data-ayam-selected] [data-ayam-handle] { display: block; }
        [data-ayam-handle="nw"] { top: 0; left: 0; cursor: nwse-resize; }
        [data-ayam-handle="ne"] { top: 0; right: 0; cursor: nesw-resize; }
        [data-ayam-handle="sw"] { bottom: 0; left: 0; cursor: nesw-resize; }
        [data-ayam-handle="se"] { bottom: 0; right: 0; cursor: nwse-resize; }
      `;
      page.head.append(style);
      page.addEventListener('pointerdown', start);
      page.addEventListener('pointermove', event => {
        if (drag?.id === event.pointerId) pointerUpdates.schedule(event);
      });
      page.addEventListener('lostpointercapture', finish);
      render();
    },
    detach() {
      panel.hidden = true;
      panel.open = false;
      page = undefined;
      selected = '';
      drag = undefined;
    },
  };
}
