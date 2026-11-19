import { spacingBetween } from './alignment.js';

const ns = 'http://www.w3.org/2000/svg';
const rulerSize = 20;
const selectionTargets = '[data-editor-text], .marquee, .photo, .thumb img, .brand-logo';

export function createGuideLayer(page, { settings, manualGuides, isBusy }) {
  const win = page.defaultView;
  const svg = (tag, attributes = {}) => {
    const node = page.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  const layer = svg('svg', { 'data-editor-guides': '', 'aria-hidden': 'true' });
  Object.assign(layer.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '2147483647', overflow: 'hidden',
  });
  const guides = svg('g');
  const rulers = svg('g');
  const smart = svg('g');
  layer.append(guides, smart, rulers);
  page.body.append(layer);
  let scope;
  let rulersEnabled = false;
  let layoutFrame = 0;

  const viewport = () => ({ width: page.documentElement.clientWidth, height: page.documentElement.clientHeight });
  const guideSet = () => {
    if (!manualGuides.has(scope)) manualGuides.set(scope, { x: [], y: [] });
    return manualGuides.get(scope);
  };
  const line = (x1, y1, x2, y2, stroke, attrs = {}) => svg('line', { x1, y1, x2, y2, stroke, ...attrs });
  const label = (x, y, value, attrs = {}) => {
    const node = svg('text', { x, y, 'font-family': 'system-ui, sans-serif', 'font-size': 10, ...attrs });
    node.textContent = value;
    return node;
  };
  const scroll = axis => axis === 'x' ? win.scrollX : win.scrollY;

  function drawRulers() {
    guides.replaceChildren();
    rulers.replaceChildren();
    if (!rulersEnabled || !scope) return;
    const { width, height } = viewport();
    const marks = guideSet();
    for (const axis of ['x', 'y']) {
      const top = axis === 'x';
      const size = top ? width : height;
      const offset = scroll(axis);
      const bar = svg('rect', {
        x: top ? rulerSize : 0, y: top ? 0 : rulerSize,
        width: top ? Math.max(0, width - rulerSize) : rulerSize,
        height: top ? rulerSize : Math.max(0, height - rulerSize),
        fill: '#f2ecfb', 'pointer-events': 'all', 'data-editor-ruler': axis,
      });
      bar.style.cursor = 'crosshair';
      bar.addEventListener('pointerdown', event => {
        if (event.button !== 0 || isBusy()) return;
        event.preventDefault();
        event.stopPropagation();
        const at = Math.round(offset + (top ? event.clientX : event.clientY));
        if (!marks[axis].includes(at) && marks[axis].length < 30) marks[axis].push(at);
        drawRulers();
      });
      rulers.append(bar);
      for (let pos = Math.ceil((offset + rulerSize) / 10) * 10; pos < offset + size; pos += 10) {
        const at = pos - offset;
        const long = pos % 50 === 0;
        rulers.append(top
          ? line(at, long ? 12 : 16, at, 20, '#745d94')
          : line(long ? 12 : 16, at, 20, at, '#745d94'));
        if (long) rulers.append(top
          ? label(at + 2, 10, pos, { fill: '#48365c' })
          : label(9, at - 2, pos, { fill: '#48365c', transform: `rotate(-90 9 ${at - 2})` }));
      }
      for (const pos of marks[axis]) {
        const at = pos - offset;
        const attrs = { 'stroke-dasharray': '5 4', 'data-editor-manual-guide': axis };
        guides.append(top ? line(at, rulerSize, at, height, '#26a8af', attrs) : line(rulerSize, at, width, at, '#26a8af', attrs));
      }
    }
  }

  function refreshLayout() {
    if (!layoutFrame) layoutFrame = win.requestAnimationFrame(() => {
      layoutFrame = 0;
      drawRulers();
      smart.replaceChildren();
    });
  }

  win.addEventListener('resize', refreshLayout);
  win.addEventListener('scroll', refreshLayout, { passive: true });

  function references(node, id) {
    const { width, height } = viewport();
    const clipped = new Map();
    const targets = [];
    for (const other of page.querySelectorAll(selectionTargets)) {
      if (other === node || node.contains(other) || other.contains(node) || other.dataset.editorText === id) continue;
      const rect = other.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const marquee = other.closest('.marquee');
      if (marquee && !clipped.has(marquee)) clipped.set(marquee, marquee.getBoundingClientRect());
      const bounds = clipped.get(marquee);
      if (rect.left >= Math.min(width, bounds?.right ?? width) || rect.right <= Math.max(0, bounds?.left ?? 0) ||
          rect.top >= Math.min(height, bounds?.bottom ?? height) || rect.bottom <= Math.max(0, bounds?.top ?? 0)) continue;
      if (win.getComputedStyle(other).visibility === 'visible') targets.push({ id: other, rect });
    }
    return targets;
  }

  function fixedLines() {
    const { width, height } = viewport();
    const fixed = {
      x: [{ id: 'center-x', target: width / 2, center: true }],
      y: [{ id: 'center-y', target: Math.max(height, page.documentElement.scrollHeight) / 2 - win.scrollY, center: true }],
    };
    if (rulersEnabled && scope) {
      for (const axis of ['x', 'y']) {
        fixed[axis].push(...guideSet()[axis].map(pos => ({ id: `manual-${axis}-${pos}`, target: pos - scroll(axis) })));
      }
    }
    return fixed;
  }

  function draw(source, matches, targets) {
    const { width, height } = viewport();
    smart.replaceChildren();
    for (const { axis, at, reference } of matches) {
      const vertical = axis === 'x';
      const start = vertical ? 'top' : 'left';
      const end = vertical ? 'bottom' : 'right';
      const low = reference ? Math.min(source[start], reference[start]) - 8 : 0;
      const high = reference ? Math.max(source[end], reference[end]) + 8 : vertical ? height : width;
      const attrs = { 'data-editor-smart-guide': axis };
      smart.append(vertical ? line(at, low, at, high, '#dc3bbb', attrs) : line(low, at, high, at, '#dc3bbb', attrs));
    }
    if (!settings.distance()) return;
    for (const { axis, from, to, at, gap } of spacingBetween(source, targets)) {
      const horizontal = axis === 'x';
      const ink = '#9241cf';
      const tip = (position) => horizontal ? line(position, at - 4, position, at + 4, ink) : line(at - 4, position, at + 4, position, ink);
      const text = horizontal ? label((from + to) / 2, at - 4, `${Math.round(gap)} px`, { 'text-anchor': 'middle' })
        : label(at + 6, (from + to) / 2 + 3, `${Math.round(gap)} px`);
      text.setAttribute('data-editor-distance', axis);
      Object.assign(text.style, { fill: '#67339d', stroke: '#fff', strokeWidth: '3px', paintOrder: 'stroke' });
      smart.append(horizontal ? line(from, at, to, at, ink) : line(at, from, at, to, ink), tip(from), tip(to), text);
    }
  }

  return {
    references, fixedLines, draw,
    setRulers(next, key) { rulersEnabled = next; scope = key; drawRulers(); },
    clearRulers() { manualGuides.delete(scope); drawRulers(); },
    clear() { smart.replaceChildren(); },
    detach() {
      win.cancelAnimationFrame(layoutFrame);
      win.removeEventListener('resize', refreshLayout);
      win.removeEventListener('scroll', refreshLayout);
      layer.remove();
    },
  };
}
