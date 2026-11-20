import { designScale } from './ayam-canvas.js';
import { portfolioView } from './viewport.js';

const section = document.querySelector('#ire-magazine');
const runway = section.querySelector('.ire-runway');
const stage = section.querySelector('.ire-stage');
const artwork = section.querySelector('.ire-artwork');
const stack = [...section.querySelectorAll('.ire-stack img')];
const reader = section.querySelector('.ire-reader');
const book = section.querySelector('.ire-book');
const [currentLayer, nextLayer] = book.querySelectorAll('.ire-spread');
const count = section.querySelector('.ire-count');
const hint = section.querySelector('.ire-scroll');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const editing = window.parent !== window && new URLSearchParams(location.search).has('editor-preview');
const mobile = () => portfolioView(window, 'ayam') === 'mobile';
const total = 56;
const spreads = 29;
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { value = clamp(value); return value * value * (3 - 2 * value); };
const mix = (a, b, value) => a + (b - a) * value;
const positions = [[-.29,-.18,-11,.86], [ .28,-.22,9,.84],[-.26,.22,7,.88],[.28,.23,-8,.89],[0,0,-2,1.08]];
let manualIndex = 0;
let bookPosition = 0;
let turnDistance = 0;
let introTravel = 0;
let travel = 0;
let motion = false;
let previewMotion = false;
let lastDrawn;
let frame = 0;
let settings = {};

const warmed = new Set();

function imagePath(number) {
  return `/portfolio/ire/${String(number).padStart(2, '0')}.webp`;
}

function setImage(image, number) {
  image.hidden = !number;
  if (!number || image.dataset.page === String(number)) return;
  image.dataset.page = number;
  image.src = imagePath(number);
  image.alt = number === 1 ? 'IRE Magazine cover' : number === total ? 'IRE Magazine back cover' : `IRE Magazine, page ${number}`;
}

function warm(number) {
  if (number > total || warmed.has(number)) return;
  warmed.add(number);
  new Image().src = imagePath(number);
}

function pagesAt(index) {
  if (index === 0) return [1];
  if (index === spreads - 1) return [total];
  return [index * 2, index * 2 + 1];
}

function setSpread(layer, pages) {
  [...layer.children].forEach((image, i) => setImage(image, pages[i]));
}

function drawSpread(position) {
  const current = Math.floor(position);
  const fraction = position % 1;
  const shift = reduced.matches ? 0 : ease((fraction - .32) / .48);
  const next = pagesAt(Math.min(current + 1, spreads - 1));
  const selected = fraction >= .56 ? next : pagesAt(current);
  const label = `${selected.join('–')} / ${total}`;
  if (count.value !== label) count.value = label;
  setSpread(currentLayer, reduced.matches ? selected : pagesAt(current));
  setSpread(nextLayer, fraction && !reduced.matches ? next : []);
  currentLayer.setAttribute('aria-hidden', String(shift >= .5));
  nextLayer.setAttribute('aria-hidden', String(shift < .5));
  nextLayer.style.opacity = shift;
  next.forEach(warm);
}

book.addEventListener('keydown', event => {
  const direction = {ArrowLeft: -1, ArrowRight: 1}[event.key];
  if (!direction) return;
  event.preventDefault();
  const index = Math.max(0, Math.min(spreads - 1, Math.round(bookPosition) + direction));
  if (!motion) {
    manualIndex = index;
    bookPosition = index;
    drawSpread(index);
    return;
  }
  const scale = designScale(document);
  const start = scrollY + runway.getBoundingClientRect().top;
  window.scrollTo({ top: start + (introTravel + index * turnDistance) * scale, behavior: 'instant' });
});

