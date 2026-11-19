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
  page.documentElement.toggleAttribute('data-nuptias-bounded', Boolean(design[view][nuptiasEditorial]?.layout));
}

export function nuptiasPositionBounds(node, axis) {
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
    max = page.documentElement.clientWidth - gutter;
    applied = Number(node.dataset.nuptiasX) || 0;
  }
  const low = Math.ceil(min - start + applied - .05);
  const high = Math.floor(max - end + applied + .05);
  if (low <= high) return [low, high];
  const fallback = Math.round((low + high) / 2);
  return [fallback, fallback];
}

const guideElements = new Set([...moving, 'concept.form', 'concept.ampersand', 'concept.feeling']);

export const followsNuptiasGuide = (id, view) => view === 'desktop' && guideElements.has(id);

export function alignNuptiasEditorial(page, view) {
  const root = page.documentElement;
  root.toggleAttribute('data-nuptias-right-guide', view === 'desktop');
  const block = page.querySelector('.editorial-right');
  if (!block) return;
  block.style.removeProperty('--editorial-right-shift');
  if (view !== 'desktop') return;

  const width = root.clientWidth;
  const gallery = page.querySelector('.marquee');
  const galleryEdge = gallery?.hidden ? 0 : (gallery?.getBoundingClientRect().right ?? 0);
  // The red mark in the reference is about 76% across the photographed page.
  // Prefer the actual gallery edge when it has the matching editorial inset.
  const edge = galleryEdge >= width * .65 && galleryEdge <= width * .83
    ? galleryEdge : width * .76;
  root.style.setProperty('--nuptias-guide', `${edge}px`);
  block.style.setProperty('--editorial-right-shift', `${edge - block.getBoundingClientRect().right}px`);
}
