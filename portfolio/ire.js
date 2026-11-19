import { designScale } from './ayam-canvas.js';
import { portfolioView } from './viewport.js';

const section = document.querySelector('#ire-magazine');
const runway = section.querySelector('.ire-runway');
const stage = section.querySelector('.ire-stage');
const artwork = section.querySelector('.ire-artwork');
const stack = [...section.querySelectorAll('.ire-stack img')];
const reader = section.querySelector('.ire-reader');
const book = section.querySelector('.ire-book');
const [left, right] = book.querySelectorAll('img');
const controls = section.querySelector('.ire-controls');
const previous = section.querySelector('[data-ire-prev]');
const next = section.querySelector('[data-ire-next]');
const hint = section.querySelector('.ire-scroll');
const dialog = section.querySelector('dialog');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const editing = window.parent !== window && new URLSearchParams(location.search).has('editor-preview');
const mobile = () => portfolioView(window, 'ayam') === 'mobile';
const total = 56;
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { value = clamp(value); return value * value * (3 - 2 * value); };
const mix = (a, b, value) => a + (b - a) * value;
const opened = .88;
const positions = [[-.29,-.18,-11,.86], [ .28,-.22,9,.84],[-.26,.22,7,.88],[.28,.23,-8,.89],[0,0,-2,1.08]];
let pageNumber = 1;
let didOpen = false;
let travel = 0;
let motion = false;
let previewMotion = false;
let progress = 1;
let lastDrawn;
let openingQueued = false;
let frame = 0;
let settings = {};
let touch;
let lastTurn;

function pagesShown() {
  if (mobile() || pageNumber === 1 || pageNumber === total) return [pageNumber];
  const first = pageNumber - pageNumber % 2;
  return [first, first + 1];
}

function imagePath(number) {
  return `/portfolio/ire/${String(number).padStart(2, '0')}.webp`;
}

function setImage(image, number) {
  image.hidden = !number;
  if (!number) return;
  image.src = imagePath(number);
  image.alt = number === 1 ? 'IRE Magazine cover' : number === total ? 'IRE Magazine back cover' : `IRE Magazine, page ${number}`;
}

function renderPages(direction = 0) {
  const shown = pagesShown();
  setImage(left, shown[0]);
  setImage(right, shown[1]);
  reader.classList.toggle('ire-single', shown.length === 1);
  section.querySelector('.ire-count').value = `${shown.join('–')} / ${total}`;
  previous.disabled = shown[0] === 1;
  next.disabled = shown.at(-1) === total;
  lastTurn?.cancel();
  if (direction && !reduced.matches && book.animate) {
    lastTurn = book.animate([{ opacity: .42, transform: `translateX(${direction * 8}px)` },
      { opacity: 1, transform: 'none' }], { duration: 250, easing: 'ease-out' });
  }
}

function turn(direction) {
  const shown = pagesShown();
  const number = direction > 0 ? shown.at(-1) + 1 : shown[0] - 1;
  if (number < 1 || number > total) return;
  pageNumber = number;
  renderPages(direction);
}
previous.addEventListener('click', () => turn(-1));
next.addEventListener('click', () => turn(1));
book.addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  turn(event.key === 'ArrowLeft' ? -1 : 1);
});
book.addEventListener('touchstart', event => {
  const start = event.changedTouches[0];
  touch = { x: start.clientX, y: start.clientY };
}, { passive: true });
book.addEventListener('touchcancel', () => { touch = undefined; });
book.addEventListener('touchend', event => {
  if (!touch) return;
  const end = event.changedTouches[0];
  const x = end.clientX - touch.x;
  const y = end.clientY - touch.y;
  touch = undefined;
  if (Math.abs(x) > 45 && Math.abs(x) > Math.abs(y) * 1.4) turn(x < 0 ? 1 : -1);
}, { passive: true });

section.querySelector('[data-ire-zoom]').addEventListener('click', () => {
  const images = pagesShown().map(number => {
    const image = new Image();
    setImage(image, number);
    return image;
  });
  dialog.querySelector('.ire-zoom-pages').replaceChildren(...images);
  dialog.showModal();
});
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

function draw() {
  frame = 0;
  const p = motion ? clamp(-runway.getBoundingClientRect().top / (travel * designScale(document))) : 1;
  if (p === lastDrawn) return;
  lastDrawn = p;
  if (motion && !openingQueued && p > .35) {
    openingQueued = true;
    for (const number of mobile() ? [2] : [2, 3]) new Image().src = imagePath(number);
  }
  if (motion) stage.style.setProperty('--ire-pin', `${p * travel}px`);
  if (motion && progress < opened && p >= opened && !didOpen) {
    didOpen = true;
    if (pageNumber === 1) {
      pageNumber = 2;
      renderPages();
    }
  }
  progress = p;
  reader.inert = p < opened;
  controls.hidden = p < opened;
  hint.hidden = p >= opened;
  if (!motion) {
    reader.style.opacity = '';
    return;
  }
  const narrow = mobile();
  const width = artwork.clientWidth;
  const height = artwork.clientHeight;
  const strength = (settings.intensity ?? 100) / 100;
  const spacing = (settings.spacing ?? 100) / 100;
  const exit = ease((p - .59) / .28);
  const crossfade = ease((p - .83) / .12);
  reader.style.opacity = crossfade;
  // The cover starts on top. Lower leaves use slightly staggered progress.
  stack.forEach((card, index) => {
    const cover = index === stack.length - 1;
    const visible = !narrow || [0, 3, 4].includes(index);
    if (!visible) { card.style.opacity = '0'; return; }
    const [targetX, targetY, angle, size] = positions[index];
    const spread = ease((p - .12 - index * .025) / .34);
    const x = targetX * width * (narrow ? .66 : 1) * spacing * spread;
    const y = targetY * height * spacing * spread;
    const landingX = cover || narrow ? 0 : (index % 2 ? .13 : -.13) * width;
    const landingY = cover ? -5 : 0;
    const startingScale = cover ? mix(1.12, 1, ease(p / .13)) : .99;
    const scale = mix(startingScale, size, spread);
    const intro = cover ? mix(.78, 1, ease(p / .13)) : ease((p - .10 - index * .025) / .13);
    card.style.opacity = intro * (1 - crossfade);
    card.style.transform = `translate(-50%,-50%) translate(${mix(x, landingX, exit) * strength}px,${mix(y, landingY, exit) * strength}px) rotate(${mix(angle * spread, 0, exit) * strength}deg) scale(${mix(scale, narrow ? 1.6 : 1.5, exit)})`;
  });
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(draw);
}

function size() {
  lastDrawn = undefined;
  const height = Math.max(450, innerHeight / designScale(document));
  travel = height * (settings.duration ?? 115) / 100;
  section.style.setProperty('--ire-stage', `${height}px`);
  section.style.setProperty('--ire-travel', `${travel}px`);
  renderPages();
  const visibleHeight = artwork.clientHeight;
  const bookScale = (settings.size ?? 100) / 100;
  const allowableWidth = visibleHeight * (mobile() ? 1.414 : 2.828) * bookScale;
  section.style.setProperty('--ire-max', `${Math.round(allowableWidth)}px`);
  schedule();
}

function syncMode() {
  motion = (!editing || previewMotion) && !reduced.matches;
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
  section.style.setProperty('--ire-book', `${(mobile() ? 100 : 78) * scale}%`);
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
