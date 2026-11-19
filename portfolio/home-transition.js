import { measureDisciplines } from './home-disciplines.js';

const root = document.documentElement;
const scene = document.querySelector('.home-scroll');
const hero = scene.querySelector('.hero');
const photo = hero.querySelector('.hero-bg');
const group = hero.querySelector('.gallery-wrap');
const header = group.querySelector('.gallery-header');
const instructions = header.lastElementChild;
const heading = header.firstElementChild;
const track = group.querySelector('.track');
const cards = [...track.querySelectorAll('.project')];
const about = document.getElementById('about');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 700px)');
const canHover = matchMedia('(hover: hover)');
const formedAt = .48;
const exitAt = .76;
const pixelsPerSecond = 52;
const inEditor = window.parent !== window && new URLSearchParams(location.search).has('editor-preview');
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

let active;
let pending = 0;
let travel = 0;
let needsMeasure = true;
let distance = 0;
let lastTick = null;

function clearCards() {
  for (const card of cards) {
    for (const property of ['--project-x', '--project-y', 'visibility', 'pointer-events']) card.style.removeProperty(property);
    card.inert = false;
  }
}

function stop() {
  distance = 0;
  lastTick = null;
  if (!active) return;
  active.disciplines.reset();
  active = null;
  clearCards();
  hero.classList.remove('home-scrubbing', 'home-photo-panning');
  group.style.removeProperty('pointer-events');
  group.inert = false;
  heading.style.removeProperty('opacity');
  instructions.style.removeProperty('opacity');
  hero.style.removeProperty('--photo-x');
  hero.style.removeProperty('--photo-y');
}

function configure() {
  const enabled = !inEditor && !motion.matches;
  root.toggleAttribute('data-home-scroll', enabled);
  if (!enabled) {
    stop();
    return;
  }
  const heroHeight = hero.offsetHeight;
  travel = Math.round(Math.min(heroHeight, innerHeight) * (narrow.matches ? 1.7 : 1.6));
  scene.style.setProperty('--hero-height', `${heroHeight}px`);
  root.style.setProperty('--hero-travel', `${travel}px`);
  needsMeasure = true;
  schedule();
}

function pickCards(width, origin) {
  const entries = new Map();
  for (const card of cards) {
    if (!card.offsetWidth || !card.offsetHeight) continue;
    const box = card.getBoundingClientRect();
    const left = box.left - origin.left;
    const score = Math.min(left + box.width, width) - Math.max(left, 0);
    const previous = entries.get(card.getAttribute('href'));
    if (!previous || score > previous.score) {
      entries.set(card.getAttribute('href'), { card, left, top: box.top - origin.top, width: box.width, height: box.height, score });
    }
  }
  // Map insertion order is the original editorial sequence, even when a
  // visible copy is picked from the second half of the carousel.
  return [...entries.values()];
}

function measure() {
  active?.disciplines.reset();
  clearCards();
  // Read the unmodified cover position before enabling the photo pan.
  hero.classList.remove('home-photo-panning');
  const style = getComputedStyle(photo);
  const positionX = parseFloat(style.backgroundPositionX) / 100;
  const positionY = parseFloat(style.backgroundPositionY) / 100;
  hero.classList.add('home-scrubbing');
  const rect = hero.getBoundingClientRect();
  const entries = pickCards(rect.width, rect);
  if (!entries.length) return null;
  const widest = Math.max(...entries.map(entry => entry.width));

  // The master photograph is square. These normalized coordinates mark the
  // fingertip on the original 1254 × 1254 image, before background-size: cover.
  const size = Math.max(rect.width, rect.height);
  const fingertip = { x: .419, y: .30 };
  const photoX = (rect.width - size) * (Number.isFinite(positionX) ? positionX : (narrow.matches ? .52 : .5));
  const photoY = (rect.height - size) * (Number.isFinite(positionY) ? positionY : .5);
  const idealX = photoX + size * fingertip.x;
  const idealY = photoY + size * fingertip.y;
  const gutter = widest / 2 + 12;
  const offsetX = clamp(photoX + clamp(idealX, gutter, rect.width - gutter) - idealX, rect.width - size, 0);
  const offsetY = clamp(photoY + Math.max(0, rect.height * .14 - idealY), rect.height - size, 0);
  const offset = Number(hero.dataset.columnOffset ?? 0) || 0;
  // Keep the existing offset plus another 19 CSS px at desktop reference size.
  const rightShift = Math.min(105, rect.width * .073) + Math.min(19, rect.width * .0132);
  const columnX = clamp(offsetX + size * fingertip.x + rightShift + offset, gutter, rect.width - gutter);
  let nextY = clamp(offsetY + size * fingertip.y + 25, 28, rect.height * .68);
  const firstY = nextY;
  const gap = narrow.matches ? 15 : 20;
  for (const item of entries) {
    item.destLeft = columnX - item.width / 2;
    item.destTop = nextY;
    nextY += item.height + gap;
  }
  const disciplines = measureDisciplines(hero, rect, columnX - widest / 2);
  return {
    entries, visible: new Set(entries.map(({ card }) => card)), rise: nextY + 35, period: nextY - firstY,
    photoX, photoY, offsetX, offsetY, disciplines,
  };
}

