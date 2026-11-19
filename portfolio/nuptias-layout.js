export const nuptiasEditorial = 'editorial.right';
const moving = new Set([nuptiasEditorial, 'editorial.roles', 'concept.title', 'concept.description']);
const existing = [...moving, 'editorial.eyebrow', 'editorial.title', 'editorial.credit',
  'concept.form', 'concept.ampersand', 'concept.feeling'];

export const isNuptiasPosition = id => moving.has(id);

export function nuptiasLayout(design, view) {
  const settings = design[view];
  const explicit = settings[nuptiasEditorial]?.layout;
  if (explicit) return explicit;
  const positioned = existing.some(id => ['x', 'y', 'width'].some(key => settings[id]?.[key] !== undefined));
  return view === 'desktop' && !positioned ? 'split' : 'center';
}

export function applyNuptiasLayout(page, design, view) {
  page.documentElement.dataset.nuptiasLayout = nuptiasLayout(design, view);
}

export function nuptiasRightLimit(page, view) {
  const gutter = parseFloat(page.defaultView.getComputedStyle(page.querySelector('.category')).paddingRight) || 0;
  if (view !== 'desktop') return page.documentElement.clientWidth - gutter;
  const canvas = page.querySelector('.page');
  const guide = Number(page.defaultView.getComputedStyle(canvas).getPropertyValue('--editorial-guide-percent')) || 76;
  return canvas.clientWidth * guide / 100;
}

export function nuptiasPositionBounds(node, axis, view) {
  const page = node.ownerDocument;
  const rect = node.getBoundingClientRect();
  let start, end, min, max, applied;
  if (axis === 'y') {
    const canvas = page.querySelector('.page').getBoundingClientRect();
    ({ top: start, bottom: end } = rect);
    min = canvas.top;
    max = canvas.bottom;
    applied = Number(node.dataset.nuptiasY) || 0;
  } else {
    // The heading and gallery share the page gutter. Read its resolved value.
    const gutter = parseFloat(page.defaultView.getComputedStyle(page.querySelector('.category')).paddingRight) || 0;
    ({ left: start, right: end } = rect);
    min = gutter;
    max = nuptiasRightLimit(page, view);
    if (view === 'desktop' && node.matches('.concept h2 :is(span,em)')) {
      max = Math.min(max, node.closest('h2').getBoundingClientRect().right);
    }
    applied = Number(node.dataset.nuptiasX) || 0;
  }
  const low = Math.ceil(min - start + applied - .05);
  const high = Math.floor(max - end + applied + 1e-6);
  if (low <= high) return [low, high];
  return [high, high];
}

const guideElements = new Set([...moving, 'concept.form', 'concept.ampersand', 'concept.feeling']);

export const hasNuptiasDesktopLimit = (id, view) => view === 'desktop' && guideElements.has(id);
