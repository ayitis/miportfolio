import { designScale } from './ayam-canvas.js';
import { ayamFilm, ayamOrder } from './ayam-document.js';
import { collectElements } from './render-design.js';

const instances = new WeakMap();
function collect(page) {
  if (instances.has(page)) return instances.get(page);
  const grid = page.querySelector('.ayam-news');
  const film = page.querySelector('#fashion-film');
  const original = [...grid.querySelectorAll('figure[data-ayam-media]')];
  const originalIds = original.map(node => node.dataset.ayamMedia);
  const slots = [...grid.children].map(node => node.matches('figure') ? null : node);
  const storyClasses = original.map(node => node.className);
  const media = new Map(original.map(node => [node.dataset.ayamMedia, {
    node, frame: node.querySelector('.story-image'), image: node.querySelector('img'), source: node.querySelector('img').getAttribute('src'),
  }]));
  media.set(ayamFilm, {
    node: film, image: film.querySelector('img'), video: film.querySelector('video'),
    poster: film.querySelector('img').getAttribute('src'),
    source: film.querySelector('source').getAttribute('src'),
  });
  const state = { grid, originalIds, slots, storyClasses, media };
  instances.set(page, state);
  return state;
}

export function syncAyamNodes(page, design, editable) {
  const { grid, media, originalIds } = collect(page);
  for (const [id, item] of media) {
    if (id === ayamFilm || originalIds.includes(id) || Object.hasOwn(design.ayam.assets, id)) continue;
    item.node.remove();
    media.delete(id);
    editable.delete(`caption.${id}`);
    editable.delete(`caption-title.${id}`);
    editable.delete(`caption-description.${id}`);
  }
  for (const [id, source] of Object.entries(design.ayam.assets)) {
    if (media.has(id)) continue;
    const node = page.createElement('figure');
    node.dataset.ayamMedia = id;
    node.dataset.ayamAdded = '';
    const image = page.createElement('img');
    image.alt = 'AYAM — campaign photograph';
    image.loading = 'lazy';
    const frame = page.createElement('div');
    frame.className = 'story-image';
    const reveal = page.createElement('div');
    reveal.className = 'story-reveal';
    reveal.append(image);
    frame.append(reveal);
    const caption = page.createElement('figcaption');
    const line = page.createElement('span');
    line.textContent = 'Campaign image';
    caption.append(line);
    node.append(frame, caption);
    grid.append(node);
    media.set(id, { node, frame, image, source });
  }
  const captions = [...media.keys()].filter(id => id !== ayamFilm && !editable.has(`caption.${id}`))
    .flatMap(id => [
      [`caption.${id}`, '', `[data-ayam-media="${id}"] figcaption span`, { inline: true }],
      [`caption-title.${id}`, '', `[data-ayam-media="${id}"] figcaption strong`, {}],
      [`caption-description.${id}`, '', `[data-ayam-media="${id}"] figcaption p`, {}],
    ]);
  for (const [id, entries] of collectElements(page, captions)) editable.set(id, entries);
}

function setSource(image, source) {
  if (image.getAttribute('src') !== source) image.setAttribute('src', source);
}

export function ayamCrop(image, saved) {
  const manual = saved.cropX !== undefined || saved.cropY !== undefined;
  return {
    x: saved.cropX ?? 50,
    y: saved.cropY ?? (manual ? 50 : (parseFloat(image.style.getPropertyValue('--ayam-crop-y')) || 43)),
    zoom: saved.zoom ?? 100,
    fit: saved.fit ?? 'cover',
  };
}

export function renderAyamCrop(image, saved) {
  const { x, y, zoom } = ayamCrop(image, saved);
  image.style.objectFit = saved.fit ?? '';
  const position = `${x}% ${y}%`;
  image.style.objectPosition = saved.cropX === undefined && saved.cropY === undefined ? '' : position;
  image.style.transformOrigin = zoom === 100 ? '' : position;
  image.style.transform = zoom === 100 ? '' : `scale(${zoom / 100})`;
}

export function renderAyam(page, design, view) {
  const { grid, slots, storyClasses, media, originalIds } = collect(page);
  const layout = design.ayam[view];
  const order = ayamOrder([...originalIds, ...Object.keys(design.ayam.assets).filter(id => !originalIds.includes(id))], layout.order);
  const nodes = order.map(id => media.get(id)?.node).filter(Boolean);
  for (const [i, node] of nodes.entries()) {
    node.className = storyClasses[i] ?? '';
    node.toggleAttribute('data-ayam-added', i >= storyClasses.length);
  }
  const desired = slots.map(slot => slot ?? nodes.shift()).filter(Boolean).concat(nodes);
  desired.forEach((node, i) => {
    if (grid.children[i] !== node) grid.insertBefore(node, grid.children[i] ?? null);
  });
  const galleryWidth = grid.clientWidth;
  for (const [id, item] of media) {
    const { node, frame, image, video } = item;
    const saved = layout.media?.[id] ?? {};
    const film = id === ayamFilm;
    node.hidden = Boolean(saved.visibility);
    const availableWidth = film ? node.parentElement.clientWidth : galleryWidth;
    node.style.width = saved.width === undefined ? '' : `${Math.min(saved.width, availableWidth)}px`;
    node.style.zIndex = saved.layer ?? '';
    if (film) {
      node.style.height = saved.height === undefined ? '' : `${saved.height}px`;
      node.style.minHeight = saved.height === undefined ? '' : '0';
      setSource(image, saved.poster ?? item.poster);
      page.dispatchEvent(new CustomEvent('portfolio:ayam-film', {
        detail: { source: saved.source ?? item.source, start: saved.start, end: saved.end },
      }));
    } else {
      frame.style.height = saved.height === undefined ? '' : `${saved.height}px`;
      frame.style.aspectRatio = saved.height === undefined ? '' : 'auto';
      setSource(image, saved.source ?? design.ayam.assets[id] ?? item.source);
    }
    if (!film) renderAyamCrop(image, saved);
    for (const surface of film ? [image, video] : []) {
      surface.style.objectFit = saved.fit ?? '';
      surface.style.objectPosition = saved.cropX === undefined && saved.cropY === undefined
        ? '' : `${saved.cropX ?? 50}% ${saved.cropY ?? 50}%`;
    }
    node.style.translate = '';
  }
  // Measure the natural gallery height without previously reserved blank space.
  // Only reserve room if a translated photo actually extends past the gallery.
  grid.style.paddingBottom = '';
  const galleryBounds = grid.getBoundingClientRect();
  const scale = designScale(page);
  let reserve = 0;
  for (const [id, { node }] of media) {
    if (node.hidden) continue;
    const film = id === ayamFilm;
    const saved = layout.media?.[id] ?? {};
    const rect = node.getBoundingClientRect();
    const boundary = film ? node.parentElement.getBoundingClientRect() : galleryBounds;
    const x = Math.max(Math.ceil((boundary.left - rect.left) / scale - .01),
      Math.min(Math.floor((boundary.right - rect.right) / scale + .01), saved.x ?? 0));
    const y = saved.y ?? 0;
    node.dataset.ayamX = x;
    node.dataset.ayamY = y;
    if (x || y) node.style.translate = `${x}px ${y}px`;
    if (!film) reserve = Math.max(reserve, Math.ceil((rect.bottom - galleryBounds.bottom) / scale + y));
  }
  grid.style.paddingBottom = reserve ? `${reserve}px` : '';
}
