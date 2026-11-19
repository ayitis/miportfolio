import { visiblePhoto } from './gallery-document.js';

export function collectGallery(page) {
  const track = page.querySelector('.marquee-track');
  if (!track) return null;
  const groups = [...track.querySelectorAll('.photo-group')];
  const originals = new Map();
  groups.forEach((group, index) => {
    for (const figure of group.querySelectorAll('.photo')) {
      const img = figure.querySelector('img');
      const id = 'repo:' + decodeURIComponent(img.getAttribute('src'));
      if (!originals.has(id)) originals.set(id, { name: img.alt, figures: [] });
      originals.get(id).figures[index] = figure;
    }
  });
  return { track, groups, originals, additions: new Map() };
}

export function galleryEntries(model, gallery) {
  const ids = [...new Set([...gallery.order, ...model.originals.keys(), ...Object.keys(gallery.uploads)])];
  return ids.filter(id => model.originals.has(id) || Object.hasOwn(gallery.uploads, id));
}

export function renderGallery(model, gallery, view, urls, editing = false) {
  const { track, groups, originals, additions } = model;
  const ids = galleryEntries(model, gallery).filter(id => visiblePhoto(gallery, id) && (originals.has(id) || urls.has(id)));
  track.closest('.marquee').hidden = ids.length === 0;
  for (const id of additions.keys()) {
    if (!Object.hasOwn(gallery.uploads, id)) additions.delete(id);
  }
  groups.forEach((group, index) => {
    const figures = ids.map(id => {
      let figure = originals.get(id)?.figures[index];
      if (!figure) {
        if (!additions.has(id)) additions.set(id, []);
        const copies = additions.get(id);
        if (!copies[index]) {
          figure = group.ownerDocument.createElement('figure');
          figure.className = 'photo';
          const photo = group.ownerDocument.createElement('img');
          photo.decoding = 'async';
          photo.loading = 'lazy';
          photo.draggable = false;
          figure.append(photo);
          copies[index] = figure;
        }
        figure = copies[index];
        const photo = figure.firstElementChild;
        photo.alt = index === 0 ? gallery.uploads[id].name : '';
        if (photo.getAttribute('src') !== urls.get(id)) photo.src = urls.get(id);
      }
      const size = gallery.photos[id]?.[view] ?? {};
      const img = figure.firstElementChild;
      figure.style.width = size.width === undefined ? '' : `min(${size.width}px, 92vw)`;
      figure.style.height = size.height === undefined ? '' : `${size.height}px`;
      figure.style.minHeight = size.height === undefined ? '' : '0';
      figure.style.maxHeight = size.height === undefined ? '' : 'none';
      img.style.objectPosition = size.x !== undefined || size.y !== undefined ? `${size.x ?? 50}% ${size.y ?? 50}%` : '';
      if (editing) {
        figure.dataset.editorPhoto = id;
        figure.draggable = true;
      }
      return figure;
    });
    const current = [...group.children];
    if (figures.length !== current.length || figures.some((figure, i) => figure !== current[i])) {
      group.replaceChildren(...figures);
    }
  });
}
