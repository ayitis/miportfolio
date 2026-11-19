const video = document.querySelector('#carnage-reel');
const reel = video.closest('.reel-frame');
const toggle = reel.querySelector('.reel-toggle');
const canvas = reel.querySelector('.reel-effects');
const context = canvas.getContext('2d');
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

const sequence = [
  { name: 'tracking', gap: 4500, duration: 180 },
  { name: 'red', gap: 3400, duration: 150 },
  { name: 'contrast', gap: 4900, duration: 180 },
  { name: 'tracking', gap: 3100, duration: 140 },
  { name: 'red', gap: 5200, duration: 130 },
];
let sequenceIndex = 0;
let timer;
let inView = false;

function drawTrackingBands() {
  if (!context || video.readyState < 2) return;
  canvas.width = 240;
  canvas.height = 426;
  const { width, height } = canvas;
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (video.videoWidth - sourceWidth) / 2;
  const sourceY = (video.videoHeight - sourceHeight) / 2;
  const bands = mobile.matches ? [[.58, 7, 5]] : [[.22, 6, -9], [.51, 15, 14], [.78, 5, -11]];
  for (const [position, bandHeight, shift] of bands) {
    const y = Math.round(position * height);
    context.drawImage(video, sourceX, sourceY + y / scale, sourceWidth, bandHeight / scale,
      shift, y, width, bandHeight);
    context.fillStyle = '#ed153449';
    context.fillRect(0, y, width, 1);
  }
}

function syncEffects() {
  clearTimeout(timer);
  delete reel.dataset.effect;
  if (!inView || document.hidden || video.paused || video.ended || reducedMotion.matches) return;

  const effect = sequence[sequenceIndex];
  timer = setTimeout(() => {
    sequenceIndex = (sequenceIndex + 1) % sequence.length;
    if (effect.name === 'tracking') drawTrackingBands();
    reel.dataset.effect = effect.name;
    timer = setTimeout(syncEffects, effect.duration);
  }, effect.gap);
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
video.addEventListener('waiting', () => {
  clearTimeout(timer);
  delete reel.dataset.effect;
});
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
