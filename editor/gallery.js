import { maxPhotoBytes, maxUploads, uploadTypes, visiblePhoto } from '../portfolio/gallery-document.js';
import { photoLinkLifetime } from '../portfolio/gallery-storage.js';
import { collectGallery, galleryEntries, renderGallery } from '../portfolio/render-gallery.js';

export function setupGallery({ getDraft, getView, getStore, runAction, markDirty, closeGroup, deselectText, selectionChanged, status, isBusy }) {
  const find = id => document.getElementById(id);
  const panel = find('gallery-tools');
  const picker = find('photo-picker');
  const settings = find('photo-settings');
  const fileInput = find('photo-file');
  const pause = find('photo-pause');
  const buttons = Object.fromEntries(['up', 'down', 'hide', 'remove', 'restore'].map(action => [action, find('photo-' + action)]));
  const fields = [...panel.querySelectorAll('[data-photo-field]')];
  const localUrls = new Map();
  let signedUrls = new Map();
  let model;
  let selected = '';
  let dragging = '';
  let paused = false;
  let refresh;
  let signing = 0;

  const draftGallery = () => getDraft().gallery;
  const entries = () => galleryEntries(model, draftGallery());

  function refreshFields(ids) {
    const state = draftGallery().photos[selected]?.state;
    settings.disabled = !selected;
    buttons.hide.hidden = Boolean(state);
    buttons.remove.hidden = Boolean(state);
    buttons.restore.hidden = !state;
    const index = ids.indexOf(selected);
    buttons.up.disabled = index <= 0;
    buttons.down.disabled = index < 0 || index >= ids.length - 1;
    for (const field of fields) field.value = draftGallery().photos[selected]?.[getView()]?.[field.dataset.photoField] ?? '';
  }

  function highlight() {
    for (const photo of model.track.querySelectorAll('[data-editor-photo]')) {
      photo.toggleAttribute('data-editor-photo-selected', photo.dataset.editorPhoto === selected);
    }
  }

  function select(id) {
    if (!model) return;
    if (id) {
      deselectText();
      panel.open = true;
    }
    selected = id;
    picker.value = id;
    highlight();
    refreshFields(entries());
    selectionChanged();
  }

  function render({ list = true } = {}) {
    if (!model) return;
    const gallery = draftGallery();
    const ids = entries();
    if (!ids.includes(selected)) selected = '';
    const urls = new Map([...signedUrls, ...localUrls]);
    renderGallery(model, gallery, getView(), urls, true);
    if (list) {
      picker.options.length = 1;
      for (const id of ids) {
        const state = gallery.photos[id]?.state;
        const source = gallery.copies[id] ?? id;
        const name = model.originals.get(source)?.name.replace('NUPTIAS editorial photograph', 'Fotografía') ?? gallery.uploads[source].name;
        const label = gallery.copies[id] ? name + ' · copia' : name;
        const suffix = state === 'removed' ? ' · retirada' : state === 'hidden' ? ' · oculta' : !model.originals.has(source) && !urls.has(source) ? ' · sin vista previa' : '';
        picker.add(new Option(label + suffix, id));
      }
      picker.value = selected;
      refreshFields(ids);
    }
    highlight();
  }

  async function reloadUploads() {
    const current = model;
    if (!current) return;
    const version = ++signing;
    const ids = Object.keys(draftGallery().uploads);
    try {
      const urls = await getStore().photoUrls(ids);
      if (model !== current || signing !== version) return;
      signedUrls = urls;
      render();
      if (ids.some(id => !urls.has(id) && !localUrls.has(id))) {
        status.textContent = 'Algunas subidas no están disponibles en el Storage de este proyecto.';
      }
    } catch {
      if (model === current && signing === version) status.textContent = 'No se pudieron cargar las fotografías subidas. Revisa la configuración de Storage.';
    }
  }

  function change(action) {
    action(draftGallery());
    render();
    markDirty();
  }

  function move(from, to, after = false) {
    const ids = entries().filter(id => id !== from);
    const index = ids.indexOf(to);
    if (from === to || index < 0) return;
    ids.splice(index + Number(after), 0, from);
    change(gallery => { gallery.order = ids; });
  }

  function setState(state) {
    if (!selected) return;
    change(gallery => {
      const photo = gallery.photos[selected] ??= {};
      if (state) photo.state = state;
      else delete photo.state;
    });
  }

  picker.addEventListener('change', () => select(picker.value));
  buttons.hide.addEventListener('click', () => setState('hidden'));
  buttons.remove.addEventListener('click', () => setState('removed'));
  buttons.restore.addEventListener('click', () => setState());
  buttons.up.addEventListener('click', () => move(selected, entries()[entries().indexOf(selected) - 1]));
  buttons.down.addEventListener('click', () => move(selected, entries()[entries().indexOf(selected) + 1], true));
  pause.addEventListener('click', () => {
    paused = !paused;
    pause.setAttribute('aria-pressed', String(paused));
    pause.textContent = paused ? 'Reanudar galería' : 'Pausar galería';
    model.track.classList.toggle('editor-photo-paused', paused);
  });
  for (const field of fields) {
    field.addEventListener('input', () => {
      if (!selected || !field.validity.valid) return;
      const photo = draftGallery().photos[selected] ??= {};
      const frame = photo[getView()] ??= {};
      if (field.value === '') delete frame[field.dataset.photoField];
      else frame[field.dataset.photoField] = field.valueAsNumber;
      render({ list: false });
      markDirty(field);
    });
    field.addEventListener('blur', () => {
      closeGroup();
      if (!field.validity.valid) refreshFields(entries());
    });
  }

  fileInput.addEventListener('change', runAction(async () => {
    const file = fileInput.files[0];
    if (!file || !model) return;
    try {
      if (!Object.hasOwn(uploadTypes, file.type) || !file.size || file.size > maxPhotoBytes) {
        throw new Error('Elige un JPG, PNG, WebP o AVIF de hasta 10 MB.');
      }
      if (Object.keys(draftGallery().uploads).length >= maxUploads) throw new Error('Esta galería admite hasta 100 subidas.');
      const id = `upload:${crypto.randomUUID()}.${uploadTypes[file.type]}`;
      status.textContent = 'Subiendo fotografía…';
      try {
        await getStore().uploadPhoto(id, file);
      } catch (error) {
        if (error.status === 400 || error.status === 403 || error.status === 404) {
          throw new Error('No se pudo subir la fotografía. Comprueba que la migración de Storage está aplicada en Preview.');
        }
        throw error;
      }
      localUrls.set(id, URL.createObjectURL(file));
      change(gallery => {
        gallery.uploads[id] = { name: file.name.trim().slice(0, 180) || 'Fotografía subida' };
        gallery.order = [id, ...entries().filter(existing => existing !== id)];
      });
      select(id);
      status.textContent = 'Fotografía subida. Guarda el borrador para conservarla en la galería.';
    } finally {
      fileInput.value = '';
    }
  }));

  function detach() {
    model = null;
    selected = '';
    dragging = '';
    paused = false;
    pause.setAttribute('aria-pressed', 'false');
    pause.textContent = 'Pausar galería';
    panel.hidden = true;
    panel.open = false;
    clearInterval(refresh);
    for (const url of localUrls.values()) URL.revokeObjectURL(url);
    localUrls.clear();
    signedUrls.clear();
  }

  function attach(page) {
    model = collectGallery(page);
    if (!model) return;
    panel.hidden = false;
    const { track } = model;
    const figureAt = event => event.target.closest('[data-editor-photo]');
    const style = page.createElement('style');
    style.textContent = `
      [data-editor-photo] { cursor: grab; }
      [data-editor-photo-selected], [data-editor-photo-drop] { outline: 3px solid #9661e8; outline-offset: -3px; }
      .editor-photo-paused, .editor-photo-dragging { animation-play-state: paused !important; }
    `;
    page.head.append(style);
    track.addEventListener('click', event => {
      if (!isBusy()) select(figureAt(event)?.dataset.editorPhoto ?? '');
    });
    track.addEventListener('dragstart', event => {
      const photo = figureAt(event);
      if (!photo || isBusy()) {
        event.preventDefault();
        return;
      }
      dragging = photo.dataset.editorPhoto;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', dragging);
      track.classList.add('editor-photo-dragging');
      select(dragging);
    });
    track.addEventListener('dragover', event => {
      if (!dragging || !figureAt(event) || isBusy()) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      for (const photo of track.querySelectorAll('[data-editor-photo-drop]')) photo.removeAttribute('data-editor-photo-drop');
      figureAt(event).setAttribute('data-editor-photo-drop', '');
    });
    const endDrag = () => {
      dragging = '';
      track.classList.remove('editor-photo-dragging');
      for (const photo of track.querySelectorAll('[data-editor-photo-drop]')) photo.removeAttribute('data-editor-photo-drop');
    };
    track.addEventListener('drop', event => {
      const photo = figureAt(event);
      if (!dragging || !photo || isBusy()) return;
      event.preventDefault();
      const { left, width } = photo.getBoundingClientRect();
      move(dragging, photo.dataset.editorPhoto, event.clientX > left + width / 2);
      endDrag();
    });
    page.addEventListener('dragend', endDrag);
    render();
    reloadUploads();
    refresh = setInterval(reloadUploads, (photoLinkLifetime - 60) * 1000);
  }

  function capturePhoto() {
    if (!model || !selected) return;
    const gallery = draftGallery();
    const photo = gallery.photos[selected];
    return {
      type: 'photo',
      source: gallery.copies[selected] ?? selected,
      original: selected,
      settings: { ...(photo?.desktop && { desktop: { ...photo.desktop } }), ...(photo?.mobile && { mobile: { ...photo.mobile } }) },
    };
  }

  function pastePhoto(copy) {
    if (!model) return false;
    const gallery = draftGallery();
    if (!model.originals.has(copy.source) && !Object.hasOwn(gallery.uploads, copy.source)) {
      status.textContent = 'La fotografía de origen no está en este borrador.';
      return false;
    }
    const id = 'copy:' + crypto.randomUUID();
    change(current => {
      const order = entries();
      const anchor = order.indexOf(copy.original);
      order.splice(anchor < 0 ? order.length : anchor + 1, 0, id);
      current.order = order;
      current.copies[id] = copy.source;
      if (Object.keys(copy.settings).length) current.photos[id] = structuredClone(copy.settings);
    });
    select(id);
    return true;
  }

  function removeSelected() {
    if (!model || !selected || !visiblePhoto(draftGallery(), selected)) return false;
    setState('removed');
    return true;
  }

  return { render, attach, detach, select, reloadUploads, removeSelected, capturePhoto, pastePhoto, get hasSelection() { return Boolean(selected); } };
}
