const video = document.querySelector('#carnage-reel');
const reel = video.closest('.reel-frame');
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
video.muted = false;

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
let userInteracted = false;

function syncPlayback() {
  if (!inView || document.hidden || reducedMotion.matches) {
    video.pause();
    return;
  }
  if (userInteracted) video.muted = false;
  const attempt = video.play();
  if (attempt?.catch) attempt.catch(() => {
    // Preserve video playback if the browser blocks audible autoplay.
    if (!inView || document.hidden || reducedMotion.matches) return;
    video.muted = true;
    video.play().catch(() => {});
  });
}

function activateAudio() {
  userInteracted = true;
  if (!inView || document.hidden || reducedMotion.matches) return;
  video.muted = false;
  syncPlayback();
}
document.addEventListener('pointerdown', activateAudio, { capture: true, passive: true });
document.addEventListener('keydown', activateAudio, { capture: true });

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

// Mean luma of 0930.mp4 at four samples per second, measured offline.
// Use it only for the exposure effects, leaving clean footage and cuts intact.
const shotLuma = [
  117, 117, 117, 117, 117, 117, 117, 117, 117, 117, 117, 122, 51, 9, 8,
  83, 83, 79, 10, 51, 51, 94, 76, 79, 81, 78, 91, 112, 104, 95,
  91, 83, 77, 131, 130, 92, 87, 87, 87, 135, 135, 148, 147, 136, 136,
  99, 131, 130, 130, 133, 133, 132, 129, 128, 128, 126, 126, 134, 155, 130,
  135, 135, 133, 131, 137, 141, 145, 143, 132, 125, 126, 131, 131, 142, 141,
  126, 133, 133, 132, 132, 132, 131, 130, 130, 131, 130, 132, 132, 124, 87,
  125, 94, 125, 4, 125, 123, 114, 113, 110, 131, 129, 127, 131, 147, 131,
  130, 130, 132, 131, 131, 129, 131, 131, 132, 128, 129, 129, 133, 133, 155,
  131, 131, 4, 128, 129, 114, 131, 133, 133, 144, 129, 129, 129, 129, 115,
  129, 4, 132, 132, 132, 132, 132, 133, 1, 1, 1, 1, 1, 1, 1,
];
let exposureFrame;

function updateExposure(time) {
  const luma = shotLuma[Math.min(shotLuma.length - 1, Math.floor(time * 4))];
  // Near-black frames are intentional transitions. Bound compensation to
  // retain highlight detail and avoid blowing out darker takes.
  const gain = luma < 24 ? 1 : Math.max(.84, Math.min(1.52, 129 / luma));
  const exposure = gain.toFixed(2);
  if (reel.style.getPropertyValue('--reel-exposure') !== exposure) {
    reel.style.setProperty('--reel-exposure', exposure);
  }
}

function trackExposure() {
  updateExposure(video.currentTime);
  if (!video.requestVideoFrameCallback) return;
  const onFrame = (_, { mediaTime }) => {
    updateExposure(mediaTime);
    exposureFrame = video.requestVideoFrameCallback(onFrame);
  };
  exposureFrame = video.requestVideoFrameCallback(onFrame);
}

function stopEffects() {
  clearTimeout(timer);
  if (exposureFrame !== undefined) {
    video.cancelVideoFrameCallback(exposureFrame);
    exposureFrame = undefined;
  }
  delete reel.dataset.effect;
}

function syncEffects() {
  stopEffects();
  if (!inView || document.hidden || video.paused || video.ended || reducedMotion.matches) return;

  const effect = sequence[sequenceIndex];
  timer = setTimeout(() => {
    sequenceIndex = (sequenceIndex + 1) % sequence.length;
    if (effect.name === 'tracking') drawTrackingBands();
    if (effect.name === 'red' || effect.name === 'contrast') trackExposure();
    reel.dataset.effect = effect.name;
    timer = setTimeout(syncEffects, effect.duration);
  }, effect.gap);
}

const visibility = new IntersectionObserver(([entry]) => {
  inView = entry.intersectionRatio >= .2;
  syncPlayback();
  syncEffects();
}, { threshold: .2 });
visibility.observe(reel);

function updatePlayback() {
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
document.addEventListener('visibilitychange', () => {
  syncPlayback();
  syncEffects();
});
reducedMotion.addEventListener('change', () => {
  syncPlayback();
  syncEffects();
});
