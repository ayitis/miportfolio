import { carnageBounds, carnageOrder } from '../portfolio/carnage-document.js';

export function setupCarnage({ getDraft, getView, markDirty, closeGroup, deselectText, isBusy }) {
  const find = name => document.getElementById(`carnage-${name}`);
  const tools = find('tools');
  const picker = find('photo');
  const slider = find('progress');
  const inputs = [...tools.querySelectorAll('[data-carnage-field]')];
  let page;
  let cards = new Map();
  let selected = '';
  let gesture;
  let progress = 0;

  const settings = () => getDraft().carnage[getView()];
  const options = () => settings().photos?.[selected] ?? {};
  const ordered = () => carnageOrder([...cards.keys()], settings());
  const card = () => cards.get(selected);
  const geometry = (key) => Number(card().dataset[`photo${key[0].toUpperCase()}${key.slice(1)}`]);
  const send = (name, detail) => page.dispatchEvent(new CustomEvent(`portfolio:carnage-${name}`, { detail }));

  function syncFields() {
    const active = Boolean(card());
    find('settings').disabled = !active;
    if (!active) return;
    const current = options();
    const hidden = Boolean(current.visibility);
    const order = ordered();
    find('earlier').disabled = order.indexOf(selected) === 0;
    find('later').disabled = order.indexOf(selected) === order.length - 1;
    const visible = order.filter(id => !settings().photos?.[id]?.visibility);
    const preferred = settings().cover ?? cards.keys().next().value;
    const primary = visible.includes(preferred) ? preferred : visible[0];
    find('cover').disabled = hidden || selected === primary;
    find('hide').disabled = hidden;
    find('remove').disabled = current.visibility === 'removed';
    find('restore').hidden = !hidden;
    find('ratio').checked = Boolean(current.lockRatio);
    for (const input of inputs) {
      const key = input.dataset.carnageField;
      const fallback = key === 'layer' ? 1 : key.startsWith('crop') ? 50 : geometry(key);
      input.value = !hidden && Number.isFinite(fallback) && ['x', 'y', 'width', 'height'].includes(key)
        ? Math.round(fallback) : (current[key] ?? (Number.isFinite(fallback) ? Math.round(fallback) : ''));
      input.disabled = hidden;
    }
  }

  function render(updatePicker = true) {
    if (!page) return;
    send('design', { view: getView(), settings: settings() });
    if (updatePicker) {
      picker.options.length = 1;
      for (const id of ordered()) {
        const visibility = settings().photos?.[id]?.visibility;
        const suffix = visibility === 'removed' ? ' · retirada' : visibility === 'hidden' ? ' · oculta' : '';
        picker.add(new Option(cards.get(id).dataset.original + suffix, id));
      }
      picker.value = selected;
    }
    syncFields();
  }

  function select(id, reveal = false) {
    if (id && !cards.has(id)) return;
    card()?.removeAttribute('data-carnage-selected');
    selected = id;
    picker.value = id;
    if (id) {
      deselectText();
      tools.open = true;
      card().setAttribute('data-carnage-selected', '');
      if (reveal && !options().visibility) {
        if (progress < 1) send('jump', 1);
        card().scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      }
    }
    syncFields();
  }

  function change(patch, group) {
    const photos = settings().photos ??= {};
    const photo = photos[selected] ??= {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete photo[key];
      else photo[key] = value;
    }
    if (!Object.keys(photo).length) delete photos[selected];
    render(!group);
    markDirty(group);
  }

  function bounded(key, value) {
    const [min, max] = carnageBounds[key];
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  function resize(width, height, ratio, primary = 'width') {
    const maxWidth = Math.min(carnageBounds.width[1], card().parentElement.clientWidth);
    if (ratio) {
      if (primary === 'height') width = height * ratio;
      width = Math.max(16, 16 * ratio, Math.min(maxWidth, 4000 * ratio, width));
      height = width / ratio;
    }
    return { width: bounded('width', Math.min(maxWidth, width)), height: bounded('height', height) };
  }

  function moveOrder(delta) {
    const order = ordered();
    const index = order.indexOf(selected);
    const next = index + delta;
    if (next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    settings().order = order;
    render();
    markDirty();
  }

  for (const button of tools.querySelectorAll('[data-carnage-phase]')) {
    button.addEventListener('click', () => send('jump', Number(button.dataset.carnagePhase) / 100));
  }
  slider.addEventListener('input', () => send('jump', Number(slider.value) / 100));
  picker.addEventListener('change', () => select(picker.value, true));
  find('cover').addEventListener('click', () => {
    settings().cover = selected;
    render();
    markDirty();
  });
  find('earlier').addEventListener('click', () => moveOrder(-1));
  find('later').addEventListener('click', () => moveOrder(1));
  find('hide').addEventListener('click', () => change({ visibility: 'hidden' }));
  find('remove').addEventListener('click', () => change({ visibility: 'removed' }));
  find('restore').addEventListener('click', () => change({ visibility: undefined }));
  find('reset-size').addEventListener('click', () => change({ width: undefined, height: undefined }));
  find('ratio').addEventListener('change', () => change({ lockRatio: find('ratio').checked || undefined }));

  for (const input of inputs) input.addEventListener('change', () => {
    if (!card() || !input.validity.valid) return;
    const key = input.dataset.carnageField;
    const value = input.value === '' ? undefined : bounded(key, input.valueAsNumber);
    if (options().lockRatio && value !== undefined && ['width', 'height'].includes(key)) {
      const width = geometry('width');
      const height = geometry('height');
      change(resize(key === 'width' ? value : width, key === 'height' ? value : height, width / height, key));
    } else change({ [key]: value });
  });

  function startPointer(event) {
    const target = event.target.closest('[data-photo]');
    if (!target || isBusy() || event.button !== 0 || !event.isPrimary) return;
    select(target.dataset.photo);
    if (progress < 1) return;
    event.preventDefault();
    page.defaultView.focus();
    const handle = event.target.dataset.carnageCorner;
    gesture = {
      pointer: event.pointerId, target, handle,
      clientX: event.clientX, clientY: event.clientY, scrollY: page.defaultView.scrollY,
      x: geometry('x'), y: geometry('y'), width: geometry('width'), height: geometry('height'),
    };
    target.setPointerCapture(event.pointerId);
  }

  function movePointer(event) {
    if (gesture?.pointer !== event.pointerId || isBusy()) return;
    const { x, y, width, height, handle } = gesture;
    const dx = event.clientX - gesture.clientX;
    const dy = event.clientY - gesture.clientY + page.defaultView.scrollY - gesture.scrollY;
    if (Math.abs(dx) + Math.abs(dy) < 2 && !gesture.moved) return;
    gesture.moved = true;
    if (!handle) {
      change({ x: bounded('x', x + dx), y: bounded('y', y + dy) }, gesture);
      return;
    }
    const left = handle.includes('w');
    const top = handle.includes('n');
    const size = resize(width + dx * (left ? -1 : 1), height + dy * (top ? -1 : 1),
      options().lockRatio ? width / height : 0, Math.abs(dx / width) >= Math.abs(dy / height) ? 'width' : 'height');
    change({ ...size, x: bounded('x', x + (left ? width - size.width : 0)),
      y: bounded('y', y + (top ? height - size.height : 0)) }, gesture);
  }

  function endPointer(event) {
    if (gesture?.pointer !== event.pointerId) return;
    gesture = undefined;
    closeGroup();
  }

  function keydown(event) {
    if (!selected || isBusy() || progress < 1 || options().visibility || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey ||
        event.target.closest?.('input, textarea, select, button, [contenteditable]')) return;
    const arrows = { ArrowLeft: ['x', -1], ArrowRight: ['x', 1], ArrowUp: ['y', -1], ArrowDown: ['y', 1] };
    if (!Object.hasOwn(arrows, event.key)) return;
    const [axis, direction] = arrows[event.key];
    event.preventDefault();
    change({ [axis]: bounded(axis, geometry(axis) + direction * (event.shiftKey ? 10 : 1)) });
  }

  return {
    render,
    clear() { if (page) select(''); },
    attach(next) {
      page = next;
      cards = new Map([...page.querySelectorAll('.archive-stage [data-photo]')].map(node => [node.dataset.photo, node]));
      tools.hidden = false;
      const style = page.createElement('style');
      style.textContent = `
        .archive-stage [data-photo] { cursor: pointer; }
        .archive.is-unfolded [data-photo] { cursor: move; }
        .archive.is-unfolded [data-carnage-selected] { touch-action: none; }
        [data-carnage-selected] { outline: 2px solid #9661e8; outline-offset: -2px; }
        [data-carnage-corner] {
          display: none; position: absolute; padding: 0; width: 13px; height: 13px;
          background: #fff; border: 2px solid #7133c4; z-index: 1;
        }
        .archive.is-unfolded [data-carnage-selected] [data-carnage-corner] { display: block; }
        [data-carnage-corner="nw"] { top: 0; left: 0; cursor: nwse-resize; }
        [data-carnage-corner="ne"] { top: 0; right: 0; cursor: nesw-resize; }
        [data-carnage-corner="sw"] { bottom: 0; left: 0; cursor: nesw-resize; }
        [data-carnage-corner="se"] { bottom: 0; right: 0; cursor: nwse-resize; }
      `;
      page.head.append(style);
      for (const node of cards.values()) for (const corner of ['nw', 'ne', 'sw', 'se']) {
        const handle = page.createElement('span');
        handle.dataset.carnageCorner = corner;
        handle.setAttribute('aria-hidden', 'true');
        node.append(handle);
      }
      page.addEventListener('portfolio:carnage-progress', ({ detail }) => {
        progress = detail;
        slider.value = Math.round(detail * 100);
      });
      page.addEventListener('pointerdown', startPointer);
      page.addEventListener('pointermove', movePointer);
      page.addEventListener('lostpointercapture', endPointer);
      page.addEventListener('keydown', keydown);
      render();
    },
    detach() {
      tools.hidden = true;
      tools.open = false;
      slider.value = 0;
      progress = 0;
      page = undefined;
      cards.clear();
      selected = '';
      gesture = undefined;
    },
  };
}