function flowTop(item, period) {
  const top = item.destTop - distance;
  // Recycle a card only after it is fully above the viewport. Its next
  // occurrence starts below the other cards in the same editorial sequence.
  const cycles = Math.max(0, Math.ceil((-item.height - top) / period));
  return top + cycles * period;
}

function tick(progress, timestamp) {
  if (inEditor || progress < formedAt || progress >= exitAt) {
    lastTick = null;
    return;
  }
  const paused = document.hidden || active.entries.some(({ card }) =>
    (canHover.matches && card.matches(':hover')) || card.matches(':focus-within'));
  if (lastTick !== null && !paused) {
    distance += Math.min(timestamp - lastTick, 50) * pixelsPerSecond / 1000;
  }
  lastTick = timestamp;
  schedule();
}

function draw(progress, timestamp) {
  if (!active || needsMeasure) {
    active = measure();
    needsMeasure = false;
  }
  if (!active) {
    hero.classList.remove('home-scrubbing', 'home-photo-panning');
    return;
  }

  tick(progress, timestamp);
  if (active.lastProgress === progress && active.lastDistance === distance) return;
  active.lastProgress = progress;
  active.lastDistance = distance;

  const reform = smooth(clamp(progress / formedAt, 0, 1));
  const fan = smooth(clamp(progress / .40, 0, 1));
  const glide = clamp((progress - exitAt) / (1 - exitAt), 0, 1);
  const rise = active.rise * glide * glide;
  const opacity = 1 - smooth(clamp((progress - .95) / .05, 0, 1));
  hero.style.setProperty('--photo-x', `${mix(active.photoX, active.offsetX, reform)}px`);
  hero.style.setProperty('--photo-y', `${mix(active.photoY, active.offsetY, reform)}px`);
  hero.classList.add('home-photo-panning');
  const ended = progress >= 1;
  group.inert = ended;
  group.style.pointerEvents = ended ? 'none' : '';
  heading.style.opacity = 1 - reform;
  const typeProgress = smooth(clamp(progress / .30, 0, 1));
  const typeRise = smooth(clamp(progress / .24, 0, 1));
  active.disciplines.draw(typeProgress, typeRise);
  instructions.style.opacity = opacity;

  for (const card of cards) {
    if (!active.visible.has(card)) {
      card.style.visibility = 'hidden';
      card.inert = true;
    }
  }
  for (const item of active.entries) {
    const x = (item.destLeft - item.left) * reform;
    const y = (flowTop(item, active.period) - item.top) * fan - rise;
    item.card.style.setProperty('--project-x', `${x}px`);
    item.card.style.setProperty('--project-y', `${y}px`);
  }
}

function update(timestamp) {
  pending = 0;
  if (!root.hasAttribute('data-home-scroll') || root.hasAttribute('data-about-direct')) {
    stop();
    return;
  }
  const progress = clamp(-scene.getBoundingClientRect().top / travel, 0, 1);
  if (progress === 0 || scene.getBoundingClientRect().bottom <= 0) {
    stop();
    return;
  }
  draw(progress, timestamp);
}

function schedule() {
  if (!pending) pending = requestAnimationFrame(update);
}

function goToAbout() {
  root.setAttribute('data-about-direct', '');
  stop();
  about.scrollIntoView({ block: 'start', behavior: 'instant' });
}

let lastHash = location.hash;
function navigateHash() {
  if (lastHash === location.hash) return;
  lastHash = location.hash;
  if (lastHash === '#about') goToAbout();
  else {
    root.removeAttribute('data-about-direct');
    const previous = history.state?.portfolioScroll;
    if (Number.isFinite(previous)) {
      requestAnimationFrame(() => window.scrollTo({ top: previous, behavior: 'instant' }));
    } else if (lastHash === '#home' || lastHash === '#work') {
      requestAnimationFrame(() => {
        if (root.hasAttribute('data-home-scroll')) {
          scene.scrollIntoView({ block: 'start', behavior: 'instant' });
        } else document.querySelector(lastHash)?.scrollIntoView({ behavior: 'instant' });
      });
    }
    schedule();
  }
}

if (inEditor) {
  let showColumn = false;
  function previewColumn() {
    if (!showColumn || motion.matches) {
      stop();
      return;
    }
    needsMeasure = true;
    draw(formedAt);
  }
  document.addEventListener('portfolio:column-preview', event => {
    showColumn = event.detail === true;
    previewColumn();
  });
  window.addEventListener('resize', previewColumn);
  motion.addEventListener('change', previewColumn);
} else {
  document.addEventListener('portfolio:home-design', () => {
    needsMeasure = true;
    schedule();
  });
  if (lastHash === '#about') goToAbout();
  configure();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', configure);
  window.addEventListener('hashchange', navigateHash);
  window.addEventListener('popstate', navigateHash);
  motion.addEventListener('change', configure);
  new ResizeObserver(() => {
    needsMeasure = true;
    schedule();
  }).observe(track);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href="#about"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.hash !== '#about') {
      history.replaceState({ ...history.state, portfolioScroll: window.scrollY }, '');
      history.pushState(null, '', '#about');
    }
    lastHash = '#about';
    goToAbout();
    about.setAttribute('tabindex', '-1');
    about.focus({ preventScroll: true });
  });
}
