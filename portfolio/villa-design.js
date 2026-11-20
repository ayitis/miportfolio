import { designScale } from './ayam-canvas.js';
import { mediaPath } from './ayam-document.js';

export const villaPage = 'villa-tiger';
export const villaSketch = 'villa-image.croquis';
export const villaIdentity = 'villa-section.identity';
export const villaAddedImage = id => /^villa-image\.added-[a-f0-9-]{36}$/.test(id);
export const villaFields = {
  image: { zoom: [50, 400], cropX: [0, 100], cropY: [0, 100], stretchX: [40, 250], stretchY: [40, 250], locked: true, fit: ['contain', 'cover'], invisible: true },
  section: { spaceBefore: [0, 600], spaceAfter: [0, 600], marginBefore: [0, 600], marginAfter: [0, 600], shift: [-700, 700], gap: [0, 240] },
  swatch: { fill: 'color' },
};

export function validVillaField(kind, field, value) {
  const rule = villaFields[kind]?.[field];
  if (rule === true) return value === true;
  if (rule === 'color') return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  if (!rule) return false;
  if (typeof rule[0] === 'string') return rule.includes(value);
  return Number.isInteger(value) && value >= rule[0] && value <= rule[1];
}

export function villaImagePath(source) {
  return mediaPath(source);
}

export function renderVillaElement(original, settings, content) {
  const { node, villaKind } = original;
  if (villaKind === 'image') {
    const image = node.firstElementChild;
    const source = content?.source ?? original.imageSource;
    if (image.getAttribute('src') !== source) image.setAttribute('src', source);
    image.alt = content?.alt ?? original.imageAlt;
    image.style.objectFit = settings.fit ?? '';
    const x = settings.cropX ?? 50;
    const y = settings.cropY ?? (node.dataset.villaImage === 'cover' ? 52 : 50);
    image.style.objectPosition = settings.cropX !== undefined || settings.cropY !== undefined ? `${x}% ${y}%` : '';
    image.style.transformOrigin = `${x}% ${y}%`;
    image.style.scale = settings.zoom === undefined ? '' : settings.zoom / 100;
    if (node.dataset.villaImage === 'croquis') {
      // Keep legacy stretch settings readable until the frame is resized.
      image.style.objectFit = 'fill';
      const transform = `scale(${(settings.stretchX ?? 100) / 100}, ${(settings.stretchY ?? 100) / 100})`;
      image.style.transform = transform;
      const drawing = node.querySelector('.villa-sketch-drawing');
      drawing.style.transform = transform;
      drawing.style.transformOrigin = image.style.transformOrigin;
      drawing.style.scale = image.style.scale;
    }
  }
  if (villaKind === 'section') {
    node.style.paddingBlockStart = pixels(settings.spaceBefore);
    node.style.paddingBlockEnd = pixels(settings.spaceAfter);
    node.style.marginBlockStart = settings.shift === undefined
      ? pixels(settings.marginBefore)
      : `calc(${settings.marginBefore ?? 0}px + ${settings.shift}px)`;
    node.style.marginBlockEnd = pixels(settings.marginAfter);
    node.style.minHeight = pixels(settings.height);
    node.style.setProperty('--villa-section-gap', pixels(settings.gap));
  }
  if (villaKind === 'swatch') {
    const color = settings.fill ?? original.swatch;
    node.style.setProperty('--swatch', color);
    node.querySelector('code').textContent = color.toUpperCase();
    const [r, g, b] = color.slice(1).match(/../g).map(channel => {
      const srgb = parseInt(channel, 16) / 255;
      return srgb <= .04045 ? srgb / 12.92 : ((srgb + .055) / 1.055) ** 2.4;
    });
    node.style.color = .2126 * r + .7152 * g + .0722 * b > .179 ? '#000' : '#fff';
    if (!settings.fill) node.style.removeProperty('color');
  }
}

function pixels(value) {
  return value === undefined ? '' : `${value}px`;
}

export function villaIdentityClearance(page) {
  const brand = page.querySelector('.brand');
  const bottom = brand.getBoundingClientRect().bottom;
  const contentBottom = Math.max(brand.getBoundingClientRect().top,
    ...[...brand.querySelectorAll(':scope > *, [data-villa-text], [data-villa-image]')]
    .filter(node => node.getClientRects().length)
    .map(node => node.getBoundingClientRect().bottom));
  return Math.floor((bottom - contentBottom) / designScale(page));
}

export function constrainVillaIdentity(page, design, view) {
  const settings = design[view][villaIdentity] ?? {};
  if (settings.shift === undefined) return;
  const section = page.querySelector('#identity');
  const gap = (settings.marginBefore ?? 0) + settings.shift;
  section.style.marginBlockStart = pixels(Math.max(gap, -villaIdentityClearance(page)));
}
