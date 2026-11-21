import { carnageOrder } from './carnage-document.js';

const archive = document.querySelector('#campaign');
const runway = archive.querySelector('.archive-runway');
const stage = archive.querySelector('.archive-stage');
const cards = new Map([...stage.querySelectorAll('[data-photo]')].map(card => [card.dataset.photo, card]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 650px)');
const editing = window.parent !== window && new URLSearchParams(location.search).has('editor-preview');
let settings = {};
let forcedView;
let visible = [];
let coverId;
let previewProgress;
const isMobile = () => forcedView ? forcedView === 'mobile' : narrow.matches;
const animate = () => editing || !reducedMotion.matches;

// Variable widths stagger the seams while each row fills the stage edge to edge.
const desktopRows = [
  { height: .43, widths: [5, 3, 4] },
  { height: .28, widths: [3, 2, 4, 3] },
  { height: .36, widths: [4, 5, 3] },
  { height: .31, widths: [3, 4, 5] },
  { height: .33, widths: [5, 3, 4] },
];
const mobileRows = [
  { height: .68, widths: [7, 5] },
  { height: .63, widths: [5, 7] },
  { height: .45, widths: [1] },
  { height: .61, widths: [6, 6] },
  { height: .57, widths: [7, 5] },
];
const spread = [
  [.50, .52, 1, 0], [.26, .28, .91, -8], [.71, .23, .78, 7], [.46, .18, .64, -5],
  [.81, .51, .92, 8], [.15, .49, .76, -8], [.34, .73, .84, -6], [.61, .78, .90, 6],
  [.86, .75, .70, 10], [.17, .77, .61, 7], [.33, .43, .65, 9], [.67, .38, .69, -8],
  [.78, .65, .74, -8], [.23, .58, .72, 5], [.48, .83, .64, -5], [.58, .25, .70, 11],
];

const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => value * value * (3 - 2 * value);
const mix = (a, b, progress) => a + (b - a) * progress;
const state = (x, y, width, height, rotation = 0, opacity = 1) =>
  [x - width / 2, y - height / 2, width, height, rotation, opacity];

let scenes, distance, frame, lastProgress;

function finalComposition(width, height) {
  const rows = isMobile() ? mobileRows : desktopRows;
  const positions = [];
  let top = Math.round(height * .15);
  let row = 0;
  while (positions.length < visible.length) {
    const shape = rows[row % rows.length];
    const widths = shape.widths.slice(0, visible.length - positions.length);
    const total = widths.reduce((sum, size) => sum + size, 0);
    const rowHeight = Math.round(shape.height * width);
    let left = 0;
    let used = 0;
    for (const size of widths) {
      used += size;
      const right = Math.round(width * used / total);
      positions.push([left, top, right - left, rowHeight, 0, 1]);
      left = right;
    }
    top += rowHeight;
    row++;
  }
  return positions.map(([x, y, w, h, rotation, opacity], index) => {
    const id = visible[index];
    const photo = settings.photos?.[id] ?? {};
    const photoWidth = Math.min(width, photo.width ?? w);
    const photoHeight = photo.height ?? h;
    const left = Math.round(Math.max(0, Math.min(width - photoWidth, x + (photo.x ?? 0))));
    const top = Math.round(Math.max(0, y + (photo.y ?? 0)));
    const card = cards.get(id);
    card.dataset.photoX = left - x;
    card.dataset.photoY = top - y;
    card.dataset.photoWidth = photoWidth;
    card.dataset.photoHeight = photoHeight;
    return [left, top, photoWidth, photoHeight, rotation, opacity];
  });
}

function measure() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (!width || !height) return;
  distance = Math.round(height * (isMobile() ? 2.15 : 2.7));
  archive.style.setProperty('--archive-distance', `${distance}px`);
  const coverWidth = Math.min(width * (isMobile() ? .44 : .19), height * .24, 250);
  const collageWidth = Math.min(width * (isMobile() ? .55 : .25), height * .40);
  const bandWidth = width * (isMobile() ? .99 : .86);
  const stripWidth = bandWidth / Math.max(1, visible.length);
  const final = finalComposition(width, height);
  const bottom = Math.max(height, ...final.map(([, y, , h]) => y + h));
  archive.style.setProperty('--archive-tail', `${bottom - height}px`);
  const cover = cards.get(coverId)?.querySelector('img');
  const aspect = cover ? Number(cover.getAttribute('width')) / Number(cover.getAttribute('height')) : 1;
  let spreadIndex = 1;
  scenes = visible.map((id, i) => {
    const primary = id === coverId;
    const [x, y, scale, tilt] = spread[primary ? 0 : spreadIndex++ % spread.length];
    const pieceWidth = collageWidth * scale;
    const pieceHeight = pieceWidth * (i % 3 === 1 ? .82 : 1.2);
    return [
      state(width / 2, height * .5, coverWidth, coverWidth / aspect, 0, primary ? 1 : 0),
      state(width * (isMobile() ? mix(.5, x, .84) : x), height * y,
        pieceWidth, pieceHeight, tilt * (isMobile() ? .65 : 1)),
      state((width - bandWidth) / 2 + stripWidth * (i + .5), height * .51,
        stripWidth + .5, height * (isMobile() ? .19 : .29)),
      final[i],
    ];
  });
  lastProgress = undefined;
  render();
}

