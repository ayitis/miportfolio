import { designScale } from '../portfolio/ayam-canvas.js';
import { frameUpdate } from './frame-update.js';
import { ayamFilm, ayamGeometry, ayamOrder, mediaPath } from '../portfolio/ayam-document.js';
import { ayamCrop, renderAyam, renderAyamCrop } from '../portfolio/ayam-layout.js';

export function setupAyam({ getDraft, getView, markDirty, closeGroup, deselectText, syncGallery, isBusy }) {
  const find = id => document.getElementById(`ayam-${id}`);
  const panel = find('tools');
  const picker = find('media');
  const inputs = [...panel.querySelectorAll('[data-ayam-field]')];
  let page;
  let selected = '';
  let drag;
  let cropMode = false;
  let wheelFrame;
  const cropFields = new Set(['cropX', 'cropY', 'zoom', 'fit']);

  const design = () => getDraft().ayam;
  const layout = () => design()[getView()];
  const item = () => layout().media?.[selected] ?? {};
  const nodes = () => [...page.querySelectorAll('[data-ayam-media]')];
  const assetOrder = () => ayamOrder([...page.querySelectorAll('[data-ayam-media]:not(#fashion-film)')]
    .map(node => node.dataset.ayamMedia), layout().order);
  const target = () => selected && page.querySelector(`[data-ayam-media="${selected}"]`);
  const message = text => { find('media-status').textContent = text; };

  function geometry(node) {
    const surface = node.querySelector('.story-image') ?? node;
    const scale = designScale(node.ownerDocument);
    return {
      x: Number(node.dataset.ayamX) || 0, y: Number(node.dataset.ayamY) || 0,
      width: Math.round(surface.getBoundingClientRect().width / scale),
      height: Math.round(surface.getBoundingClientRect().height / scale),
    };
  }

  function updateFields() {
    const node = target();
    const activeFrame = cropMode && node ? node.querySelector('.story-image') : undefined;
    if (activeFrame !== wheelFrame) {
      wheelFrame?.removeEventListener('wheel', wheel);
      wheelFrame = activeFrame;
      wheelFrame?.addEventListener('wheel', wheel, { passive: false });
    }
    find('properties').disabled = !node;
    if (!node) return;
    const current = item();
    const film = selected === ayamFilm;
    const hidden = Boolean(current.visibility);
    const dimensions = geometry(node);
    const crop = film ? null : ayamCrop(node.querySelector('img'), current);
    find('modes').hidden = film || hidden;
    find('zoom-tools').hidden = !cropMode || film || hidden;
    find('frame-mode').setAttribute('aria-pressed', String(!cropMode));
    find('crop-mode').setAttribute('aria-pressed', String(cropMode));
    find('zoom-value').value = `${crop?.zoom ?? 100} %`;
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
      else input.value = (!hidden && dimensions[key] !== undefined ? dimensions[key]
        : current[key] ?? ({ cropX: crop?.x, cropY: crop?.y, zoom: crop?.zoom })[key]) ?? '';
      input.disabled = hidden || (cropMode && !cropFields.has(key));
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
      node.toggleAttribute('data-ayam-crop-mode', cropMode && node.dataset.ayamMedia === selected);
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
    if (selected !== id) cropMode = false;
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
    if (settings.visibility) cropMode = false;
    if (Object.keys(settings).length) media[selected] = settings;
    else delete media[selected];
    message('');
    if (selected !== ayamFilm && Object.keys(patch).every(key => cropFields.has(key))) {
      renderAyamCrop(target().querySelector('img'), settings);
      updateFields();
    } else render(!group);
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
    if (!target() || !input.validity.valid || input.type === 'range') return;
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

  function setMode(crop) {
    if (!target() || selected === ayamFilm) return;
    cropMode = crop;
    target().toggleAttribute('data-ayam-crop-mode', crop);
    updateFields();
  }

  find('frame-mode').onclick = () => setMode(false);
  find('crop-mode').onclick = () => setMode(true);
  find('reset-crop').onclick = () => change({ cropX: undefined, cropY: undefined, zoom: undefined, fit: undefined });
  const zoomInput = panel.querySelector('[data-ayam-field="zoom"]');
  zoomInput.addEventListener('input', () => change({ zoom: zoomInput.valueAsNumber }, zoomInput));
  zoomInput.addEventListener('change', closeGroup);

  function wheel(event) {
    if (!cropMode || isBusy() || event.target.closest('.story-image')?.parentElement !== target()) return;
    event.preventDefault();
    if (!event.deltaY) return;
    const zoom = item().zoom ?? 100;
    const next = bound('zoom', zoom + Math.sign(-event.deltaY) * Math.max(2, Math.min(12, Math.abs(event.deltaY) * .18)));
    if (next !== zoom) change({ zoom: next });
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
    if (selected !== node.dataset.ayamMedia) select(node.dataset.ayamMedia);
    if (cropMode && !event.target.closest('.story-image')) return;
    event.preventDefault();
    page.defaultView.focus();
    drag = {
      id: event.pointerId, node, handle, clientX: event.clientX, clientY: event.clientY,
      scroll: page.defaultView.scrollY, ...geometry(node),
    };
    if (cropMode) {
      const image = node.querySelector('img');
      const { x, y, zoom, fit } = ayamCrop(image, item());
      const { width, height } = drag;
      const factors = [width / image.naturalWidth, height / image.naturalHeight];
      const factor = (fit === 'contain' ? Math.min(...factors) : Math.max(...factors)) * zoom / 100;
      drag.crop = image.naturalWidth ? {
        x, y, travelX: image.naturalWidth * factor - width,
        travelY: image.naturalHeight * factor - height,
      } : { x, y, travelX: 0, travelY: 0 };
    }
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
    if (drag.crop) {
      const { x, y, travelX, travelY } = drag.crop;
      const patch = {};
      if (Math.abs(travelX) >= 1) patch.cropX = bound('cropX', x - dx * 100 / travelX);
      if (Math.abs(travelY) >= 1) patch.cropY = bound('cropY', y - dy * 100 / travelY);
      if (Object.keys(patch).length) change(patch, drag);
      return;
    }
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
        [data-ayam-selected]:not([data-ayam-crop-mode]) [data-ayam-handle] { display: block; }
        [data-ayam-crop-mode] .story-image { cursor: grab; }
        [data-ayam-crop-mode] .story-image:active { cursor: grabbing; }
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
      cropMode = false;
      wheelFrame?.removeEventListener('wheel', wheel);
      wheelFrame = undefined;
      drag = undefined;
    },
  };
}
