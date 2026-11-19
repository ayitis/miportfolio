import { horizontalGallery, verticalGallery } from './home-gallery-layout.js';
import { hasNuptiasDesktopLimit, isNuptiasPosition, nuptiasPositionBounds } from './nuptias-layout.js';
import { fonts } from './design-document.js';

const properties = ['translate', 'font-size', 'font-family', 'text-align', 'width', 'white-space', 'color', 'display', 'letter-spacing', 'z-index', 'height', 'margin-inline', 'max-width'];

export function collectElements(page, targets) {
  const elements = new Map();
  for (const [id, , selector, options] of targets) {
    const originals = [...page.querySelectorAll(selector)].map((node) => ({
      node,
      allowText: options?.text !== false,
      gallery: options?.gallery === true,
      inline: options?.inline === true,
      children: [...node.childNodes],
      text: node.innerText.trim() || node.textContent,
      title: node.getAttribute('data-title'),
      styles: Object.fromEntries(properties.map((property) => [property, originalStyle(node, property)])),
    }));
    if (originals.length) elements.set(id, originals);
  }
  return elements;
}

function originalStyle(node, property) {
  return [node.style.getPropertyValue(property), node.style.getPropertyPriority(property)];
}

export function syncCustomElements(page, editable, draft) {
  if (draft.page === 'nuptias' && !page.getElementById('nuptias-design-layers')) {
    const layers = page.createElement('style');
    layers.id = 'nuptias-design-layers';
    layers.textContent = `
      body:has([data-custom-text]) .page > header,
      body:has([data-custom-text]) .category,
      body:has([data-custom-text]) .marquee,
      body:has([data-custom-text]) .editorial-bottom > *,
      body:has([data-custom-text]) .editorial-left > *,
      body:has([data-custom-text]) .page > footer {
        position: relative;
        z-index: 5;
      }
    `;
    page.head.append(layers);
  }
  for (const [id, items] of editable) {
    if (id.startsWith('custom.') && !Object.hasOwn(draft.elements, id)) {
      items[0].node.remove();
      editable.delete(id);
    }
  }
  for (const [id, item] of Object.entries(draft.elements)) {
    if (item.type !== 'text' || editable.has(id)) continue;
    const node = page.createElement('div');
    node.dataset.customText = id;
    node.style.cssText = 'position:absolute;inset:0 auto auto 0;overflow-wrap:anywhere;white-space:pre-wrap;z-index:10;max-width:100%;';
    page.body.append(node);
    editable.set(id, [{
      node, allowText: true, children: [], text: '', title: null,
      styles: Object.fromEntries(properties.map(property => [property, originalStyle(node, property)])),
    }]);
  }
}

export function applyElement(editable, id, draft, view) {
  if (id === horizontalGallery || id === verticalGallery) return;
  const overrides = draft[view][id] ?? {};
  const content = draft.content[id]?.text;
  const nuptias = draft.page === 'nuptias' && (isNuptiasPosition(id) || hasNuptiasDesktopLimit(id, view));
  const x = overrides.x ?? 0;
  const y = overrides.y ?? 0;
  const styles = {
    translate: overrides.x !== undefined || overrides.y !== undefined
      ? `${x}px ${y}px` : null,
    'font-size': overrides.size === undefined ? null : `${overrides.size}px`,
    'font-family': fonts[overrides.font] ?? null,
    'text-align': overrides.align ?? null,
    color: overrides.color ?? null,
    'letter-spacing': overrides.spacing === undefined ? null : `${overrides.spacing}px`,
    'z-index': overrides.layer ?? null,
    height: null,
    'margin-inline': null,
    'max-width': null,
    width: overrides.width === undefined ? null : `${overrides.width}px`,
    'white-space': content?.includes('\n') ? 'pre-line' : null,
  };

  for (const original of editable.get(id) ?? []) {
    const { node } = original;
    const viewportWidth = original.gallery ? node.ownerDocument.documentElement.clientWidth : 0;
    const room = Math.max(0, (viewportWidth - (overrides.width ?? viewportWidth)) / 2);
    const boundedX = Math.max(-room, Math.min(room, x));
    const adapted = original.gallery ? {
      translate: boundedX || y ? `${boundedX}px ${y}px` : null,
      'margin-inline': overrides.width !== undefined ? 'auto' : null,
      width: overrides.width === undefined ? null : `min(${overrides.width}px, 100%)`,
      height: overrides.height === undefined ? null : `${overrides.height}px`,
    } : {};
    if (draft.page === 'home' && id.startsWith('custom.')) {
      const intro = node.ownerDocument.querySelector('.home-scroll > .hero');
      node.toggleAttribute('data-home-below-scene', Boolean(intro && y >= intro.offsetHeight));
    }
    if (id.startsWith('custom.') && styles.width !== null) {
      styles.width = `min(${overrides.width}px, max(24px, calc(100% - ${Math.max(0, x)}px)))`;
    }
    const display = draft.elements[id]?.hidden ? 'none' : original.inline && (styles.translate || styles.width || styles['text-align'])
      ? 'inline-block' : null;
    for (const [property, value] of Object.entries({ ...styles, ...adapted, display })) {
      if (value === null) node.style.setProperty(property, ...original.styles[property]);
      else node.style.setProperty(property, value);
    }
    if (original.allowText && original.appliedText !== content) {
      if (content === undefined) node.replaceChildren(...original.children);
      else node.textContent = content;
      if (original.title !== null) node.dataset.title = content ?? original.title;
      original.appliedText = content;
    }
    if (nuptias) {
      node.dataset.nuptiasX = x;
      node.dataset.nuptiasY = y;
    }
  }
}

// Width and content changes can move the common block. Measure after all
// declared styles are in place, in the same order on both surfaces.
export function constrainNuptiasPositions(page, editable, design, view) {
  if (design.page !== 'nuptias') return;
  for (const [id, items] of editable) {
    if (!isNuptiasPosition(id) && !hasNuptiasDesktopLimit(id, view)) continue;
    const { node } = items[0];
    if (!node.offsetWidth && !node.offsetHeight) continue;
    const offsets = design[view][id] ?? {};
    const [minX, maxX] = nuptiasPositionBounds(node, 'x', view);
    const [minY, maxY] = nuptiasPositionBounds(node, 'y', view);
    const x = Math.max(minX, Math.min(maxX, offsets.x ?? 0));
    const y = Math.max(minY, Math.min(maxY, offsets.y ?? 0));
    const saved = offsets.x !== undefined || offsets.y !== undefined;
    node.style.translate = saved || x || y ? `${x}px ${y}px` : (items[0].styles.translate[0] || '');
    node.dataset.nuptiasX = x;
    node.dataset.nuptiasY = y;
  }
}