function render() {
  frame = undefined;
  if (!scenes) return;
  const progress = previewProgress ?? (animate() ? clamp(-runway.getBoundingClientRect().top / distance) : 1);
  if (progress === lastProgress) return;
  lastProgress = progress;
  const phase = progress < .43 ? 0 : progress < .69 ? 1 : 2;
  const segment = phase === 0 ? clamp((progress - .10) / .33)
    : phase === 1 ? (progress - .43) / .26 : (progress - .69) / .31;
  archive.classList.toggle('is-unfolded', progress === 1);
  visible.forEach((id, i) => {
    const card = cards.get(id);
    const photo = settings.photos?.[id] ?? {};
    const delay = phase === 0 && i ? (i / visible.length) * .28 : 0;
    const amount = ease(clamp((segment - delay) / (1 - delay)));
    const [start, end] = scenes[i].slice(phase, phase + 2);
    const [x, y, width, height, rotation, opacity] = start.map((value, j) => mix(value, end[j], amount));
    card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)`;
    card.style.width = `${width}px`;
    card.style.height = `${height}px`;
    card.style.opacity = opacity;
    card.style.zIndex = phase < 2 && id === coverId ? 51 : (photo.layer ?? 1);
    card.toggleAttribute('inert', opacity === 0);
  });
  if (editing) document.dispatchEvent(new CustomEvent('portfolio:carnage-progress', { detail: progress }));
}

function scheduleRender() {
  if (frame === undefined && animate()) frame = requestAnimationFrame(render);
}

function syncMode() {
  archive.classList.toggle('is-scrubbed', animate());
  archive.classList.toggle('is-static', !animate());
  const order = carnageOrder([...cards.keys()], settings);
  visible = order.filter(id => !settings.photos?.[id]?.visibility);
  const preferred = settings.cover ?? cards.keys().next().value;
  coverId = visible.includes(preferred) ? preferred : visible[0];
  for (const [id, card] of cards) {
    const photo = settings.photos?.[id] ?? {};
    card.hidden = Boolean(photo.visibility);
    card.querySelector('img').style.objectPosition = `${photo.cropX ?? 50}% ${photo.cropY ?? 50}%`;
  }
  measure();
}

document.addEventListener('portfolio:carnage-design', ({ detail }) => {
  settings = detail.settings;
  forcedView = detail.view;
  syncMode();
});

if (editing) document.addEventListener('portfolio:carnage-jump', ({ detail }) => {
  previewProgress = detail;
  archive.classList.add('is-previewing');
  const top = Math.ceil(runway.getBoundingClientRect().top + window.scrollY);
  window.scrollTo({ top, behavior: 'instant' });
  render();
});

// Begin fetching the lightweight archive as the reader approaches the section.
const preloader = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  for (const image of stage.querySelectorAll('img')) image.loading = 'eager';
  preloader.disconnect();
}, { rootMargin: '650px 0px' });
preloader.observe(archive);

window.addEventListener('scroll', scheduleRender, { passive: true });
window.addEventListener('resize', measure);
reducedMotion.addEventListener('change', syncMode);
syncMode();
