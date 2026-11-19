const video = document.querySelector('#carnage-reel');
const reel = video.closest('.reel-frame');
const toggle = reel.querySelector('.reel-toggle');
const layers = reel.querySelector('.reel-effects');
const header = document.querySelector('header');
const masthead = document.querySelector('.masthead');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = matchMedia('(max-width: 650px)');

let frame = 0;
function renderScroll() {
  frame = 0;
  const scroll = Math.max(0, window.scrollY);
  const lift = reducedMotion.matches ? 0 : mobile.matches
    ? Math.min(20, scroll * .18)
    : Math.min(Math.max(0, reel.offsetTop - masthead.offsetTop - 6), scroll * 2.15);
  reel.style.setProperty('--reel-lift', `${-lift}px`);
}

function scheduleScroll() {
  if (!frame) frame = requestAnimationFrame(renderScroll);
}

window.addEventListener('scroll', scheduleScroll, { passive: true });
const layout = new ResizeObserver(scheduleScroll);
for (const element of [header, masthead, reel]) layout.observe(element);
reducedMotion.addEventListener('change', scheduleScroll);
mobile.addEventListener('change', scheduleScroll);
renderScroll();

// Each cue animates only the opacity and transform of prepainted overlays.
const sequence = [
  { name: 'tracking', gap: 2600, duration: 520, opacity: .38, from: 9, to: -12 },
  { name: 'red', gap: 2800, duration: 300, opacity: .62 },
  { name: 'leak', gap: 1700, duration: 820, opacity: .48, from: -17, to: 12 },
  { name: 'dropout', gap: 2200, duration: 410, opacity: .55, from: -5, to: 7 },
  { name: 'fringe', gap: 1800, duration: 540, opacity: .62, from: 6, to: -6 },
  { name: 'exposure', gap: 2100, duration: 630, opacity: .36 },
];
let sequenceIndex = 0;
let timer;
let animation;
let inView = false;

function stopEffects() {
  clearTimeout(timer);
  animation?.cancel();
  animation = null;
  delete reel.dataset.effect;
}

function syncEffects() {
  stopEffects();
  if (!inView || document.hidden || video.paused || video.ended || video.readyState < 3 || reducedMotion.matches) return;

  const { name, gap, duration, opacity, from = 0, to = 0 } = sequence[sequenceIndex];
  timer = setTimeout(() => {
    sequenceIndex = (sequenceIndex + 1) % sequence.length;
    const strength = mobile.matches ? .72 : 1;
    const translate = name === 'tracking' || name === 'dropout' ? 'translateY' : 'translateX';
    const shift = distance => `${translate}(${distance * strength}px)`;
    reel.dataset.effect = name;
    animation = layers.querySelector(`.reel-${name}`).animate([
      { opacity: 0, transform: shift(from), easing: 'ease-out' },
      { opacity: opacity * strength, transform: shift(from * .55), offset: .28, easing: 'ease-in-out' },
      { opacity: 0, transform: shift(to) },
    ], duration);
    animation.onfinish = syncEffects;
  }, gap);
}

const visibility = new IntersectionObserver(([entry]) => {
  inView = entry.intersectionRatio >= .2;
  syncEffects();
}, { threshold: .2 });
visibility.observe(reel);

function updatePlayback() {
  toggle.textContent = video.paused ? 'PLAY' : 'PAUSE';
  toggle.setAttribute('aria-label', video.paused ? 'Play campaign film' : 'Pause campaign film');
  syncEffects();
}

function showFilm() {
  reel.classList.add('is-playing');
  updatePlayback();
}
function showControls() {
  reel.classList.add('has-media');
  updatePlayback();
}
if (video.readyState >= 1) showControls();
else video.addEventListener('loadedmetadata', showControls, { once: true });
if (video.readyState >= 2) showFilm();
else video.addEventListener('loadeddata', showFilm, { once: true });
video.addEventListener('error', () => reel.classList.remove('is-playing', 'has-media'));
video.addEventListener('playing', updatePlayback);
video.addEventListener('pause', updatePlayback);
video.addEventListener('waiting', stopEffects);
document.addEventListener('visibilitychange', syncEffects);
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) video.pause();
  syncEffects();
});
toggle.addEventListener('click', () => {
  if (video.paused) video.play().catch(() => {});
  else video.pause();
});
if (!reducedMotion.matches) video.play().catch(() => {});