function draw() {
  frame = 0;
  const distance = motion ? Math.max(0, Math.min(travel, -runway.getBoundingClientRect().top / designScale(document))) : 0;
  if (distance === lastDrawn) return;
  lastDrawn = distance;
  const p = motion && introTravel ? clamp(distance / introTravel) : 1;
  bookPosition = motion ? Math.max(0, (distance - introTravel) / turnDistance) : manualIndex;
  bookPosition = Math.min(spreads - 1, bookPosition);
  reader.inert = p < .88;
  hint.hidden = p >= .88;
  drawSpread(bookPosition);
  if (!motion) {
    reader.style.opacity = '';
    return;
  }
  stage.style.setProperty('--ire-pin', `${distance}px`);
  if (p === 1) {
    reader.style.opacity = '1';
    const fraction = bookPosition % 1;
    const bloom = reduced.matches ? 0 : ease(fraction / .28) * (1 - ease((fraction - .61) / .39));
    paintStack(() => ({ opacity: bloom, spread: bloom, exit: 0 }), false);
    return;
  }
  const exit = ease((p - .59) / .34);
  const crossfade = ease((p - .83) / .12);
  reader.style.opacity = crossfade;
  paintStack((index, cover) => ({
    spread: ease((p - .12 - index * .025) / .34),
    opacity: (cover ? mix(.78, 1, ease(p / .13)) : ease((p - .10 - index * .025) / .13)) *
      (1 - crossfade) * (cover ? 1 : 1 - exit),
    exit,
  }), true, p);
}

function paintStack(state, intro, p = 1) {
  const narrow = mobile();
  const width = artwork.clientWidth;
  const height = artwork.clientHeight;
  const strength = (settings.intensity ?? 100) / 100;
  const spacing = (settings.spacing ?? 100) / 100;
  stack.forEach((card, index) => {
    const cover = index === stack.length - 1;
    if ((!intro && cover) || (narrow && ![0, 3, 4].includes(index))) {
      card.style.opacity = '0';
      return;
    }
    const [targetX, targetY, angle, size] = positions[index];
    const { spread, exit, opacity } = state(index, cover);
    const x = targetX * width * (narrow ? .66 : 1) * spacing * spread;
    const y = targetY * height * spacing * spread;
    const startingScale = cover ? mix(1.12, 1, ease(p / .13)) : .99;
    const scale = mix(startingScale, size, spread);
    card.style.opacity = opacity;
    card.style.transform = `translate(-50%,-50%) translate(${x * (1 - exit) * strength}px,${y * (1 - exit) * strength}px) rotate(${angle * spread * (1 - exit) * strength}deg) scale(${mix(scale, narrow ? 1.6 : 1.5, exit)})`;
  });
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(draw);
}

function size() {
  lastDrawn = undefined;
  const height = Math.max(450, innerHeight / designScale(document));
  introTravel = reduced.matches ? 0 : height * (settings.duration ?? 115) / 100;
  // Use native scrolling, with a short distance per editorial reveal.
  turnDistance = Math.max(105, Math.min(185, height * .16));
  travel = introTravel + (spreads - 1) * turnDistance;
  section.style.setProperty('--ire-stage', `${height}px`);
  section.style.setProperty('--ire-travel', `${travel}px`);
  const visibleHeight = artwork.clientHeight;
  const bookScale = (settings.size ?? 100) / 100;
  const allowableWidth = visibleHeight * 2.828 * bookScale;
  section.style.setProperty('--ire-max', `${Math.round(allowableWidth)}px`);
  schedule();
}

function syncMode() {
  motion = !editing || previewMotion;
  section.classList.toggle('is-reduced', reduced.matches);
  section.classList.toggle('is-scrubbed', motion);
  size();
  draw();
}

function apply(next = {}) {
  settings = next;
  section.style.setProperty('--ire-bg', settings.background ?? '#f1efe9');
  section.style.setProperty('--ire-ink', settings.color ?? '#171513');
  section.style.setProperty('--ire-x', `${settings.x ?? 0}px`);
  section.style.setProperty('--ire-y', `${settings.y ?? 0}px`);
  const scale = (settings.size ?? 100) / 100;
  section.style.setProperty('--ire-book', `${(mobile() ? 100 : 82) * scale}%`);
  section.style.setProperty('--ire-card', `${(mobile() ? 46 : 24) * scale}%`);
  size();
}

document.addEventListener('portfolio:ire-settings', ({ detail }) => apply(detail));
document.addEventListener('portfolio:ire-preview', ({ detail }) => { previewMotion = detail; syncMode(); });
window.addEventListener('scroll', () => { if (motion) schedule(); }, { passive: true });
window.addEventListener('resize', () => apply(settings));
reduced.addEventListener('change', syncMode);
syncMode();
apply();
